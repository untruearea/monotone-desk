"""Real GenVM SDK; only public HTTP transport bytes are mocked."""
import copy
import hashlib
import json
from pathlib import Path
import re
import pytest

ROOT = Path(__file__).parents[1]
META = json.loads((ROOT/'fixtures/source.json').read_text())
BODY = (ROOT/'fixtures/input.json').read_bytes().decode('utf-8')


def deploy(vm, build):
    vm.warp('2026-10-21T00:00:00Z')
    c = build(str(ROOT/'contract.py'), sdk_version='v0.2.12')
    assert hasattr(c, 'open_fit'), 'MonotoneDesk API NOT_IMPLEMENTED'
    return c


def opened(vm, c, body=BODY, ident='fit'):
    vm.clear_mocks()
    vm.mock_web(re.escape(META['test_url']), {'status':200,'body':body})
    c.open_fit(ident, META['test_url'], hashlib.sha256(body.encode()).hexdigest())


def derive(vm, c, body=BODY):
    opened(vm, c, body)
    return c.derive_fit('fit', 0)


def test_literal_exact_weighted_pava_blocks_losses_and_confirm(direct_vm, direct_deploy):
    c=deploy(direct_vm,direct_deploy);r=derive(direct_vm,c)
    assert r['blocks']==[
        {'scores':[1000,2000],'count':20,'positives':10,'rate':{'numerator':1,'denominator':2}},
        {'scores':[3000,4000],'count':30,'positives':22,'rate':{'numerator':11,'denominator':15}}]
    assert r['weighted_bin_sse']=={'numerator':34,'denominator':15}
    assert r['bernoulli_sse']=={'numerator':163,'denominator':15}
    assert [b['score'] for b in r['fitted']]==[1000,2000,3000,4000]
    assert r['fitted'][2]=={'score':3000,'count':20,'positives':16,'block':1,'rate':{'numerator':11,'denominator':15}}
    assert direct_vm.run_validator() is True
    d=c.get_fit('fit');assert d['status']=='DERIVED' and d['revision']==1
    assert len(d['certificate_id'])==64
    c.confirm_fit('fit',1,d['certificate_id'])
    assert c.get_fit('fit')['status']=='CONFIRMED' and c.get_fit('fit')['revision']==2
    assert direct_vm.run_validator() is True


def test_equal_means_merge_canonically_and_loss_is_exact_zero(direct_vm,direct_deploy):
    c=deploy(direct_vm,direct_deploy)
    body=json.dumps({'version':1,'bins':[{'score':3,'count':4,'positives':2},{'score':1,'count':2,'positives':1},{'score':2,'count':2,'positives':1}]})
    r=derive(direct_vm,c,body)
    assert r['blocks']==[{'scores':[1,2,3],'count':8,'positives':4,'rate':{'numerator':1,'denominator':2}}]
    assert r['weighted_bin_sse']=={'numerator':0,'denominator':1}
    assert r['bernoulli_sse']=={'numerator':2,'denominator':1}


def test_duplicate_scores_keep_original_row_loss_constant(direct_vm,direct_deploy):
    c=deploy(direct_vm,direct_deploy)
    r=derive(direct_vm,c,json.dumps({'version':1,'bins':[{'score':5,'count':2,'positives':0},{'score':5,'count':2,'positives':2}]}))
    assert r['fitted']==[{'score':5,'count':4,'positives':2,'block':0,'rate':{'numerator':1,'denominator':2}}]
    assert r['weighted_bin_sse']==r['bernoulli_sse']=={'numerator':1,'denominator':1}


def test_monotone_extremes_and_single_row_are_unchanged(direct_vm,direct_deploy):
    c=deploy(direct_vm,direct_deploy)
    r=derive(direct_vm,c,json.dumps({'version':1,'bins':[{'score':0,'count':3,'positives':0},{'score':10000,'count':3,'positives':3}]}))
    assert [x['rate'] for x in r['fitted']]==[{'numerator':0,'denominator':1},{'numerator':1,'denominator':1}]
    assert r['weighted_bin_sse']==r['bernoulli_sse']=={'numerator':0,'denominator':1}


def test_descending_sample_pools_and_input_permutation_does_not_change_fit(direct_vm,direct_deploy):
    c=deploy(direct_vm,direct_deploy)
    sample={'version':1,'bins':[{'score':i,'count':10,'positives':p} for i,p in [(1,8),(2,2),(3,0)]]}
    r=derive(direct_vm,c,json.dumps(sample));assert len(r['blocks'])==1 and r['blocks'][0]['rate']=={'numerator':1,'denominator':3}
    sample['bins'].reverse();opened(direct_vm,c,json.dumps(sample),'permuted')
    assert c.derive_fit('permuted',0)==r


@pytest.mark.parametrize('field,value',[('score',True),('score',1.0),('score',-1),('score',10001),('positives',False),('positives',11),('positives',-1),('count',0),('count',10001),('count',10.0)])
def test_strict_bounded_integers(direct_vm,direct_deploy,field,value):
    c=deploy(direct_vm,direct_deploy);sample=json.loads(BODY);sample['bins'][0][field]=value
    with direct_vm.expect_revert():opened(direct_vm,c,json.dumps(sample))


@pytest.mark.parametrize('kind',['empty','17rows','total','extra','version_bool','duplicate_json','nan','malformed','oversized'])
def test_strict_schema_resources_and_json(direct_vm,direct_deploy,kind):
    c=deploy(direct_vm,direct_deploy);s=json.loads(BODY)
    if kind=='empty':s['bins']=[]
    if kind=='17rows':s['bins']=[{'score':x,'count':1,'positives':0} for x in range(17)]
    if kind=='total':s['bins']=[{'score':x,'count':10000,'positives':1} for x in range(11)]
    if kind=='extra':s['bins'][0]['person']='not allowed'
    if kind=='version_bool':s['version']=True
    body=json.dumps(s)
    if kind=='duplicate_json':body=body.replace('"version": 1','"version": 1,"version": 1')
    if kind=='nan':body=body.replace('"score": 1000','"score": NaN')
    if kind=='malformed':body='{'
    if kind=='oversized':body+=' '*17000
    with direct_vm.expect_revert():opened(direct_vm,c,body)


@pytest.mark.parametrize('repo',['.','..','%2e','repo?bad'])
def test_bad_namespace_rejected_before_fetch(direct_vm,direct_deploy,repo):
    c=deploy(direct_vm,direct_deploy)
    url='https://raw.githubusercontent.com/example/'+repo+'/'+'a'*40+'/input.json'
    with direct_vm.expect_revert('commit-pinned'):c.open_fit('bad',url,'b'*64)


@pytest.mark.parametrize('field',['rate','loss','binding'])
def test_validator_recomputes_entire_packet_and_rejects_forgery(direct_vm,direct_deploy,field):
    c=deploy(direct_vm,direct_deploy);derive(direct_vm,c);packet=c.get_fit('fit')['last_capture']
    if field=='rate':packet['result']['blocks'][0]['rate']['numerator']=99
    if field=='loss':packet['result']['weighted_bin_sse']['numerator']=0
    if field=='binding':packet['binding']['id']='another'
    assert direct_vm.run_validator(leader_result=packet) is False


def test_fresh_source_hash_and_failed_confirm_do_not_modify_state(direct_vm,direct_deploy):
    c=deploy(direct_vm,direct_deploy);derive(direct_vm,c);d=c.get_fit('fit')
    direct_vm.clear_mocks();direct_vm.mock_web(re.escape(META['test_url']),{'status':200,'body':'changed'})
    assert direct_vm.run_validator() is False
    with direct_vm.expect_revert('SOURCE'):c.confirm_fit('fit',1,d['certificate_id'])
    assert c.get_fit('fit')==d
    c.revoke_fit('fit',1,'Withdraw this sample.')
    assert c.get_fit('fit')['status']=='REVOKED'


def test_creator_cas_cert_binding_terminal_and_offline_revoke(direct_vm,direct_deploy):
    from gltest.direct import create_address
    c=deploy(direct_vm,direct_deploy);opened(direct_vm,c)
    with direct_vm.prank(create_address('auditor')):c.derive_fit('fit',0)
    d=c.get_fit('fit')
    with direct_vm.prank(create_address('other')):
        with direct_vm.expect_revert('creator only'):c.confirm_fit('fit',1,d['certificate_id'])
        with direct_vm.expect_revert('creator only'):c.revoke_fit('fit',1,'not mine')
    with direct_vm.expect_revert('revision'):c.confirm_fit('fit',0,d['certificate_id'])
    with direct_vm.expect_revert('certificate'):c.confirm_fit('fit',1,'00'*32)
    opened(direct_vm,c,ident='other');c.derive_fit('other',0)
    assert c.get_fit('other')['certificate_id']!=d['certificate_id']
    with direct_vm.expect_revert('certificate'):c.confirm_fit('other',1,d['certificate_id'])
    c.confirm_fit('fit',1,d['certificate_id'])
    with direct_vm.expect_revert():c.confirm_fit('fit',2,d['certificate_id'])
    direct_vm.clear_mocks();c.revoke_fit('fit',2,'Retired.')
    assert len(c.get_fit('fit')['history'])==4
    with direct_vm.expect_revert():c.revoke_fit('fit',3,'Again')
    with direct_vm.expect_revert():c.derive_fit('fit',3)
    with direct_vm.expect_revert():opened(direct_vm,c)


def test_fixture_exact_bytes_match_declared_publication_metadata():
    body=(ROOT/'fixtures/input.json').read_bytes()
    assert len(body)==META['bytes']
    assert hashlib.sha256(body).hexdigest()==META['sha256']
    assert META['public_url'] is None and META['live_source_verified'] is False

# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import hashlib
import json
import re
from datetime import datetime, timezone


def _require(ok: bool, message: str) -> None:
    if not ok:
        raise gl.vm.UserError('[EXPECTED] '+message)


def _canon(value) -> str:
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False)


def _now() -> int:
    t=datetime.fromisoformat(gl.message_raw['datetime'].replace('Z','+00:00'))
    if t.tzinfo is None:
        t=t.replace(tzinfo=timezone.utc)
    delta=t.astimezone(timezone.utc)-datetime(1970,1,1,tzinfo=timezone.utc)
    return delta.days*86400+delta.seconds


def _id(value: str) -> None:
    _require(isinstance(value,str) and re.fullmatch(r'[A-Za-z0-9_-]{1,64}',value) is not None,'invalid identifier')


def _source(url: str,digest: str) -> None:
    m=re.fullmatch(r'https://raw\.githubusercontent\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9_.-]{1,100})/([0-9a-f]{40})/([A-Za-z0-9_.~/-]+)',url) if isinstance(url,str) and len(url)<=512 else None
    _require(m is not None,'commit-pinned public source required')
    owner,repo,commit,path=m.groups()
    _require(owner[0].isalnum() and owner[-1].isalnum() and '--' not in owner and repo not in ('.','..') and all(p not in ('','.','..') for p in path.split('/')),'commit-pinned unambiguous namespace required')
    _require(isinstance(digest,str) and re.fullmatch('[0-9a-f]{64}',digest) is not None,'invalid SHA256')


def _pairs(pairs: list) -> dict:
    result={}
    for k,v in pairs:
        _require(k not in result,'duplicate JSON key');result[k]=v
    return result


def _constant(value: str):
    raise gl.vm.UserError('[EXPECTED] nonfinite JSON constant')


def _fetch(url: str,digest: str) -> dict:
    r=gl.nondet.web.get(url,headers={'Accept':'application/json'})
    if r.status!=200 or r.body is None or not 1<=len(r.body)<=16384 or hashlib.sha256(r.body).hexdigest()!=digest:
        raise gl.vm.UserError('[SOURCE] unavailable, oversized or byte digest mismatch')
    try:
        raw=json.loads(r.body.decode('utf-8'),object_pairs_hook=_pairs,parse_constant=_constant)
    except (ValueError,UnicodeError,RecursionError):
        raise gl.vm.UserError('[SOURCE] invalid UTF-8 JSON')
    return _validate(raw)


def _validate(raw) -> dict:
    _require(isinstance(raw,dict) and set(raw)=={'version','bins'} and type(raw['version']) is int and raw['version']==1,'sample fields/version')
    rows=raw['bins'];_require(isinstance(rows,list) and 1<=len(rows)<=16,'1..16 bins required')
    for row in rows:
        _require(isinstance(row,dict) and set(row)=={'score','positives','count'},'bin fields')
        _require(type(row['score']) is int and 0<=row['score']<=10000,'score integer0..10000')
        _require(type(row['count']) is int and 1<=row['count']<=10000,'count integer1..10000')
        _require(type(row['positives']) is int and 0<=row['positives']<=row['count'],'positives integer0..count')
    _require(sum(row['count'] for row in rows)<=100000,'total count bound')
    return {'version':1,'bins':sorted(rows,key=lambda r:(r['score'],r['count'],r['positives']))}


def _rational(n: int,d: int) -> dict:
    _require(d>0,'positive rational denominator')
    a=abs(n);b=d
    while b:
        a,b=b,a%b
    return {'numerator':n//a,'denominator':d//a}


def _add(a: dict,b: dict) -> dict:
    return _rational(a['numerator']*b['denominator']+b['numerator']*a['denominator'],a['denominator']*b['denominator'])


def _derive(data: dict) -> dict:
    by_score={}
    for row in data['bins']:
        score=row['score']
        if score not in by_score:
            by_score[score]={'score':score,'count':0,'positives':0}
        by_score[score]['count']+=row['count'];by_score[score]['positives']+=row['positives']
    aggregated=[by_score[s] for s in sorted(by_score)]
    stack=[]
    for row in aggregated:
        stack.append({'scores':[row['score']],'count':row['count'],'positives':row['positives']})
        # Equality merges as well: the public representation has maximal blocks.
        while len(stack)>1 and stack[-2]['positives']*stack[-1]['count']>=stack[-1]['positives']*stack[-2]['count']:
            right=stack.pop();left=stack.pop()
            stack.append({'scores':left['scores']+right['scores'],'count':left['count']+right['count'],'positives':left['positives']+right['positives']})
    blocks=[];rates={};fitted=[]
    for index,block in enumerate(stack):
        rate=_rational(block['positives'],block['count']);block['rate']=rate;blocks.append(block)
        for score in block['scores']:
            rates[score]=rate;r=by_score[score]
            fitted.append({'score':score,'count':r['count'],'positives':r['positives'],'block':index,'rate':rate})
    weighted={'numerator':0,'denominator':1};bernoulli={'numerator':0,'denominator':1}
    for row in data['bins']:
        rate=rates[row['score']];n=rate['numerator'];d=rate['denominator'];count=row['count'];positives=row['positives']
        weighted=_add(weighted,_rational((n*count-positives*d)**2,d*d*count))
        bernoulli=_add(bernoulli,_rational(positives*(d-n)**2+(count-positives)*n*n,d*d))
    return {'aggregated':aggregated,'blocks':blocks,'fitted':fitted,'weighted_bin_sse':weighted,'bernoulli_sse':bernoulli}


def _capture(url: str,digest: str,binding: dict) -> dict:
    def leader() -> dict:
        data=_fetch(url,digest)
        return {'binding':binding,'source_sha256':digest,'data':data,'result':None if binding['operation']=='open' else _derive(data)}
    def validator(proposed: gl.vm.Result) -> bool:
        if not isinstance(proposed,gl.vm.Return):
            return False
        try:
            # Every validator fetches and recomputes the complete mathematical result.
            return _canon(leader())==_canon(proposed.calldata)
        except Exception:
            return False
    return gl.vm.run_nondet_unsafe(leader,validator)


class MonotoneDesk(gl.Contract):
    fits: TreeMap[str,str]

    def __init__(self):
        pass

    def _get(self,ident: str) -> dict:
        _require(ident in self.fits,'unknown fit')
        return json.loads(self.fits[ident])

    def _binding(self,d: dict,operation: str) -> dict:
        return {'protocol':'MonotoneDesk-v1','chain_id':int(gl.message.chain_id),'contract':gl.message.contract_address.as_hex.lower(),'id':d['fit_id'],'creator':d['creator'],'source_url':d['source_url'],'source_sha256':d['source_sha256'],'revision':d['revision'],'operation':operation,'observed_at':_now()}

    def _cas(self,d: dict,revision: int,creator: bool) -> None:
        if creator:
            _require(d['creator']==gl.message.sender_address.as_hex.lower(),'creator only')
        _require(type(revision) is int and revision==d['revision'],'stale revision')

    def _event(self,d: dict,operation: str) -> None:
        d['history'].append({'operation':operation,'revision':d['revision'],'observed_at':_now()})

    @gl.public.write
    def open_fit(self,fit_id: str,source_url: str,source_sha256: str) -> None:
        _id(fit_id);_source(source_url,source_sha256)
        _require(fit_id not in self.fits,'fit_id already used')
        d={'fit_id':fit_id,'creator':gl.message.sender_address.as_hex.lower(),'source_url':source_url,'source_sha256':source_sha256,'status':'OPEN','revision':0,'opened_at':_now(),'derived_at':0,'confirmed_at':0,'revoked_at':0,'reason':'','history':[],'result':None,'certificate_id':''}
        packet=_capture(source_url,source_sha256,self._binding(d,'open'))
        d['data']=packet['data'];d['last_capture']=packet;self._event(d,'OPEN')
        self.fits[fit_id]=_canon(d)

    @gl.public.write
    def derive_fit(self,fit_id: str,expected_revision: int) -> dict:
        d=self._get(fit_id);self._cas(d,expected_revision,False)
        _require(d['status']=='OPEN','not open')
        packet=_capture(d['source_url'],d['source_sha256'],self._binding(d,'derive'))
        _require(_canon(packet['data'])==_canon(d['data']),'source snapshot mismatch')
        d['result']=packet['result'];d['last_capture']=packet;d['certificate_capture']=packet;d['certificate_id']=hashlib.sha256(_canon(packet).encode()).hexdigest()
        d['status']='DERIVED';d['revision']=1;d['derived_at']=_now();self._event(d,'DERIVE')
        self.fits[fit_id]=_canon(d)
        return d['result']

    @gl.public.write
    def confirm_fit(self,fit_id: str,expected_revision: int,certificate_id: str) -> None:
        d=self._get(fit_id);self._cas(d,expected_revision,True)
        _require(d['status']=='DERIVED','not ready to confirm')
        _require(isinstance(certificate_id,str) and certificate_id==d['certificate_id'],'wrong certificate')
        # Every valid fit may be confirmed; no generalization promise.
        packet=_capture(d['source_url'],d['source_sha256'],self._binding(d,'confirm'))
        _require(_canon(packet['data'])==_canon(d['data']) and _canon(packet['result'])==_canon(d['result']),'source/result mismatch')
        d['last_capture']=packet;d['status']='CONFIRMED';d['revision']=2;d['confirmed_at']=_now();self._event(d,'CONFIRM')
        self.fits[fit_id]=_canon(d)

    @gl.public.write
    def revoke_fit(self,fit_id: str,expected_revision: int,reason: str) -> None:
        d=self._get(fit_id);self._cas(d,expected_revision,True)
        _require(d['status']!='REVOKED','already revoked')
        _require(isinstance(reason,str) and 1<=len(reason)<=160 and reason==reason.strip(),'bounded reason required')
        d['status']='REVOKED';d['revision']+=1;d['reason']=reason;d['revoked_at']=_now();self._event(d,'REVOKE')
        self.fits[fit_id]=_canon(d)

    @gl.public.view
    def get_fit(self,fit_id: str) -> dict:
        return self._get(fit_id)

    @gl.public.view
    def get_configuration(self) -> dict:
        return {'protocol':'MonotoneDesk-v1','max_rows':16,'max_total_count':100000,'max_source_bytes':16384,'loss_domain':'declared sample only','real_data_verified':False}

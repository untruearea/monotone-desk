"""Verify only the corrected local frontend. No contract changes or live actions.

Requires pnpm11.25.0 on PATH or PNPM_EXECUTABLE. Prior verification evidence is
retained; new logs/report stay beside this script. Python tests are not rerun.
"""
from pathlib import Path
import hashlib,json,os,re,shutil,subprocess
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[1]
FRONT=ROOT/'frontend'
pnpm=os.environ.get('PNPM_EXECUTABLE') or shutil.which('pnpm')
if not pnpm:raise SystemExit('pnpm11.25.0 required; no checks run.')
baseline=json.loads((OUT/'baseline.json').read_text(encoding='utf-8'))
contract=hashlib.sha256((ROOT/'contract.py').read_bytes()).hexdigest()
assert contract==baseline['contract_sha256'],'Contract source must remain unchanged'
report={'scope':'Minimal nohash-before-broadcast and SDK execution-field consistency frontend correction','contract_sha256':contract,'contract_unchanged':True,'genlayer_js':'2.0.0-rc.2','viem':'2.57.7','write_network_chain_id':61999,'view_abi':'SDK decoded dictionary','checks':{},'browser_tested':False,'new_frontend_publication':None,'new_frontend_site_deployment':None,'business_live_verified_by_this_patch':False,'historical_candidate_preserved':True}
for name,args in [('tests',['test']),('build',['build'])]:
    v=subprocess.run([pnpm,*args],cwd=FRONT,capture_output=True,text=True,encoding='utf-8')
    output=re.sub(r'\x1b\[[0-9;]*m','',v.stdout+v.stderr)
    safe=re.sub(r'(?i)(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])','[REDACTED-64HEX]',output)
    (OUT/('frontend-'+name+'.log')).write_text(safe,encoding='utf-8')
    report['checks'][name]={'exit_code':v.returncode,'passed':v.returncode==0,'command':args}
    if name=='tests':
        m=re.search(r'Tests\s+(\d+) passed',output);report['frontend_tests_passed']=int(m[1]) if m else None
    print(name,'PASS' if v.returncode==0 else 'FAIL')
    if v.returncode:print(safe[-3000:].encode('ascii','replace').decode())
files=[]
for part in ('src','tests'):
    files.extend(p for p in (FRONT/part).rglob('*') if p.is_file())
files.extend(p for p in FRONT.iterdir() if p.is_file() and not p.name.startswith('.env'))
report['frontend_inputs']={p.relative_to(FRONT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
report['frontend_input_tree_sha256']=hashlib.sha256(json.dumps(report['frontend_inputs'],sort_keys=True,separators=(',',':')).encode()).hexdigest()
report['public_reference_sha256']=hashlib.sha256((ROOT/'fixtures/studio-constructor-reference.json').read_bytes()).hexdigest()
report['build_artifacts']={p.relative_to(FRONT/'dist').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((FRONT/'dist').rglob('*')) if p.is_file()}
report['log_redaction']='64-hex diagnostic tokens redacted; source/input digests retained in report'
(OUT/'verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
raise SystemExit(0 if all(c['passed'] for c in report['checks'].values()) else 1)

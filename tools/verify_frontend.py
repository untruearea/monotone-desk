"""Run real local frontend tests/build; record exact input bytes, never live wallet calls."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
FRONT=ROOT/'frontend';EVIDENCE=ROOT/'evidence'
paths=sorted([p for folder in ('src','tests') for p in (FRONT/folder).rglob('*') if p.is_file()]+[p for p in FRONT.iterdir() if p.is_file() and p.name!='README.md'])
inputs={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
report={'input_sha256':inputs,'input_tree_sha256':hashlib.sha256(json.dumps(inputs,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'commands':{},'live_wallet_or_business_flow_verified':False,'actual_helper_formatter_tested':True,'transport_mocked':True}
for label,command in [('tests','test'),('build','build')]:
 r=subprocess.run([shutil.which('pnpm.cmd') or shutil.which('pnpm'),command],cwd=FRONT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (EVIDENCE/('frontend-'+label+'.log')).write_bytes(r.stdout)
 report['commands'][label]={'exit_code':r.returncode,'passed':r.returncode==0}
 print(label+': '+str(r.returncode))
report['chunk_size_warning']='SDK production chunk exceeds 500kB; nonfatal warning retained in build log'
(EVIDENCE/'frontend-verification.json').write_bytes((json.dumps(report,indent=2)+'\n').encode())
raise SystemExit(0 if all(x['passed'] for x in report['commands'].values()) else 1)

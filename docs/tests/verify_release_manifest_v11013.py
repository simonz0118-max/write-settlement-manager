#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
from release_manifest_lib_v11013 import production_files
r=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve();m=json.loads((r/'MANIFEST_SHA256.json').read_text(encoding='utf-8'))
expected=set(production_files(r));actual=set(m);missing=sorted(expected-actual);extra=sorted(actual-expected);bad=[]
for p,h in m.items():
 f=r/p
 if not f.is_file():bad.append((p,'MISSING'));continue
 if hashlib.sha256(f.read_bytes()).hexdigest()!=h:bad.append((p,'HASH'))
if missing or extra or bad:
 print('MANIFEST VERIFY FAIL',{'missing':missing[:20],'extra':extra[:20],'bad':bad[:20]});sys.exit(1)
print('MANIFEST VERIFY PASS',len(m))

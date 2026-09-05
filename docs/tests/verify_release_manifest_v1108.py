#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,sys
r=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve();m=json.loads((r/'MANIFEST_SHA256.json').read_text());bad=[]
for p,h in m.items():
 f=r/p
 if not f.is_file():bad.append((p,'MISSING'));continue
 if hashlib.sha256(f.read_bytes()).hexdigest()!=h:bad.append((p,'HASH'))
idx=(r/'index.html').read_text();req={'index.html','assets/release-history.json','src/release-meta.js'}
for x in re.finditer(r'(?:src|href)="([^"]+)"',idx):
 p=x.group(1).split('?',1)[0].split('#',1)[0]
 if p.startswith('./'):p=p[2:]
 if p and not p.startswith(('http:','https:','data:','#')):req.add(p)
for p in (r/'assets').glob('*.xlsx'):req.add(str(p.relative_to(r)))
if (r/'functions').exists():
 for p in (r/'functions').rglob('*'):
  if p.is_file():req.add(str(p.relative_to(r)))
missing=sorted(p for p in req if p not in m)
if bad or missing:print('MANIFEST VERIFY FAIL',{'bad':bad[:10],'missing':missing[:20]});sys.exit(1)
print('MANIFEST VERIFY PASS',len(m))

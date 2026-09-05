#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,sys
r=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve();idx=(r/'index.html').read_text(encoding='utf-8')
paths={'index.html','_headers','_routes.json','assets/release-history.json','src/release-meta.js'}
for m in re.finditer(r'(?:src|href)="([^"]+)"',idx):
 p=m.group(1).split('?',1)[0].split('#',1)[0]
 if p.startswith('./'):p=p[2:]
 if p and not p.startswith(('http:','https:','data:','#')):paths.add(p)
for p in (r/'assets').glob('*.xlsx'):paths.add(str(p.relative_to(r)))
if (r/'functions').exists():
 for p in (r/'functions').rglob('*'):
  if p.is_file():paths.add(str(p.relative_to(r)))
for n in ['_worker.js','worker.js']:
 if (r/n).is_file():paths.add(n)
missing=[p for p in sorted(paths) if not (r/p).is_file()]
if missing:raise SystemExit('MANIFEST source missing: '+','.join(missing))
out={p:hashlib.sha256((r/p).read_bytes()).hexdigest() for p in sorted(paths)}
(r/'MANIFEST_SHA256.json').write_text(json.dumps(out,indent=2,sort_keys=True)+'\n',encoding='utf-8')
print('MANIFEST GENERATED',len(out))

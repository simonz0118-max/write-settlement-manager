#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
from release_manifest_lib_v11012 import production_files
r=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
files=production_files(r)
m={p:hashlib.sha256((r/p).read_bytes()).hexdigest() for p in files}
(r/'MANIFEST_SHA256.json').write_text(json.dumps(m,indent=2,sort_keys=True)+'\n',encoding='utf-8')
print('MANIFEST GENERATED',len(m))

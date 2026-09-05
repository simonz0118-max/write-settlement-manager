#!/usr/bin/env python3
from pathlib import Path
import subprocess,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else '.');bad=[]
for p in sorted(root.rglob('*.js')):
    if '.git' in p.parts or 'node_modules' in p.parts:continue
    q=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
    if q.returncode:bad.append((str(p),q.stderr[-1200:]))
if bad:
    for p,e in bad:print('JS SYNTAX FAIL',p,e)
    sys.exit(1)
print('V11.1.0 ALL JS SYNTAX PASS')

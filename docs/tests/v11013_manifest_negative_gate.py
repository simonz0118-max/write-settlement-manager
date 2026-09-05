#!/usr/bin/env python3
from pathlib import Path
import subprocess,sys
root=Path('.').resolve()
template=next(iter((root/'assets').glob('*.xlsx')),root/'docs/fixtures/2026-08-13-order-100-reviewed-cn.xlsx')
candidates=[('index',root/'index.html'),('worker',root/'src/workers/import.worker.bundle.js'),('template',template),('rules',root/'src/knowledge-base.js')]
for label,p in candidates:
 if not p.is_file():raise SystemExit(f'negative fixture missing {label}: {p}')
 bak=p.read_bytes()
 try:
  p.write_bytes(bak+b'\nV11013_NEGATIVE\n')
  rc=subprocess.run([sys.executable,'docs/tests/verify_release_manifest_v11013.py','.'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode
  if rc==0:raise SystemExit(f'negative gate did not catch {label}')
 finally:p.write_bytes(bak)
subprocess.check_call([sys.executable,'docs/tests/verify_release_manifest_v11013.py','.'])
print('V11.0.13 MANIFEST NEGATIVE GATES PASS')

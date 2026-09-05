#!/usr/bin/env python3
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
required=[
'docs/tests/idb-lite-v11010.cjs',
'docs/tests/v11010_kb_dedupe_persistence_e2e.cjs',
'docs/tests/v11010_production_replay_smoke.cjs',
'docs/tests/idb-lite-v11013.cjs',
'docs/tests/v11013_manifest_cas_behavior.cjs',
'docs/tests/v11013_ooxml_row_contract.cjs',
'docs/tests/v11013_browser_x07_e2e.cjs',
'docs/tests/v11013_verify_export.py',
'docs/tests/v11013_payment_negative_gate.py',
'docs/tests/v11013_all_js_syntax.py',
'docs/tests/release_manifest_lib_v11013.py',
'docs/tests/generate_release_manifest_v11013.py',
'docs/tests/verify_release_manifest_v11013.py',
'docs/tests/v11013_manifest_negative_gate.py',
'docs/tests/v11013_current_contract.cjs',
'docs/fixtures/stage-a-cn-unknown-orders-seed-0x1041E2E.xlsx',
'docs/fixtures/2026-08-13-order-100-reviewed-cn.xlsx',
]
missing=[p for p in required if not (root/p).is_file()]
if missing:
 print('V11.0.13 GATE DEPENDENCY AUDIT FAIL',missing);sys.exit(1)
print('V11.0.13 GATE DEPENDENCY AUDIT PASS',len(required))

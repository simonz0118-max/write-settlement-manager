# V7.0.3 Import Worker Real-Workbook Regression

Runtime tested directly against `src/workers/import.worker.bundle.js`.

## FACT-10063
- FACT sheet: detected
- FACT rows: 69
- Order sheet `17506-20313`: detected
- Imported raw order rows: 2,809
- PASS

## FACT-10102
- FACT sheet: detected
- FACT rows: 79
- Order sheet `20314-24651`: detected
- Imported raw order rows: 4,462
- PASS

## FACT-10441 & 10442
- `1-FACT-CN`: detected as FACT, 129 rows
- `28003-28706 CN 526`: imported, 784 rows
- `2-FACT-FR`: detected as FACT, 31 rows
- `28003-28706 FR`: imported, 254 rows
- Non-order admin sheets ignored
- Total imported raw rows: 1,038
- PASS

## FACT-10066 Cmd Pro
- Workbook contains only one `FACT` sheet
- FACT rows: 4
- Order sheets: 0
- Orders: 0
- Expected UI behavior: explicit FACT-only warning, not successful zero-order settlement
- PASS

## Root-cause guards
- Only one `scoreOrderHeader()` implementation: PASS
- Only one `isOrderHeader()` implementation: PASS
- No runtime `REQUIRED_HEADERS`: PASS
- No runtime `ORDER_HEADERS.reduce`: PASS
- Worker URL not `v=6.5.8`: PASS
- Worker unique cache fingerprint: PASS
- CN canonical FACT retained: PASS
- FACT completeness audit retained: PASS

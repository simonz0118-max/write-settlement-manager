# TEST RESULTS — v6.5.5

## FACT backfill regression
Reference workbook: `FACT- 10102_write-store_13_12_25(20314-24651).xlsx`

- [x] FACT sheet detected and parsed
- [x] Existing Quantity / Amount statistics replaced from current WebApp order analysis
- [x] Existing COGs / Shipping / COGs + Shipping unit-cost rules preserved
- [x] FACT total amount cells updated after recalculation
- [x] Original FACT style map preserved: 952 / 952 styled cell references unchanged
- [x] All 25 non-FACT XLSX package entries remained byte-identical in the regression output
- [x] Patched XLSX passes ZIP integrity validation
- [x] Source order worksheet remains untouched

Example regression values from the reference template:
- FRANCE / Stylo eternel X1: Quantity 1463 -> 1489
- FRANCE / Stylo eternel X2: Quantity 84 -> 197
- Gravure Personnalisée: Quantity 6095 -> 6047
- Coffret Cadeau (with pencil orders): Quantity 3509 -> 3441
- Coffret Cadeau (standalone): Quantity 7 -> 10
- Recalculated FACT total: EUR 62,403.24

## Export package
- [x] Professional accounting workbook remains part of the export
- [x] FACT-filled source workbook(s) are exported together with the accounting report
- [x] Delivery ZIP writer validated with CRC and ZIP integrity test
- [x] XLSX files imported from an outer ZIP are retained as Blob references for FACT-preserving export

## Static checks
- [x] `src/app.bundle.js` passes `node --check`
- [x] `src/workers/import.worker.bundle.js` passes `node --check`
- [x] `src/workers/import.worker.js` passes `node --check`
- [x] Release version synchronized to v6.5.5
- [x] CHANGELOG / README / RELEASE / GitHub / Cloudflare script messages synchronized

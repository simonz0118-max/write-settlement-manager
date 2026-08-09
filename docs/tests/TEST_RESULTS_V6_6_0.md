# V6.6.0 Mandatory FACT Delivery Test

## Export policy
- Workbook with FACT -> patched FACT: PASS
- Workbook without FACT -> generated FACT: PASS
- Mixed workbooks -> one FACT deliverable per workbook: PASS
- Export always packages accounting report + FACT deliverables: PASS

## Generated FACT
- groups by source workbook: PASS
- groups by country + product + SKU: PASS
- Quantity is numeric: PASS
- COGs / Shipping stay numeric and are not fabricated: PASS
- missing cost clearly marked: PASS
- currency column present: PASS

## Release synchronization
- index data-release: PASS
- CSS/JS cache version: PASS
- release metadata: PASS
- history entry: PASS
- CHANGELOG / README / RELEASE / publish script: PASS

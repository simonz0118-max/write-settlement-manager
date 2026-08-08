# WRITE Settlement Manager v6.5.8 — Test Results

Release: 2026-08-09 00:14 (Europe/Paris)

## Real FACT regression sample
Input: FACT_已回填_FACT- 10192_write-store_04_02_26(26172-26532).xlsx

- Found 32 numeric-looking cells in FACT columns D:H that were physically stored as shared-string text instead of XLSX numbers.
- Examples: F19="27.19", E20="7.65", F23="38.82".
- V6.5.8 normalizes COGs (E), Shipping (F), and non-formula Unit Total (G) to true numeric cells when rebuilding FACT.
- Quantity (D) and Amount (H) continue to be rebuilt as true numeric cells.
- Existing G formulas are preserved rather than replaced by static values.
- Original cell styles/positions are preserved by reusing the existing cell attributes while removing only the text type marker.

## Naming regression
- Source workbook filename contains explicit range: (26172-26532).
- Export range extraction prioritizes the explicit workbook batch range over unrelated historical/reference IDs inside the workbook.
- Expected package: WRITE_结算交付包_26172-26532_YYYY-MM-DD.zip
- Expected report: WRITE_会计结算_26172-26532_YYYY-MM-DD.xlsx
- Expected FACT: FACT_已回填_26172-26532_<original filename>.xlsx

## Numeric-format rule
- Human-visible decimal separator: comma (French/European presentation).
- XLSX machine storage: true numeric cells, not comma-containing text strings.
- This preserves SUM / + / - / * / / and other Excel calculations.

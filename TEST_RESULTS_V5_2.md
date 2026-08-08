# WRITE Settlement Manager V5.2 — FACT Export Upgrade

## Goal
Make the exported settlement workbook contain a FACT-style classification summary using the same semantic columns as the original FACT worksheet.

## Reference FACT structure
Columns mirrored in the new export:
- No
- Description
- Quantity
- COGs (€)
- Shipping (€)
- COGs + Shipping (€)
- Amount (€)

## V5.2 changes
- `00_FACT分类汇总` now starts with a global FACT-style category summary.
- Category rows are normalized and naturally sorted (Stylo eternel X1, X2, X3 ... then upsell/accessory categories).
- For categories aggregated across countries/files:
  - Quantity = sum of FACT quantities
  - COGs (€) = quantity-weighted average unit COGs
  - Shipping (€) = quantity-weighted average unit shipping
  - COGs + Shipping (€) = quantity-weighted average unit combined cost
  - Amount (€) = sum of original FACT Amount (€)
- A FACT cross-check block shows total quantity, COGs amount, shipping amount, FACT amount, and residual difference.
- The same sheet then reproduces original FACT detail grouped by country/region.
- FACT rows remain excluded from order import; they are used only for cost/statistical reporting.

## Code validation
- `src/app.js`: `node --check` passed.
- `src/lib/xlsxWriter.js`: `node --check` passed.
- `src/workers/import.worker.js`: `node --check` passed.

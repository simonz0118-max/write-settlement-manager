# NEOVORA Inventory Manager

Cloudflare Pages + Pages Functions + D1 inventory manager, aligned with the existing WRITE settlement app deployment model.

## Cloudflare Pages
- Git repository: `simonz0118-max/write-settlement-manager`
- Root directory: `inventory-manager`
- Production branch: `main`
- Build command: leave blank / `exit 0`
- Build output directory: `.`
- Pages Functions: included under `/functions`
- D1 binding: `INVENTORY_DB` -> existing `write-settlement-rules` database. Inventory tables are isolated with `inv_*` names.

## Features
- Import Excel stock sheet (`9月1日盘点`)
- Manual stock-in
- Shipment / stock-out with stock validation
- Add tracking number later
- Shipment/transaction history in Cloudflare D1
- Export by patching the original XLSX XML instead of rebuilding the workbook
- `D` column outbound quantities are updated; `E` formulas remain in the original template
- A `发货汇总` worksheet is added/updated because the supplied source workbook has no tracking-number column

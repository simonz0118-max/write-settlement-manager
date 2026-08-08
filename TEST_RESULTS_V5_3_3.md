# V5.3.3 Accounting export validation

- Export workbook architecture changed to one accounting purpose per worksheet.
- `00_结算总览` contains only the key financial summary table.
- `01_FACT分类汇总` contains only FACT category aggregation.
- `02_订单会计分类` contains only order accounting classification.
- All 20 workbook cell styles use horizontal + vertical center alignment.
- No right-aligned workbook styles remain.
- Long-text columns enlarged instead of relying on narrow wrapped cells.
- Currency / integer / percent number formats retained.
- Frozen headers, filters, totals and landscape printing retained.
- Generated XLSX smoke test passed ZIP integrity validation (`testzip = None`).
- `app.bundle.js` and import worker both pass `node --check`.

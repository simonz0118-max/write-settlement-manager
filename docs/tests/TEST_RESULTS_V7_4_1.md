# V7.4.1 required release gates

- exportAccounting has no PENCIL_V1 branch
- exportAccounting has no factCompletenessAudit call
- exportAccounting has no UNMAPPED_PRODUCT hard stop
- exportAccounting has no buildGeneratedPencilFactWorkbook call
- every source workbook calls buildGeneratedFactWorkbook
- Universal builder uses FACT_TEMPLATE_UNIFIED_V1.xlsx
- fallback preserves source country/product/SKU/quantity
- unknown price is blank

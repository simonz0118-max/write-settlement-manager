# WRITE Settlement Manager v3.0 — Validation

Validation source: real `铅笔(1).zip` order archive supplied by the user.

## Import / classification regression
- Unique orders: 12,691
- Total order amount: €591,722.65
- Review orders: 48
- Unknown product lines: 48
- Free/gift quantity: 11,986
- Full real-archive parse/classification runtime in test environment: 34.12 s
- Large-file streaming XLSX parser: unchanged from Milestone 1 and regression-tested through the full archive.
- FACT filtering remains sheet-level rather than workbook-level.

## v3 UI validation
- Dashboard, orders, products, review, imports, and export are separate views; long single-page scrolling removed.
- Success completion explicitly clears any previous import error state.
- Re-import flow clears the current state and reopens file selection after confirmation.
- Clear-data flow has a separate destructive confirmation dialog.
- Static server smoke test passed.
- All JavaScript element-ID references resolve in the final HTML.

## Excel export validation
- Generated XLSX opened successfully with openpyxl.
- Summary title and description rows merge correctly.
- Freeze panes verified.
- AutoFilter ranges verified.
- EUR number format verified on accounting and order amount columns.

# V7.0.10 Stable FACT Template Locator Regression

Embedded CN template:
- actual sheets: [('FACT-CN', 'rId1', 'worksheets/sheet1.xml')]
- selected FACT sheet: FACT-CN
- selected worksheet path: xl/worksheets/sheet1.xml

Runtime:
- exact FACT-CN name no longer required: PASS
- workbook relationship parsing: PASS
- single-sheet fallback: PASS
- worksheet path existence guard: PASS
- generated FACT Blob non-empty guard: PASS
- V7.0.9 dynamic learning retained: PASS
- dynamic FACT append retained: PASS
- JS syntax: PASS

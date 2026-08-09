# V7.0.11 CN FACT Generation Root-Cause Regression

Embedded template verified:
- display sheet: FACT-CN
- physical worksheet: xl/worksheets/sheet1.xml
- relationship target: worksheets/sheet1.xml
- sheetData present: PASS

Runtime:
- direct canonical path first: PASS
- namespace-prefixed Relationship fallback: PASS
- archive.get existence check: PASS
- no archive.has call: PASS
- sheetData pre/post guard: PASS
- generated XLSX Blob non-empty guard: PASS
- generated ZIP signature guard: PASS
- dynamic FACT learning retained: PASS
- JS syntax: PASS

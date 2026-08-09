# V6.6.1 Learned FACT Template Test

- Embedded canonical FACT template exists: PASS
- Auto FACT clones XLSX archive instead of buildXlsx custom layout: PASS
- Original template style/theme/media/drawing entries preserved: PASS
- Dynamic data rows use learned template style IDs: PASS
- Total row uses SUM(H12:Hn): PASS
- COGs-only calculation H=D*E: PASS
- Shipping-only calculation H=D*F: PASS
- COGs+Shipping calculation G=E+F, H=D*G: PASS
- Direct unit cost calculation H=D*G: PASS
- Missing costs remain blank: PASS
- Currency header adapted without style replacement: PASS
- Payment block shifts with dynamic row count: PASS
- Release/history/changelog synchronized: PASS

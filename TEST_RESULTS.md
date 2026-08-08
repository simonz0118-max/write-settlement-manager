# Milestone 1 Validation Results

Validation date: 2026-08-07

Test source: the user-supplied `铅笔(1).zip` and the real `.xlsx` workbooks inside it.

## Full ZIP acceptance test

The dependency-free browser parser was executed under Node.js 22 using the same `Blob`, `DecompressionStream('deflate-raw')`, ZIP reader, XLSX streaming parser, schema detection, and deduplication code used by the Web Worker.

Results:

- XLSX workbooks found in ZIP: **21**
- `FACT` sheets ignored: **21**
- Real order sheets imported: **10**
- Non-order/helper sheets ignored: **4**
- Raw rows accepted as order rows: **13,085**
- Duplicate order IDs removed: **394**
- Unique orders after deduplication: **12,691**
- Full ZIP elapsed time in the container test: **34.81 s**
- Maximum resident memory in the Node test process: **634,608 KB**
- Exit status: **0**

Imported real-order sheet row counts:

| Sheet | Rows accepted |
| --- | ---: |
| 26807-27159 | 366 |
| 20314-24651 | 4,462 |
| 27160-27445 | 299 |
| 27446-27637 | 202 |
| 27638-28002 | 370 |
| 26533-26806 | 273 |
| 15224-17505 | 2,280 |
| 17506-20313 | 2,809 |
| 24652 - 26171 | 1,612 |
| 26172-26532 | 412 |

## Pathological large-workbook test

Workbook:

`FACT- 10034_write-store_15_11_25(15224-17505).xlsx`

Observed structure:

- XLSX file size: approximately **150.8 MB**
- `xl/worksheets/sheet2.xml` uncompressed size: **1,305,316,645 bytes**
- `FACT` sheet: ignored without inflating it for order import
- Real order sheet: `15224-17505`
- Rows accepted before deduplication: **2,280**
- Duplicate order IDs removed within the workbook: **6**
- Unique orders: **2,274**
- Elapsed time in the container test: **29.65 s**
- Maximum resident memory in the Node test process: **562,204 KB**
- Exit status: **0**

The important acceptance result is that the importer completed without creating a 1.305 GB worksheet string/document in memory and without the prior `out of memory: line 1, column 0` failure.

# WRITE Settlement Manager
> Current release: **V7.1.8** — 中文正式升级包、UTF-8 文件名校验、GitHub/Cloudflare 稳定发布。
> V7.1.8 已用 FACT-10063 / FACT-10102 / FACT-10441&10442 / FACT-10066 真实工作簿完成 Import Worker 回归测试。

## Current release — v7.1.8

## v7.1.6 — 2026-08-09 00:14 (Europe/Paris)

- 修复 FACT / Commercial Invoice 中部分小数被保存为文本、导致 Excel 公式无法计算的问题。
- FACT 的 COGs / Shipping / 非公式 Unit Total 会强制写成真正的数值单元格；显示仍遵循法国/欧洲小数逗号。
- 导出交付包、专业会计表和回填 FACT 文件名自动包含本批订单号范围。


### V7.1.8 highlights
- Built-in version history page in the left navigation, available before order import.
- Release timeline shows update time and concise notes for every traceable formal release.
- All visible decimals use the French/European comma decimal separator.
- WebApp and professional accounting Excel exports use consistent French numeric presentation.
- FACT preserves its original formatting while statistical values are refreshed.

- Release notes now appear once per new version in each browser.
- Auto / Light / Dark theme control remains available and persistent.
- `CHANGELOG.md` is now mandatory for every release.
- Version text is synchronized across UI, Git commits, Cloudflare deployment messages, and release metadata.

See [CHANGELOG.md](./CHANGELOG.md) for full history.

## Milestone 1 — Stable real-order import

This version is built against the real WRITE workbooks supplied in `铅笔(1).zip`.

### Implemented

- Accept `.xlsx` directly or a `.zip` containing multiple `.xlsx` files.
- `FACT` is ignored at **sheet level**. A workbook can contain `FACT` on page 1 and real orders on page 2; only `FACT` is skipped.
- Real order sheets are detected from the actual WRITE Chinese header schema (`订单号`, `订单金额`, `产品总数`, `产品名称`, `收货人国家`, etc.), not merely by filename or sheet position.
- Non-order / helper / B2B sheets that do not match the real-order schema are ignored with a visible reason.
- Orders are normalized into one model and deduplicated by order number.
- Import work runs inside a Web Worker so the UI stays responsive.
- No source files are uploaded to a backend; processing is local in the browser.

### Critical OOM fix

The supplied file:

`FACT- 10034_write-store_15_11_25(15224-17505).xlsx`

is ~150.8 MB on disk, but its `xl/worksheets/sheet2.xml` expands to roughly **1.305 GB**. The worksheet dimension reaches `XFD2281`, which is a classic XML-bloat pattern. Loading that worksheet as one XML string is what triggers errors such as:

`out of memory: line 1, column 0`

Milestone 1 does **not** load the whole worksheet XML into memory. It reads the ZIP central directory, inflates only required XLSX entries, streams order-sheet XML row by row, and discards all columns after P before cell parsing. FACT, media, styles, drawings and other irrelevant entries are never inflated for order import.

### Run locally on macOS

No npm install is required.

```bash
cd write-settlement-manager
python3 -m http.server 4173
```

Open:

`http://localhost:4173`

Then drag in `铅笔(1).zip` or individual `.xlsx` files.

> Do not double-click `index.html` with `file://`; module Web Workers need an HTTP origin.

### Browser requirement

Use a current Chrome, Edge or Safari version with `DecompressionStream('deflate-raw')` support.

### Deploy

This is a static web app. The repository root can be deployed directly to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any static server. No build command is needed.

### Milestone 1 acceptance criteria

1. ZIP and multiple XLSX inputs are accepted.
2. `FACT` is ignored even when the same workbook contains real orders on another sheet.
3. Real order sheets are detected by schema.
4. FACT-only files create zero orders.
5. Orders are normalized and deduplicated by order number.
6. The 150 MB / 1.3 GB-expanded workbook does not require a 1.3 GB in-memory XML document.
7. UI shows imported/ignored sheets and a searchable order preview.

## Next

Milestone 2: accountant classification rules, SKU/product mapping, COGS/shipping matching, reconciliation, grouped statistics, and export of the accountant-classified Excel workbook.


## v4.1
- Rebuilt the original white-line side-profile panda mark for stronger panda recognition.
- Professional six-sheet accounting export structure retained and validated.

### V6.5.5 highlights
- Rebuild FACT values from the current WebApp analysis at export time.
- Preserve the original FACT formatting; only statistical cell values are replaced.
- Export an accounting delivery package containing the professional report and FACT-filled source workbooks.

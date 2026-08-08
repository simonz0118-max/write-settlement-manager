# CHANGELOG

## v6.5.6 — 2026-08-09

### Changed
- 全部用户可见小数统一采用法国/欧洲数字格式：小数分隔符使用 `,`，千位使用空格。
- WebApp 金额、百分比、处理耗时、文件大小等统一改为 `fr-FR` 格式化。
- 专业会计 Excel 的货币与百分比单元格保留数值类型，并指定法国区域格式。
- FACT 回填继续只更新数值，不改变原有格式；原模板中的计算逻辑和可计算数值类型继续保留。

### Examples
- `18419.33` → `18 419,33`
- `12.5%` → `12,5 %`
- `3.75 €` → `3,75 €`

## v6.5.5 — 2026-08-08

### Added
- FACT 原格式回填引擎：以用户导入的原始 FACT 工作表作为模板，仅更新统计数值。
- FACT 已有数据时，导出前清空旧的 `Quantity` / `Amount (€)` 统计值并按 WebApp 当前分析结果重新计算。
- FACT 没有统计数据时，同样按识别到的模板分类行自动填入。
- 导出改为结算交付包：包含专业会计统计工作簿，以及每个带 FACT 页的原始工作簿回填副本。
- 支持从 ZIP 导入时保留内部 XLSX 原始工作簿，以便导出时回填 FACT。

### FACT calculation rules
- `Stylo eternel Xn`：按国家/地区，统计每个订单中铅笔数量为 n 的订单数。
- `Lot de 4 mines rechargeables UPSELL`：按国家统计普通笔芯数量。
- `Lot de 6 Mines colorées UPSELL`：按国家统计 Pack 6 彩色笔芯数量。
- `Mines colorées UPSELL`：按国家统计非 Pack 6 彩色笔芯数量。
- `Gravure Personnalisée`：统计工作簿内雕刻数量。
- `Coffret Cadeau`：按“随铅笔订单 / 独立礼盒订单”分配到模板中对应礼盒成本行。
- `Amount (€)`：沿用 FACT 模板中原有 `COGs + Shipping (€)` 单价规则重新计算。
- FACT 汇总总额单元格同步更新。

### Preserved
- FACT 原有字体、字号、对齐、填充、边框、列宽、行高、合并单元格和工作簿其他内容保持不变。
- 自动 / 浅色 / 深色主题切换和版本更新日志首次弹窗机制继续保留。


All notable changes to WRITE Settlement Manager are recorded here.

## v6.5.4 — 2026-08-08

### Added
- Added a release-notes modal that appears once per new version in each browser.
- Added local read-state persistence so the same version does not show again after acknowledgement.
- Added `CHANGELOG.md` as a required release artifact.

### Improved
- Preserved automatic / light / dark theme modes with real-time system theme following.
- Unified version numbers across UI, README files, Git commit messages, Cloudflare deployment messages, and release metadata.
- Made the release-notes modal responsive for desktop, iPad, and iPhone.

### Release policy
- Every future release must update `CHANGELOG.md`, `README.md`, `README_CN.md`, `RELEASE.txt`, and deployment script version text.
- A new application version automatically triggers the release-notes modal once in the same browser.

## v6.5.2 — 2026-08-08

### Added
- Added three-state theme control: Auto, Light, Dark.
- Auto mode follows macOS / iPadOS / iOS color-scheme changes without refresh.
- Manual theme preference is stored locally in the browser.

## v6.5.1 — 2026-08-08

### Changed
- Replaced the top-left mark with the selected Version C minimalist panda head.
- Changed the top-center credit to `Designed by NEOVORA`.
- Simplified the hero description to focus on order recognition and accounting classification export.

## v6.5 — 2026-08-08

### Changed
- Removed the panda photo/head from the hero area.
- Rebuilt the hero visual as a monochrome accounting/report illustration.
- Continued the grayscale oMLX-inspired visual language.

## v6.1 — 2026-08-08

### Changed
- Rebuilt the UI into a strict black/white/gray workbench visual system.
- Removed colored accents from navigation, cards, buttons, badges, and dialogs.

## v6.0 — 2026-08-08

### Added
- Responsive layouts for desktop, iPad landscape/portrait, and iPhone Safari.
- Touch-friendly horizontal table scrolling and mobile-safe form sizing.

### Fixed
- Prevented KPI, amount, filename, product, and table text from overflowing containers.

## v5.3.3 — 2026-08-08

### Changed
- Rebuilt accounting export into one-purpose-per-sheet professional workbook structure.
- Centered accounting workbook typography and improved widths, freezes, filters, and monetary formats.

## v5.3.2 — 2026-08-08

### Fixed
- Removed fragile ES-module startup dependencies by bundling the main UI logic and worker logic.

## v5.3.1 — 2026-08-08

### Fixed
- Fixed a JavaScript parsing error that prevented the entire UI event layer from starting.

## v5.3.0 — 2026-08-08

### Added
- Made pending-review rows editable and saveable before final export.
- Rebuilt clear-data confirmation behavior.

### Changed
- Redesigned accounting summary to show sales, FACT cost, estimated gross profit, and gross margin first.

## v5.2 — 2026-08-08

### Added
- Added FACT-style category summary with Quantity, COGs, Shipping, unit cost, and Amount.
- Added country-level FACT detail sheets.

## v5.1 — 2026-08-08

### Fixed
- Fixed styled-empty-cell alignment issues in FACT parsing.
- Enabled reliable FACT cost extraction while still excluding FACT pages from real-order import.

## v5.0 — 2026-08-08

### Changed
- Introduced the hero-page export action and first major visual redesign.
- Reorganized accounting workbook output into summary, detail, review, audit, and import-log layers.

## v4.1 — 2026-08-08

### Added
- Established the stable local-browser import pipeline for real WRITE order workbooks.
- Added Cloudflare Pages deployment workflow and GitHub repository publishing scripts.
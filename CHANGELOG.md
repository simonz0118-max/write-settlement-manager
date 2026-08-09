## v6.6.0 — 2026-08-09 16:31 (Europe/Paris)
- 新增“强制 FACT 交付”机制：每个订单工作簿导出时都必须对应一份 FACT。
- 源工作簿已有 FACT：继续保留原格式，清空旧统计并重新回填。
- 源工作簿没有 FACT：自动创建 `FACT_自动生成_订单范围_源文件.xlsx`。
- 自动生成 FACT 按工作簿、国家/地区、商品名称 + SKU 汇总 Quantity。
- COGs / Shipping 没有可靠来源时不编造成本，保持数值 0 并明确标记“待补成本（源工作簿无 FACT）”。
- 专业会计报表的 FACT 汇总同步包含自动生成的 FACT 数据。
- 正式导出统一为 `WRITE_结算交付包_订单范围_日期.zip`，内含会计报表及每个工作簿的 FACT。
- 更新首次弹窗、历史更新、README、RELEASE、中文升级脚本及版本一致性测试。

## v6.5.14 — 2026-08-09 13:28 (Europe/Paris)
- 修复顶部 KPI 大数字自动换行的问题，金额与货币符号保持同一行。
- KPI 数字采用 `white-space: nowrap` + 响应式字号策略，数字越长只缩小字号，不再换行。
- 优化桌面、iPad、iPhone 下的大金额、订单数和商品件数显示。
- 同步更新网页首次更新弹窗、历史更新、CHANGELOG、README、RELEASE 和发布脚本版本。

## v6.5.13 — 2026-08-09 12:30 (Europe/Paris)
- 修复 WebApp 当前版本、首次更新弹窗、历史更新页面与静态资源版本号不同步的问题。
- 新增 `src/release-meta.js` + `assets/release-history.json` 作为统一版本数据源。
- 补齐 v6.5.9、v6.5.10、v6.5.11、v6.5.12 的历史更新记录。
- 首次更新弹窗改为按版本独立 localStorage key，确保每个新版本只弹一次。
- `index.html` 的 `data-release`、CSS/JS cache-busting、左上角版本、历史更新当前版本统一为 v6.5.13。
- 发布前加入版本一致性测试，要求 CHANGELOG、README、README_CN、RELEASE、网页 metadata、部署脚本全部一致。

## v6.5.12 — 2026-08-09 12:20 (Europe/Paris)
- 正式发布包恢复中文升级入口与中文升级说明。
- 新增 `一键更新到GitHub并部署Cloudflare.command`、`本地预览.command`、`升级说明_请先看.txt`。
- 中文文件名统一使用 UTF-8 ZIP 元数据，并加入打包后文件名完整性校验，避免 macOS 解压乱码。
- 一键发布继续使用“clone 最新 GitHub main → 同步当前版本 → commit/push → Cloudflare”流程，避免 `fetch first`。
- 正式包继续保持 Clean Package：根目录不堆放历史测试文件，测试记录统一存放于 `docs/tests/`。
- 网页历史更新、首次打开更新弹窗、CHANGELOG、README、RELEASE 和部署终端版本信息统一为 V6.5.12。

## v6.5.11 — 2026-08-09 12:15 (Europe/Paris)
- 修复一键发布脚本在 GitHub 远端 `main` 已更新时出现 `fetch first` / non-fast-forward 拒绝的问题。
- 正式发布包不再携带任何 `.git` 历史或本地 Git 状态。
- 发布流程改为：临时 clone 最新 GitHub main → 同步当前版本文件 → commit/push → Cloudflare Pages。
- 保持 Clean Package 目录规范和既有业务功能不变。

## v6.5.10 — 2026-08-09 12:10 (Europe/Paris)
- 重构发布 ZIP 目录，根目录只保留运行、源码与发布所需文件。
- 历史测试记录统一移动到 `docs/tests/`，避免根目录杂乱。
- 所有可执行脚本改为 ASCII 文件名：`publish.command`、`preview.command`，彻底避免 macOS 解压中文文件名乱码。
- 清理重复/乱码 `.command` 文件与重复部署说明。
- 保留 v6.5.9 的深色待复核页面修复及现有业务逻辑。

## v6.5.9 — 2026-08-09 12:06 (Europe/Paris)
- 修复深色模式下「待复核」页面错误使用白色行背景的问题。
- 待复核列表、输入框、下拉框、标签、按钮统一继承当前黑白主题。
- 保持纯黑白/灰阶视觉，不引入其他强调色。
- 延续 v6.5.8 的 Excel 真数值写入、小数逗号显示与订单号范围命名规则。

# CHANGELOG

## v6.5.8 — 2026-08-09 00:14 (Europe/Paris)

### Fixed
- 修复 FACT / Commercial Invoice 中部分 COGs、Shipping 等小数来自 sharedStrings、实际为文本而导致公式无法计算的问题。
- 回填 FACT 时将 E/F/G/H 所需数值规范为真正的 XLSX 数字单元格；公式单元格继续保留公式。
- 数值底层保持数字类型，法国/欧洲界面显示继续使用小数逗号，避免为显示逗号而把数字写成文本。

### Improved
- 导出 ZIP 自动加入订单号范围，例如 `WRITE_结算交付包_26172-26532_2026-08-09.zip`。
- ZIP 内专业会计报表与回填 FACT 文件名同步加入同一订单号范围。
- 文件名日期改用浏览器本地日期，避免午夜时 UTC 日期比法国本地日期少一天。

## v6.5.7 — 2026-08-09 00:10 (Europe/Paris)

### Added
- 左侧导航新增 `历史更新` 页面，无需导入订单即可访问。
- 内置版本时间线，按最新到最旧展示版本号、更新时间与简要更新日志。
- 自 v6.5.7 起，发布时间固定精确记录到分钟；早期无法可靠还原分钟的版本明确标记为“时间未记录”。

### Release policy
- 历史更新页、`CHANGELOG.md`、`README.md`、`README_CN.md`、`RELEASE.txt` 和发布脚本必须在每次版本发布时同步更新。

## v6.5.6 — 2026-08-09 00:05 (Europe/Paris)

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

## v5.2.2 — 2026-08-08

### Fixed
- Rebuilt the page layer from the correct V5 hero baseline after mixed old/new UI assets caused layout regressions.
- Removed preloaded confirmation modal behavior that could lock the page and stabilized versioned front-end assets.

## v5.2.1 — 2026-08-08

### Fixed
- Fixed CSS overriding the `hidden` state of the clear-data confirmation modal.
- Added startup protection so the modal remains closed until explicitly requested.

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
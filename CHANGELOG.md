## v7.0.11 — 2026-08-09 19:42 (Europe/Paris)
- 根因确认：CN 模板 `workbook.xml.rels` 使用 `<ns0:Relationship>`，旧解析器仅识别 `<Relationship>`，因此无法解析 `rId1 → worksheets/sheet1.xml`。
- CN 标准模板优先使用发布时已验证路径 `xl/worksheets/sheet1.xml`，运行时不再依赖 XML 正则发现。
- 备用 XML 解析同时支持 namespace 前缀与单双引号属性。
- 删除不存在的 `archive.has()`，统一使用 `archive.get()`。
- 增加 worksheet `sheetData`、生成 Blob、XLSX ZIP 签名三层校验。
- 保留 V7.0.9/10 的国家×商品自动学习、动态 FACT、数量守恒和导出中心。

## v7.0.10 — 2026-08-09 19:45 (Europe/Paris)
- 修复 CN FACT 模板工作表定位：不再要求显示名必须精确等于 `FACT-CN`。
- 改为解析 `workbook.xml` 与 `workbook.xml.rels`，优先寻找名称含 `FACT` 的工作表；单工作表 CN 模板直接作为 FACT。
- CN FACT 写入前验证 worksheet path 存在。
- CN FACT Excel 重建后验证生成 Blob 非空。
- 保留国家×商品自动学习、动态 FACT 行、数量守恒、会计 Excel 与完整 ZIP 导出中心。

## v7.0.9 — 2026-08-09 19:20 (Europe/Paris)
- 新增缺失 `国家 × 商品` 自动学习：CN FACT 历史不存在的组合不再阻断导出。
- 当前订单金额按收费商品数量分摊，自动推导缺失组合单位 FACT 价格；按用户要求价格准确性不作为阻断条件。
- 自动学习价格保存到浏览器 `write-auto-fact-price-rules-v1`。
- 动态缺失组合直接追加到 `FACT-CN` 工作表，并填写 Quantity、单位价格、COGs+Shipping、Amount。
- `NO_FACT_TARGET` / 价格缺失不再作为硬错误；仅 `UNMAPPED_PRODUCT` 继续阻止导出。
- 会计 FACT 汇总同步纳入动态学习行。
- 更新首次弹窗、历史更新、README、RELEASE 与中文部署脚本。

## v7.0.8 — 2026-08-09 18:36 (Europe/Paris)
- 重写 CN FACT 数据聚合和完整性审计，移除 FACT 导出路径中的通用 `key` 变量。
- 使用 `bucketId` / `targetId` / `targetType` 明确统计标识，修复 `key is not defined`。
- CN FACT 审计与 CN FACT 文件写入拆分为独立异常边界。
- 导出中心异常时显示 JavaScript stack 前三行。
- 会计 Excel 独立下载、CN 唯一模板、数量守恒和零遗漏审计全部保留。

## v7.0.7 — 2026-08-09 18:30 (Europe/Paris)
- 导出改为固定“导出中心”，不再依赖异步流程结束后的自动下载。
- 第一步同步生成会计 Excel 并创建手动下载链接。
- CN FACT / 其他 FACT 分别生成独立下载链接。
- 最后再生成完整 ZIP 下载链接；ZIP 失败不会影响已经生成的 Excel/FACT。
- 导出阶段与错误永久显示在导出中心，直到用户手动关闭。
- 保留 CN 唯一 FACT 模板、数量守恒、零遗漏审计及会计分类统计四列对齐。

## v7.0.6 — 2026-08-09 18:17 (Europe/Paris)
- 会计分类统计固定为四列网格：分类 / 订单数 / 金额 / 占比，所有数字统一右对齐。
- 导出增加固定悬浮状态：会计报表 → CN FACT → 完整性审计 → ZIP → 下载。
- 任一阶段失败都会显示具体错误，不再出现“正在生成闪一下就消失”。
- FACT/ZIP 失败时保留 `WRITE_仅会计报表_*.xlsx` 下载链接作为诊断兜底。
- 保留 V7.0.5 的持久下载链接、原始/重复/唯一订单统计、FACT 输出统计。
- 保留 CN FACT 唯一模板与零遗漏审计。

## v7.0.5 — 2026-08-09 19:00 (Europe/Paris)
- ZIP 生成后增加持久“下载结算包”按钮，自动下载被浏览器阻止时仍可手动下载。
- Blob URL 不再 1 秒后释放，避免异步导出后下载链接失效。
- 首页显示 `原始订单 → 重复 → 唯一订单`，完整展示去重过程。
- “FACT 已忽略”更名为“FACT 输出”，无原始 FACT 但系统自动生成时显示输出数量。
- 导入摘要增加原始 FACT、FACT 输出、原始订单行、重复订单、唯一订单。
- 保留 V7.0.4 导出错误捕获、V7.0.3 Import Worker、CN FACT 与零遗漏审计。

## v7.0.4 — 2026-08-09 18:45 (Europe/Paris)
- 修复 `exportAccounting()` 中 `buildAccountingReport()` 位于 `try/catch` 外的问题；此前这里抛错会表现为“点击导出完全没反应”。
- 整个导出流程统一纳入异常捕获：会计工作簿 → FACT 完整性审计 → FACT 生成/回填 → ZIP 打包 → 下载准备。
- 导出按钮点击后立即进入“正在生成…”状态，并防止重复点击。
- 对空会计报表、空 FACT、空 ZIP 增加显式失败检查。
- 所有导出异常通过页面错误条显示具体原因，不再只留在浏览器 Console。
- 保留 V7.0.3 Import Worker 修复，以及 CN FACT 和零遗漏审计。

## v7.0.3 — 2026-08-09 18:25 (Europe/Paris)
- 根因修复：删除 `import.worker.bundle.js` 中重复的旧 `scoreOrderHeader()` / `isOrderHeader()`；旧函数曾覆盖 V7 自适应表头识别并调用不存在的 `REQUIRED_HEADERS/ORDER_HEADERS`。
- Worker URL 从写死的 `?v=6.5.8` 改为 `?v=7.0.3-20260809-1825`。
- FACT Sheet 支持 `FACT`、`1-FACT-CN`、`2-FACT-FR`、`FACT-CN` 等命名。
- 仅含 FACT 的工作簿不再显示为“0 单成功导入”，改为明确提示没有订单 Sheet。
- 保留 V7.0.2 CN FACT 唯一模板、Carnet/Gomme/Mines 映射、数量守恒和零遗漏审计。

## v7.0.2 — 2026-08-09 17:25 (Europe/Paris)
- WRITE 铅笔业务正式锁定 `1-FACT-CN` 为唯一标准 FACT 模板；FR 模板不再参与自动生成。
- 从用户手工 CN FACT 建立 `FACT_TEMPLATE_CN_CANONICAL_V1.xlsx`，输出模板仅保留一个 `FACT-CN` 工作表，不再携带旧订单 Sheet。
- 扩展 FACT 行解析：Carnet、Lot de 2 gommes、4/6/12 mines、各类 UPSELL、Gravure、Coffret Cadeau 全部进入明确落点。
- 修复免费赠品也参与 FACT 成本统计的问题：FACT 分配只使用收费商品行。
- 新增 `factCompletenessAudit()`：每一个收费商品必须拥有 FACT 目标行；没有落点时禁止导出。
- 新增数量守恒校验：订单端商品数量与 FACT 分配数量不一致时禁止导出。
- 新增铅笔档位完整性校验：X 数量档位在 CN 模板不存在时禁止导出，而不是丢弃订单。
- 更新首次弹窗、历史更新、README、RELEASE 和中文发布脚本。

## v7.0.1 — 2026-08-09 17:12 (Europe/Paris)
- 新增 `ERASER`（Gomme-capuchon Shield）和 `NOTEBOOK`（Le Carnet Parfait）商品类别。
- Gomme 支持商品名变体、`2 Gomme *1 ~ *6` 和已出现数字 SKU。
- Carnet 支持 `Le Carnet Parfait` / `Carnet *1`。
- 两类商品统一进入配件订单逻辑，不再因为未知行把整张订单标记为“需复核”。
- 待复核人工分类升级为持久学习：确认一次后写入浏览器 localStorage，同 SKU/商品后续优先自动识别。
- 无可靠 Gomme/Carnet 历史成本时只保留分类与数量，不编造 COGs / Shipping。
- 使用 27792–28706 实际结算样本中的 234 条待确认商品作为回归测试。
- 同步首次更新弹窗、历史更新、README、RELEASE 和中文发布脚本。

## v7.0.0 — 2026-08-09 17:04 (Europe/Paris)
- 启动 V7 通用模板驱动结算架构。
- 去重逻辑改为“工作簿内去重”；跨工作簿相同订单号保留并记录异常，不再全局静默删除。
- 订单字段识别从固定中文表头升级为中/英/法语义别名映射。
- 新增币种字段与文件名币种推断；多币种订单不再直接相加。
- 新增「数据质量」页面：检查跨文件重复订单、混合币种、未识别商品、无 FACT 与新 Profile。
- 新增「规则学习」页面：展示 SKU / 商品 → 分类 → FACT Profile 的本次映射。
- 每个工作簿继续独立生成/回填 FACT；保留 WRITE 铅笔 Profile 和通用 fallback。
- 专业会计报表增加 `00_币种总览`；多币种情况下不计算虚假的跨币种销售总额、毛利和毛利率。
- 更新首次弹窗、历史更新、README、RELEASE、中文升级脚本与测试记录。

## v6.6.2 — 2026-08-09 16:58 (Europe/Paris)
- 修复无 FACT 自动生成时没有真实 FACT 分类、成本价格全部为 0 的问题。
- 新增 FACT Profile 识别：WRITE 铅笔订单自动选择真实铅笔 FACT 学习模板。
- 自动 FACT 直接复用已有 FACT 回填引擎：国家 → Stylo eternel X 数量档位 → 笔芯 / 彩色笔芯 → 雕刻 → 礼盒。
- 内置真实历史铅笔 FACT 模板 `FACT_TEMPLATE_PENCIL_V1.xlsx`，保留原格式与 COGs / Shipping 国家价格矩阵。
- 自动生成 FACT 与已有 FACT 回填的 Quantity、COGs、Shipping、COGs+Shipping、Amount 计算方式统一。
- 会计报表的自动 FACT 汇总同步使用分类后行及学习价格。
- 首次更新弹窗、历史更新、README、RELEASE 与中文发布脚本同步至 V6.6.2。

## v6.6.1 — 2026-08-09 16:41 (Europe/Paris)
- 无 FACT 自动创建改为“真实学习模板克隆”，内置 `assets/FACT_TEMPLATE_LEARNED_V1.xlsx`。
- 自动生成 FACT 保留学习模板的 LOGO、字体、边框、列宽、行高、合并单元格、付款信息和页面结构。
- 数据行按实际商品数量动态扩展，合计行与付款区域自动下移。
- 计算逻辑与模板一致：仅 COGs → `H=D*E`；仅 Shipping → `H=D*F`；COGs+Shipping → `G=E+F, H=D*G`；直接单位成本 → `H=D*G`；总计 → `SUM(H...)`。
- 无学习成本时成本字段保持空白，不再写入伪 0 成本。
- 多币种自动替换 FACT 表头的货币代码和付款提示，不改变模板样式。
- 更新首次弹窗、历史更新、README、RELEASE、中文升级脚本和版本一致性测试。

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
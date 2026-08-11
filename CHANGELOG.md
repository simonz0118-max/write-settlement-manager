## v8.3.0 — 2026-08-11 19:55 (Europe/Paris)
- Classification Fidelity：按Country + Role + Configuration + Quantity逐行对比人工FACT。\n- 1001-1162 Golden从39/49提升至49/49。\n- 修复多MAIN、Context Role、Triangle与配件角色差异。

## v8.3.1 — 2026-08-11 20:12 (Europe/Paris)
- Classification Fidelity · Trace Hardening：49/49必须逐行有源订单和源商品支撑。\n- MAIN订单唯一Configuration路由；计费商品唯一FACT路由。\n- Zero-Loss + Classification Exact + Trace Exact三重门。

## v8.4.0 — 2026-08-11 20:35 (Europe/Paris)
- Unified Human Workflow Engine：统一YD/归档/铅笔/香皂人工统计行为。\n- 统一履约记录→组件角色→Package Configuration→FACT。\n- FACT-only人工项与无法解释的部分差异不学习。

## v9.0.0 — 2026-08-11 22:40 (Europe/Paris)
- Autonomous Human-Like FACT Engine：未来生产输入默认只有订单，不要求FACT页。\n- 订单是唯一事实来源；历史模板数据不得凭空进入新FACT。\n- 唯一Golden FACT模板锁定；未知/低置信商品必须输出并使用红字Description。\n- 人工确认/修改后自动学习；所有订单观察自动记录；缺价格留空不阻断。\n- V9正式接管FACT统计路由，V7.5.9保留回滚兼容。

## v8.8.0 — 2026-08-11 22:06 (Europe/Paris)
- Historical Batch Auto-Extraction：历史Excel自动识别订单页与FACT页。
- SheetJS直读适配；支持CN/FR Sheet Origin、模板空Quantity、重复sheet去重。
- 自动抽取结果继续经过V8.7闭环与V8.6评分，抽取成功不等于训练授权。
- 正式FACT仍由V7.5.9生产。

## v8.7.0 — 2026-08-11 21:50 (Europe/Paris)
- Automatic Historical Closure Analyzer：Order↔FACT自动闭环。
- EXACT_CLOSED / EXPLAINED_CLOSED / TEMPLATE_ONLY / FACT_ONLY_MANUAL / PARTIAL_UNEXPLAINED / SOURCE_ONLY状态机。
- 解释型晋级必须有明确历史证据；禁止8-vs-10部分学习。
- 接入V8.6批次评分和分领域训练路由；正式FACT仍由V7.5.9生产。

## v8.6.0 — 2026-08-11 21:32 (Europe/Paris)
- Historical Batch Scoring：每个历史工作簿独立评分。
- Classification / Quantity / Price分领域训练资格。
- 未知证据禁止晋级；FACT-only与无法解释的部分差异禁止训练。
- V8.5多数据集防回归与V7.5.9正式FACT保持。

## v8.5.0 — 2026-08-11 21:05 (Europe/Paris)
- Multi-Dataset Golden Harness：Thomas/YD归档/铅笔/香皂同时回归。
- Regression Firewall：任何一套历史行为退化都阻止发布候选。
- Evidence Fingerprint：相同Excel副本只算一次训练证据；60副本→55独立证据。
- 正式FACT仍由V7.5.9生产，formalFactTakeover=false。

## v8.2.0 — 2026-08-10 23:12 (Europe/Paris)
- Zero-Loss：Lost Order/Product/Quantity必须为0；UNKNOWN与缺价格不阻断。
- 多商品Configuration保持组合；MAIN/UPSELL分离；Triangle语义强化。
- 占位记录保留但不计商品数量；源数据冲突不静默修正。
- 双向追踪：FACT Shadow↔源订单。

## v8.1.2 — 2026-08-10 22:55 (Europe/Paris)
- 补充V8 Shadow只读Source Bridge，不改变V7.5.9正式FACT逻辑。
- 强化Bridge/非阻断发布门并修复旧版本提示。

## v7.5.9 — 2026-08-10 21:05 (Europe/Paris)
- 以人工 FACT 1001-1162 为唯一统计学习基准。
- 主商品按国家+订单配置汇总，Quantity=订单数；UPSell独立按实际件数汇总。
- 源订单和商品数量继续完整保留在后台审计，不因正式FACT聚合丢失。
- 49行黄金人工FACT语义回归纳入发布前硬测试。

## v7.5.8.1 — 2026-08-10 20:42 (Europe/Paris)
- 修复 V7.5.8 导入线程异常：runtime 错误指向已删除的 import.worker.v757.js。
- 导入固定切换到 import.worker.v758.js，并新增 Worker 路径/文件存在性强制发布检查。
- 160订单行 + 288 Quantity 双守恒逻辑不变。

## v7.5.8 — 2026-08-10 20:45 (Europe/Paris)
- 一单一行不变，但 Quantity 恢复为订单真实商品总数。
- 订单行数与商品 Quantity 双重硬守恒：160 行 + 288 件黄金样本。
- 多商品订单 Description 保留核心商品组合，SKU 不默认展示。
- 历史整单成本折算为单位成本，Amount 保持原整单总额。

## v7.5.7 — 2026-08-10 20:41 (Europe/Paris)
- ONE ORDER = ONE FACT ROW：正式 FACT 禁止跨订单聚合。
- 160 个有效订单必须产生 160 条独立订单行，每条 Quantity=1。
- 有效 FACT 行数、Quantity 合计、唯一 sourceOrderKey 三重守恒，不一致则阻止导出。
- Description 标准化、历史价格和未知价格空白规则保持不变。

## v7.5.6 — 2026-08-10 20:27 (Europe/Paris)
- ORDER COUNT IMMUTABLE：正式 FACT Quantity 使用订单/包裹口径，一个有效源订单固定贡献 1。
- 商品件数、SKU *N、商品拆分/聚合不再允许改变订单数量。
- 同一标准化 Description 自动按包裹合并，合计必须严格等于源订单数量，否则导出失败。
- 历史规则继续用于订单级成本计算；未知价格留空，不阻断导出。

## v7.5.5 — 2026-08-10 20:18 (Europe/Paris)
- 正式 FACT Description 标准化：不再默认打印 SKU。
- 伪装网统一为 Le Filet de camouflage / 尺寸；去除颜色、renforcé、premium 等正式结算不需要的信息。
- 其他商品保留核心名称 + 关键规格，采取保守简化，避免过度合并。
- 修复部署卡在 [7/9]：Wrangler 输出不再被隐藏；使用 npx --yes 避免不可见安装确认。
- 保持 160 包裹、288 件商品、历史价格和未知价格空白语义不变。

## v7.5.4 — 2026-08-10 19:40 (Europe/Paris)
- 修复商品聚合行数被误当包裹数的问题：79 是 FRANCE 商品/SKU 分组，不是包裹。
- 新增订单级 Parcel Conservation：1001–1162 真实批次必须守恒为 160 个确认包裹（FR 158 / BE 1 / GR 1）。
- FACT 每个国家增加 Nombre de colis / Parcels 行；无可靠包裹成本时价格保持空白。
- 商品数量仍独立守恒为 288，82 个商品/SKU 分组保持不变；包裹数量绝不计入商品件数 TOTAL。
- 1012 / 1038 两个源数量为 0 的定制记录继续保留为 UNKNOWN_QUANTITY，但不伪造为确认包裹。

## v7.4.1 — 2026-08-10 15:35 (Europe/Paris)
- 直接修改生产 app.bundle.js：删除 exportAccounting 的 PENCIL_V1 / CN FACT / UNMAPPED_PRODUCT 导出阻断链。
- 所有订单文件统一调用 Universal FACT builder，并套用统一历史 FACT 模板。
- 商品未识别、分类未知、价格未知不能阻止 FACT 导出。
- 源订单中的国家 / 商品 / SKU / 数量等可用字段必须保留统计。
- 有可靠价格规则则自动计算，无可靠价格则价格留空。
- 自动学习仅作为后续增强，不再作为当前导出的前置条件。

## v7.4.0 — 2026-08-10 15:10 (Europe/Paris)
- Universal FACT Engine：订单源数据决定统计结果，规则/学习不再作为导出前置条件。
- 未知商品、未知分类、未知成本不得阻断 FACT；已知字段全部保留。
- 有可靠历史价格/计算规律则自动计算，没有可靠价格则保持空白。
- 所有正式 Invoice 套用统一历史 FACT 模板。
- 只有真实的源订单记录丢失允许硬阻断导出。
- 自动学习改为导出增强层，不能覆盖或破坏当前导出。

## v7.3.1 — 2026-08-10 14:20 (Europe/Paris)
- 所有通用 FACT / Invoice 改用用户历史 FACT 标准模板；不再使用独立学习模板。
- 修复通用 FACT 国家行、蓝色数据行、合并单元格、样式与底部付款区错乱。
- 一份 FACT 内按国家分区；价格允许空白，但国家/商品/SKU/数量必须正确。
- 成熟 PENCIL/CN FACT 不再被通用 productCount 数量检查误拦，继续由专用 CN FACT 审计验证。
- 导出前置异常现在会在 Export Center 明确显示，不再出现点击导出无任何反应。

## v7.3.0 — 2026-08-10 13:30 (Europe/Paris)
- 历史规律引擎：从用户提供的历史 FACT 资料编译国家、产品族、组合数量与价格规律。
- 旧 WRITE/CN FACT 成熟规则优先级最高，IndexedDB/D1 自动学习不得覆盖旧规则。
- Jelly / Gilet / Chemise 等按国家 + 单订单产品族数量组合自动统计。
- 历史同类新颜色/尺寸/口味自动继承产品族规律；未见数量按历史阶梯插值/外推。
- 真正新商品自动进入一般商品并正常统计；无可靠价格时价格留空。
- 正式 FACT 一份文件内按国家分区，禁止输出待确认 / UNKNOWN / 未设置 / 自动识别 / 需复核等内部状态。
- 正常导出全自动，不再强制成本人工复核。
- 数量守恒与源记录守恒继续硬阻断。

## v7.2.3 — 2026-08-10 03:10 (Europe/Paris)
- 修复“不填写直接导出”仍被旧 FACT 完整性审计拦截的问题。
- PENCIL_V1 继续严格 FACT 审计；GENERIC/新商品改走通用 FACT 生成路径。
- 历史 FACT 可匹配成本优先保留，未知成本保持空白/UNKNOWN。
- 批量规则处理完成前完全隐藏导出进度窗口。
- 取消批量处理不会启动后台生成。

## v7.2.2 — 2026-08-10 02:35 (Europe/Paris)
- 修复批量规则弹窗宽度不足导致的表格挤压和错位。
- 新增宽屏工作台、独立滚动区域和固定底部操作栏。
- 新增右上角 ×、Esc、点击遮罩、底部取消四种关闭方式。
- 不修改订单守恒、成本学习和 D1 同步逻辑。

## v7.2.1 — 2026-08-10 02:10 (Europe/Paris)
- 批量设置商品分类、成本模型和币种策略。
- 支持永久学习、仅本次使用、不填写直接导出。
- UNKNOWN 成本不再伪装成 0；成本不完整时不计算毛利/毛利率。
- D1 API 发布验证改为 JSON.parse + ok===true。

## v7.2.0 — 2026-08-10 01:20 (Europe/Paris)
- 修复订单号相同的多条真实记录被错误去重的问题：订单号仅作为业务关联键，不再作为唯一记录键。
- 新增 recordKey 源记录身份，所有源订单行默认完整保留。
- 新增全链路守恒审计：源记录数、进入结算记录数、产品总数与解析商品数量。
- 新增 COST_MODEL / CURRENCY_POLICY / FACT_MODEL / TAX_POLICY / RULE_CONFLICT 长期知识类型。
- 支持单位成本、订单固定成本、订单金额百分比、数量阶梯成本。
- 历史 FACT 高置信匹配后自动学习成本；不确定则不自动污染规则库。
- VAT 规则只允许人工确认后学习；规则冲突不自动覆盖。
- 保留 IndexedDB + D1 + 离线 + 联网自动同步。

## v7.1.10 — 2026-08-10 00:55 (Europe/Paris)
- 新增陌生订单表自适应结构识别：表头语义 + 列数据特征联合推断。
- 新增 ORDER_SCHEMA 长期学习规则，复用 IndexedDB + Cloudflare D1 自动同步。
- 高置信结构全自动；低置信结构要求一次字段映射确认，确认后永久学习。
- 核心字段不明确时阻止错误统计/FACT/会计报表输出。
- 产品总数缺失时支持从 SKU×数量或产品行自动推导。
- 保留订单统计、CN FACT、数量守恒、会计报表、未知商品过滤、商品/价格学习及主题逻辑。

## v7.1.8 — 2026-08-09 23:38 (Europe/Paris)
- 修复 V7.1.7 Cloudflare Pages 部署成功但 `/api/rules/sync` 在线返回 404。
- 新增根 `_routes.json`：`include=["/api/*"]`，明确只让 API 路径进入 Pages Functions。
- 发布前执行 `wrangler pages functions build` 并生成路由产物；必须验证 `/api/rules/sync` 被路由覆盖后才能提交和部署。
- 在线 API 验证升级为 HTTP 状态码 + response body + `ok:true` 三重检查。
- 不修改订单、CN FACT、数量守恒、会计报表、未知商品过滤、规则学习及 IndexedDB/D1 业务逻辑。

## v7.1.7 — 2026-08-09 23:30 (Europe/Paris)
- 修复 V7.1.6 发布脚本在 Cloudflare Pages 配置预检阶段的误判。
- 删除对发布脚本全文搜索 `--config` 的逻辑；改为只检查真正传给 Wrangler Pages deploy 的参数数组。
- 注释、说明文字、CHANGELOG 中出现 `--config` 不再触发失败；真实部署参数出现 `--config` / `--config=...` 仍会中止。
- 发布流程固定：clone → pull → 覆盖新版 → 唯一根 wrangler.jsonc → 自检 → GitHub → Pages → 唯一 deployment → 版本/API 强验证。
- 不修改订单、CN FACT、数量守恒、会计报表、未知商品过滤、规则学习及 IndexedDB/D1 业务逻辑。

## v7.1.6 — 2026-08-10 00:10 (Europe/Paris)
- 移除 Pages 不支持的 `--config` 自定义配置路径。
- 删除 `wrangler.toml`，统一唯一根配置 `wrangler.jsonc`。
- 停止调用 experimental `wrangler pages download config`。
- 发布时从 Cloudflare D1 列表生成真实 `WRITE_RULES_DB` 根配置。
- 发布前扫描并禁止任何 `--config` 残留。
- 保留完整 Wrangler stderr/exit code、线上版本与同步 API 强验证。
- 不修改结算业务逻辑。

## v7.1.5 — 2026-08-09 23:59 (Europe/Paris)
- Cloudflare Pages 部署失败时完整打印 Wrangler stderr 与 exit code。
- 优先下载真实 Pages Wrangler 配置，再注入 WRITE_RULES_DB。
- Git/D1/Pages 分段诊断，禁止静默失败。
- 成功条件：GitHub 成功 + deployment=v7.1.5 + sync API ok:true。
- 不修改订单、会计、FACT 与规则分类业务逻辑。

## v7.1.4 — 2026-08-09 23:45 (Europe/Paris)
- 重构发布流程：clone → checkout → pull --ff-only → 保存 D1 配置 → rsync 新版 → 自检 → commit → push → Pages。
- 发布始终使用临时干净 Git 工作区，不受升级包目录和用户本地 Git 状态影响。
- 新增核心 JS / Worker / Function / release metadata / D1 Binding 发布前强制检查。
- 所有检查通过后才允许 commit/push。
- Cloudflare 部署后回读唯一 deployment URL 校验 data-release=v7.1.4。
- 检查 `/api/rules/sync`，明确报告 D1 云同步是否可用。
- 保留现有规则学习、IndexedDB、D1、UI 和 FACT 核心。

## v7.1.3 — 2026-08-09 23:18 (Europe/Paris)
- 修复升级包普通解压目录执行时 `fatal: not a git repository`。
- 无 `.git` 时自动 clone `simonz0118-max/write-settlement-manager` 到临时目录。
- 自动 rsync 新版本文件、commit、push，不要求升级包本身包含 Git 元数据。
- 自动保留/恢复 Cloudflare D1 `WRITE_RULES_DB` binding。
- D1 初始化脚本改为与当前目录 Git 状态完全解耦。
- 部署后继续校验唯一 Pages deployment 的 `data-release=v7.1.3`。
- 保留 V7.1.2 UI、缓存与长期规则学习逻辑。

## v7.1.2 — 2026-08-09 23:25 (Europe/Paris)
- 重写 GitHub/Cloudflare 与 D1 配置脚本。
- 加入部署前后版本双校验。
- 强制缓存 revalidate。
- 规则学习 UI 对齐。
- Knowledge Base 初始化修复与首次同步增强。

## v7.1.1 — 2026-08-09 22:35 (Europe/Paris)
- 新增 D1 全自动配置脚本。
- 自动查找/创建 `write-settlement-rules` D1。
- 自动绑定 `WRITE_RULES_DB`、初始化 schema、验证 `write_rules`。
- 自动 GitHub push + Pages D1 配置部署。
- 新增 visibility 恢复同步和每5分钟安全同步。
- 普通升级脚本自动保留 D1 Wrangler 配置。

## v7.1.0 — 2026-08-09 22:12 (Europe/Paris)
- IndexedDB 成为规则长期本地主库；localStorage 保留兼容镜像。
- 自动迁移旧商品分类规则和 FACT 国家价格学习规则。
- 新增 Cloudflare D1 增量同步和多设备规则合并。
- 冲突优先级：人工确认 > SKU 精确 > 套餐确认 > 商品名 > 自动推断 > 估算。
- 规则学习页面升级为知识库中心：长期规则、待同步、云状态、手动同步、JSON 备份/恢复。
- D1 不可用时保持纯本地工作，不影响 V7.0.12 的导入、FACT、数量守恒和导出。
- 新增 `functions/api/rules/sync.js` 与 `cloudflare/d1-schema.sql`。

## v7.0.12 — 2026-08-09 20:20 (Europe/Paris)
- Import Worker 从源头过滤重复订单表头，防止 `产品名称 / 收货人国家` 等字段标签成为商品。
- 过滤只有第一列说明文字、其余业务字段全空的页尾/说明行，防止产生假“未知商品”。
- `parseLineItems()` 增加结构字段二次过滤，上游即便异常，表头也无法进入分类与 FACT 学习。
- 商品名为空但 SKU 有效时继续按 SKU 分类。
- 真正未知商品审计增加 sourceSheet/sourceRow。
- 真实样本回归：CN Sheet 第 712 行重复表头、FR Sheet 第 259 行说明文字均被识别为结构污染。
- 保留 V7.0.11 CN FACT 直接 worksheet 写入、国家×商品自动学习、数量守恒与导出中心。

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

# WRITE Settlement Manager V10 — Changelog

## 10.0.1 — 2026-08-12
- 修复 FACT 空价格单元格引用错误样式编号导致的边框与红色底纹缺失。
- COGs、Shipping、COGs + Shipping、Amount 每个空单元格均显式写入，使用完整四边细框与连续浅红底。
- 包裹总数行的价格区域使用同一完整红底网格；Logo、抬头、银行信息和模板其他区域不变。
- 新增导出样式基线和四个价格列完整性回归断言。

## 10.0.0 — 2026-08-12
- 完成生产接管：不再使用 canary，V10 固定 100% 处理订单统计与发票导出。
- 一张 FACT 汇总全部国家，按“国家 + 完整产品组合”统计，不按中国仓/法国仓拆票。
- 精确重复记录去重；同订单多运单分别计包裹并标红；冲突记录全部保留并标红。
- 赠品必须有明确免费证据；赠品专单不计入包裹总数；普通商品加赠品仍计一个包裹。
- 未知商品保守缩写，原始名称与 SKU 完整保存在审计 JSON，FACT 对应行标红。
- 所有成本、运费、单价、金额与合计留空标红，仍自动生成固定视觉 Excel 和 PDF。
- 模板仅修改 FACT 数据区与新增红色复核样式，Logo、银行信息和其余 OOXML 资源保持原样。
- 通过人工订单格式 3020 行、10 行业端到端测试及确定性 50085 记录压力测试。

## 10.0.0-rc1 — 2026-08-12
- 新增 CanonicalOrder 履约身份模型：source hash + Sheet + row + orderId + parcel/tracking。
- 新增 BillableAtom 多实体解析；明确区分 PACKAGE / UPSELL / SERVICE / FEE / FREE_GIFT / MANUAL_ONLY。
- 修复 `cadeau` 误判：只有显式 free/offert/gratuit/100% off 证据才免费；付费礼盒/样品保留计费。
- 新增 Accounting IR，PACKAGE/UPSELL/SERVICE/FEE 四路独立聚合。
- currency/origin/taxRegime/invoiceEntity/configuration/priceVersion 纳入聚合键。
- 五重守恒：订单、源商品记录、原子数量、计费语义、金额/币种。
- 新增 Pricing Waterfall；STRICT_FORMAL 缺价不造 0；ALWAYS_ISSUE 仅允许企业预批准兜底公式。
- 新增 Universal Ingestion：XLSX/XLS/CSV/TSV/JSON/XML/ZIP/PDF/OCR 入口；ZIP 路径穿越/数量/解压上限保护。
- 新增 Invoice Compiler：FACT 行桥接、商业 PDF、audit JSON、异常报告。
- 新增 partial FACT/价格闭环学习治理、shadow/canary/rollback 控制。
- V9 正式引擎保留，V10 在 Codex 验收前不自动接管生产。

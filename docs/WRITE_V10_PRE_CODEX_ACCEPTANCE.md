# WRITE V10 — Codex 前置实现与自测报告

结论：**NEEDS WORK（按用户定义的最终生产门）**。代码候选已完成核心 V10 架构与 P0 修复，但当前执行环境没有四组完整人工发票 ZIP / 52 份金标全集，也没有浏览器生产 canary/Cloudflare 发布证据，因此不得冒充最终 PASS。

## 已实现
- CanonicalOrder、BillableAtom、多实体拆分、Accounting IR。
- paid cadeau/sample 与显式 free gift 分离。
- SERVICE/FEE 独立落账。
- currency/origin/taxRegime/invoiceEntity/configuration/priceVersion 隔离。
- 五重守恒。
- Pricing Waterfall + STRICT_FORMAL / ALWAYS_ISSUE。
- Universal Ingestion 的 XLSX/XLS/CSV/TSV/JSON/XML/ZIP/PDF/OCR 入口与 ZIP 安全门。
- FACT bridge、PDF、audit JSON、异常报告。
- partial FACT / 价格闭环治理。
- 0/5/25/50/100 canary 与失败回滚到 V9。

## 已实跑证据
- 15 类确定性语义场景：15/15 = 100%。
- V8.2 Zero-Loss：PASS。
- V8.3 Classification Golden：49/49 PASS。
- V8.3.1 Trace Golden：49/49 PASS。
- V8.5 Multi-dataset gate：PASS。
- V8.7 8-vs-10 partial learning forbidden：PASS。
- V9 production takeover / classification coverage / fulfillment identity / cloud serialization / namespace import / formula cache isolation：PASS。
- 固定种子 539363346：
  - 1,000 单：55.526 ms。
  - 10,000 单：337.269 ms。
  - 50,000 单：1,617.152 ms，低于 2 秒门；hardPass=true。

## 尚需 Codex 在真实仓库/资料环境完成
1. 52 份完整人工 FACT 全量闭环验证；3 份 partial 学习数必须为 0。
2. 四个人工资料集（YD、归档、铅笔、香皂）逐文件回归。
3. 真实 PDF/OCR 浏览器路径与真实扫描件验收。
4. Golden FACT 1:1 视觉/结构输出、XLSX ZIP/公式/结构检查。
5. PDF 与 XLSX 金额逐行及总计一致性实文件验证。
6. fresh clone 全量测试、浏览器 E2E、Cloudflare canary、正式域名 SHA 验证。
7. 企业真实合同价/运费/handling/税费/unknown fallback 配置；未配置前 ALWAYS_ISSUE 不允许发明金额。

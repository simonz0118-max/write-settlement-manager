# WRITE Settlement Manager v5.2 验收

## FACT 分类汇总增强

- FACT Sheet 不再只是跳过：现在会解析 B:H 成本分类明细，但仍不会当作订单导入。
- 参考文件 `FACT- 10063_write-store_27_11_25(17506-20313)(1).xlsx` 实测读取 69 条 FACT 分类明细。
- FACT `Amount (€)` 汇总：**37,204.33 €**，与原 FACT 页面最终合计完全一致。
- 修复了 FACT 页空样式单元格导致的列错位解析问题。

## 新导出结构

1. `00_FACT分类汇总`：FACT 核心指标、按 Description 合并的分类汇总、按国家/地区的 FACT 原始明细。
2. `01_结算总览`：新增 FACT 成本总额和 FACT 分类数量。
3. `02_订单明细`
4. `03_商品汇总`
5. `04_待复核`
6. `90_订单审计`
7. `99_导入日志`

FACT 汇总字段包含：Quantity、COGs 合计、Shipping 合计、未拆分金额、Amount、占比、国家/地区数。

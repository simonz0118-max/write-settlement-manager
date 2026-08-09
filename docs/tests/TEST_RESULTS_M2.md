# Milestone 2 — Real-data acceptance test

Test input: `铅笔(1).zip`

- Deduplicated orders: **12,691**
- Total order amount: **€591,722.65**
- Sum of mutually-exclusive accounting categories: **€591,722.65** (reconciles exactly)
- Orders requiring review: **48**
- Unrecognized product lines: **48**
- Gift quantity detected (`🎁` / `100% off`): **11,986**

## Order-level accounting categories

- 铅笔订单: 12,159 orders · €582,804.63
- 笔芯订单: 371 orders · €7,018.77
- 待确认: 42 orders · €1,720.06
- 礼盒 / 配件订单: 11 orders · €122.29
- 礼品卡订单: 1 order · €50.00
- 雕刻服务订单: 1 order · €6.90
- 赠品 / 0€订单: 100 orders · €0.00
- B2B / 专业订单: 6 orders · €0.00

## Export validation

The built-in browser XLSX writer was tested by generating an `.xlsx` containing multiple sheets. ZIP/package integrity test passed with no errors.

Export sheets in the web app:
1. 会计汇总
2. 订单明细
3. 商品分类明细
4. 导入日志

Important: product-level categories do **not** allocate order revenue across individual products. Order-level categories are mutually exclusive and are the accounting-safe revenue summary.

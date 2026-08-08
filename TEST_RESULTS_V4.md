# WRITE Settlement Manager v4.0 验收

- JavaScript 语法检查：通过。
- 本地静态入口：index.html / src/app.js / src/styles.css 可由 Python HTTP Server 提供。
- 启动器：自动寻找 4173–4273 空闲端口，避免 Address already in use。
- Excel ZIP 结构校验：通过，无损坏条目。
- Excel 使用 artifact_tool 成功重新导入并渲染：通过。
- 总览格式校验：订单数为整数、订单总额为欧元、占比为百分比、商品件数为整数。
- 订单明细：10 个结算常用字段；审计字段拆分到独立 Sheet。
- Logo：原创白线侧脸熊猫，重画耳朵、眼斑、鼻口轮廓。

真实业务汇总回归基准（沿用已通过的 Milestone 2 数据集）：
- 去重订单：12,691
- 订单总额：€591,722.65
- 待复核订单：48
- 未识别商品行：48
- 赠品件数：11,986

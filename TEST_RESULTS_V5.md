# WRITE Settlement Manager v5.2 验收

## 静态完整性

- index.html HTML 解析：通过
- src/app.js Node 语法检查：通过
- accounting.js / orderSchema.js / xlsxWriter.js / zipReader.js / import.worker.js：通过
- 本地熊猫品牌资源存在：通过
- Hero 导出按钮已绑定 exportAccounting：通过
- Hero / 导航重新导入按钮已绑定 reimportFlow：通过
- Cloudflare 发布脚本包含 assets 目录：通过

## 数据引擎

V5 未改动 Milestone 1/2 已通过真实 `铅笔(1).zip` 回归的核心导入与分类引擎，因此保留原有：

- XLSX 流式解析
- FACT Sheet 级忽略
- 订单表头结构识别
- 订单号去重
- 会计分类 / 商品分类 / 赠品识别 / 待复核
- 六层专业 Excel 导出

## GitHub 连接说明

当前 ChatGPT GitHub integration 仍能读取仓库，但 Contents API 写入返回 403 `Resource not accessible by integration`。因此包内提供已经验证过的 macOS GitHub CLI 自动更新脚本，使用用户本人已登录的 GitHub 会话进行 push。

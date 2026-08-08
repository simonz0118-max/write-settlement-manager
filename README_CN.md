# WRITE Settlement Manager v5.0

面向真实订单 Excel / ZIP 的本地结算与会计分类 WebApp。

## v5.0 重点升级

- 全新浅色 Apple / macOS 风格界面，减少后台系统感。
- 使用照片级线稿熊猫侧脸作为品牌视觉。
- 首页新增超明显「导出结算报表」英雄按钮。
- 首页同时提供「重新导入订单」，减少操作路径。
- 保留超大 XLSX 流式解析、ZIP 导入、FACT Sheet 自动忽略、订单去重与会计分类。
- 不使用彩色饼图，会计分类继续使用更容易比较的表格 + 细占比线。
- Excel 输出保持 6 层专业结构：结算总览、订单明细、商品汇总、待复核、订单审计、导入日志。
- 支持一键更新到 GitHub 与 Cloudflare Pages。

## 本地启动

双击 `start.command`。

## 一键更新线上版本

双击：

`一键更新V5_GitHub并Cloudflare.command`

脚本会更新：

- GitHub: `simonz0118-max/write-settlement-manager`
- Cloudflare Pages: `https://write-settlement-manager.pages.dev/`

订单数据始终在浏览器本地解析，不上传到 WRITE 服务器。

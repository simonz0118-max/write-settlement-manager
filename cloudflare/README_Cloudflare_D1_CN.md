# WRITE V7.1.0 Cloudflare D1 配置

本地 IndexedDB 不需要配置即可长期学习。D1 只用于多设备同步。

1. Cloudflare 创建 D1 数据库，例如 `write-settlement-rules`
2. 执行 `cloudflare/d1-schema.sql`
3. Pages 项目 Settings → Bindings → D1 database
4. Variable name 填：`WRITE_RULES_DB`
5. 绑定刚创建的 D1 数据库并重新部署

未配置 D1 时：
- 页面显示“仅本地”
- IndexedDB 正常学习
- 离线正常使用
- 导入、FACT、会计报表、导出不受影响

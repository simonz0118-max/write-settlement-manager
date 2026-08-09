# Cloudflare D1 全自动配置

直接双击根目录：

一键配置Cloudflare_D1并开启云同步.command

它会自动：检查登录 → 查找/创建 D1 → 写入 Binding → 初始化 Schema → 验证 → GitHub → Pages 重新部署。

成功后规则学习会：
- 在线新规则立即同步
- 断线恢复自动同步
- 页面回到前台自动同步
- 每5分钟安全同步
- 离线继续 IndexedDB 本地工作

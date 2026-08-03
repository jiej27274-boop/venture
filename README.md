# 创投智联 MVP

面向项目方、投资机构、FA 机构和政府招商部门的创投信息与线索协同平台。当前仓库包含：

- 微信小程序：游客浏览项目、查看政府联系人，已认证主体申请 BP。
- H5 用户端：项目、机构、政府联系人和资讯浏览，支持匿名项目与招商对接需求提交。
- Web 管理后台：运营总览、认证审核、项目与 BP、政府联系人、审计安全。
- API 服务：SQLite 数据存储、多组织权限隔离、BP 申请与授权、访问水印和审计日志。
- 领域权限包：集中维护项目修改、BP 申请和 BP 访问策略。

> 当前版本是可演示、可继续迭代的本地 MVP，不是可直接上线的生产版本。登录身份采用演示请求头，BP 文件接口返回短期模拟地址；正式上线前需要接入微信登录、对象存储、短信/消息通知和等保安全配置。

## 环境要求

- Node.js 24 或更高版本（API 使用 Node 内置 SQLite）
- pnpm 10
- 微信开发者工具（运行小程序时需要）

## 安装与启动

```powershell
cd E:\codex\venture-platform
pnpm install
pnpm dev:api
```

另开一个终端启动管理后台：

```powershell
cd E:\codex\venture-platform
pnpm dev:admin
```

再开一个终端启动用户浏览网站：

```powershell
cd E:\codex\venture-platform
pnpm dev:web
```

启动后访问：

- API 健康检查：<http://127.0.0.1:8787/health>
- 管理后台：<http://127.0.0.1:5173>
- 用户浏览网站：<http://127.0.0.1:5174>
- 本地 SQLite：`E:\codex\venture-platform\data\venture.db`

如需使用临时数据库，可在启动 API 前设置 `VENTURE_DB_PATH`；如需改端口，可设置 `PORT`。

## 微信小程序

在微信开发者工具中选择“导入项目”，目录使用：

```text
E:\codex\venture-platform\apps\miniprogram
```

本地开发配置已关闭合法域名校验，默认请求 `http://127.0.0.1:8787`。在真机或正式环境中必须把 `apps/miniprogram/utils/api.js` 的 `baseUrl` 改成已备案、已配置微信服务器域名的 HTTPS API 地址，并在微信公众平台配置 request 合法域名。

小程序当前默认使用“远景创投 · 投资经理”演示身份，可在 `apps/miniprogram/app.js` 中切换用户与组织。

## 演示身份

本地 API 暂以请求头模拟登录和组织上下文：

| 身份 | `x-user-id` | `x-organization-id` | 用途 |
| --- | --- | --- | --- |
| 平台管理员 | `user-admin` | `org-platform` | 查看总览和平台管理数据 |
| 项目负责人 | `user-owner` | `org-project` | 审批 BP 申请、访问自有 BP |
| 投资经理 | `user-investor` | `org-investor` | 浏览项目、申请并访问已授权 BP |
| FA 项目经理 | `user-fa` | `org-fa` | 以已认证 FA 身份申请 BP |
| 政府招商主管 | `user-government` | `org-government` | 以政府招商部门身份申请 BP |
| 待核验用户 | `user-unverified` | `org-unverified` | 验证未认证组织会被拒绝 |

例如查询投资经理会话：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/session `
  -Headers @{ "x-user-id" = "user-investor"; "x-organization-id" = "org-investor" }
```

## BP 授权主链路

1. 游客浏览公开项目，只能看到 BP 版本和“需要申请”的状态。
2. 已认证的投资机构、FA 或政府招商组织提交申请用途。
3. 项目方或受委托且具备项目管理角色的 FA 审批申请，设置有效期和是否允许下载。
4. 访问时服务端重新校验组织、授权、有效期与撤回状态，动态生成追踪编号和水印信息。
5. 每次申请、审批和访问都写入审计日志；平台管理员也不能绕过项目方授权直接读取 BP。

## 验证命令

```powershell
pnpm test
pnpm typecheck
pnpm build
```

当前自动化测试共 23 项：领域权限策略 14 项、API 集成 9 项，覆盖未认证、跨组织、未授权、过期、撤回、匿名项目防泄露、线索校验、资讯发布以及平台管理员直接读取 BP 等场景。

## 当前实现边界

- 已实现：多组织数据模型、实名/匿名公开项目、机构库、政府联系人、招商对接线索、资讯发布、BP 申请审批和授权访问、管理总览、审计记录、响应式 H5 与后台界面、小程序浏览框架。
- 尚未实现：真实微信手机号登录、主体证照 OCR/人工审核工作台、BP 二进制上传与对象存储、在线支付、智能匹配、消息订阅、线索 CRM、生产部署和等保测评。
- 首版线下登记可以直接沿用当前数据模型，由平台运营人员核验后录入；下一迭代再开放主体自助注册和材料上传。
## 上线前配置

API 环境变量模板位于 `apps/api/.env.example`。正式部署前至少需要配置：

- `AUTH_SECRET`：长度足够的随机密钥
- `VENTURE_DB_PATH`：可持久化 SQLite 路径
- `APP_ORIGINS`：用户端和管理后台的 HTTPS 域名
- `AUTH_EMAIL_REQUIRED`：是否强制注册邮箱
- 邮件服务参数：用于邮箱验证和密码找回

部署后使用 `/health` 检查进程，使用 `/readyz` 检查数据库是否可读写。
## 预发布验收

服务启动后，在项目根目录执行：

```powershell
pnpm preflight
```

也可以通过 `VENTURE_WEB_URL`、`VENTURE_ADMIN_URL` 和 `VENTURE_API_URL` 指定测试环境地址。脚本会检查两个前端入口、API 健康状态、数据库就绪状态和安全响应头；任一项失败都会返回非零退出码。

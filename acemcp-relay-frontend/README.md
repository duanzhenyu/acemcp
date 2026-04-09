# ACE Relay Frontend

ACE Relay 服务的前端控制台，用于 **API Key 登录、管理员用户管理、日志查看、排行榜与状态页展示**。

> 本项目改自上游仓库：https://github.com/heromantf/acemcp-relay-frontend

## 技术栈

- **Next.js 16** (App Router)
- **React 19** + **TypeScript 5**
- **Tailwind CSS 4** + Radix UI 组件
- **PostgreSQL**：持久化用户、API Key、日志、排行榜、健康检查
- **Redis**：配合 relay 共享 API Key 鉴权缓存

## 当前认证模型

前端已切换为 **API Key 登录控制台**：

- 登录页只接受 API Key
- 管理员在 `/admin/users` 中创建用户并自动生成 API Key
- 普通用户无法自助生成或重置 API Key
- 会话由前端自定义 HttpOnly Cookie 维护
- 用户被停用后，前端登录和 relay Bearer Token 都会失效

## 功能

- **API Key 登录**：用户使用管理员分配的 API Key 登录控制台
- **管理员用户管理**：新增、编辑、启用/停用用户，重置 API Key
- **ContextEngine 统计**：按 今天 / 近 7 天 / 本月 / 自定义时间 查询 `/agents/codebase-retrieval` 请求量
- **个人控制台**：查看自己的 API Key、请求日志、MCP 配置说明
- **排行榜**：展示每日 ContextEngine Top 10 用户
- **状态页**：查看 relay 健康检查与上游探测结果

## 项目结构

```text
app/
├── page.tsx                        # 首页
├── login/page.tsx                 # API Key 登录页
├── console/page.tsx               # 普通用户控制台
├── leaderboard/page.tsx           # 排行榜
├── status/page.tsx                # 状态页
├── admin/users/page.tsx           # 管理员用户管理页
├── api/
│   ├── login/route.ts             # API Key 登录
│   ├── logout/route.ts            # 退出登录
│   ├── me/route.ts                # 当前会话用户
│   ├── user/route.ts              # /api/me 兼容别名
│   ├── key/route.ts               # 当前用户 API Key 概览
│   ├── key/reveal/route.ts        # 查看完整 API Key
│   ├── logs/route.ts              # 请求日志列表/统计
│   ├── logs/[id]/route.ts         # 日志详情
│   ├── leaderboard/route.ts       # 排行榜数据
│   ├── health/history/route.ts    # 健康检查历史
│   └── admin/users/*              # 管理员用户与统计 API
components/
├── DashboardHeader.tsx            # 控制台统一导航
└── ...                            # UI 组件
hooks/
└── use-current-user.ts            # 当前会话用户 Hook
lib/
├── config.ts                      # Session/Admin/常量配置
├── session.ts                     # API Key Web Session
├── route-auth.ts                  # API 鉴权辅助
├── date-range.ts                  # 统计时间范围解析
├── db.ts                          # PostgreSQL / Redis 数据访问
├── types.ts                       # 共享类型
└── utils.ts                       # 工具函数
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

| 变量 | 说明 | 示例 |
|------|------|------|
| `WEB_SESSION_SECRET` | 前端登录 Cookie 签名密钥 | 随机长字符串 |
| `WEB_SESSION_TTL` | 前端 Session 时长 | `12h` |
| `ADMIN_USER_IDS` | 管理员用户 ID 列表，逗号分隔 | `admin,usr_xxx` |
| `BOOTSTRAP_ADMIN_USER_ID` | 首个管理员用户 ID | `admin` |
| `BOOTSTRAP_ADMIN_NAME` | 首个管理员显示名 | `ACE Admin` |
| `BOOTSTRAP_ADMIN_NOTE` | 首个管理员备注 | `Bootstrap administrator` |
| `BOOTSTRAP_ADMIN_API_KEY` | 首个管理员登录 API Key | `ace_xxx...` |
| `NEXT_PUBLIC_RELAY_URL` | 页面展示给用户的 relay 地址 | `http://localhost:3009/` |
| `POSTGRES_HOST` | PostgreSQL 主机 | `localhost` |
| `POSTGRES_PORT` | PostgreSQL 端口 | `5432` |
| `POSTGRES_USER` | PostgreSQL 用户名 | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | - |
| `POSTGRES_DB` | PostgreSQL 数据库名 | `postgres` |
| `REDIS_HOST` | Redis 主机 | `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |

### Bootstrap Admin 说明

- 只要设置了 `BOOTSTRAP_ADMIN_API_KEY`，前端在初始化数据库时会自动创建/同步该管理员用户
- `ADMIN_USER_IDS` 决定哪些用户拥有 `/admin/users` 访问权限
- 推荐把 `BOOTSTRAP_ADMIN_USER_ID` 同时放入 `ADMIN_USER_IDS`

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local

# 启动开发服务器
npm run dev
```

访问 [http://localhost:3000/login](http://localhost:3000/login) 使用管理员 API Key 登录。

首次推荐流程：

1. 配置 `BOOTSTRAP_ADMIN_API_KEY`
2. 启动前端
3. 使用 bootstrap admin key 登录
4. 进入 `/admin/users` 创建普通用户
5. 向普通用户分发生成的 API Key

## 数据边界

前端 API 路由 **直接访问 PostgreSQL / Redis**，不是通过 Go relay 获取业务数据：

- 前端写 `user` / `api_keys`
- relay 读取 `user` / `api_keys` 做 Bearer Token 鉴权
- relay 写 `request_logs` / `error_details` / `leaderboard` / `health_checks`
- 前端再直接读取这些表进行展示

## 共享协议注意事项

以下协议同时被前端和 relay 使用，修改时必须两边一起检查：

- API Key 格式：`ace_<hex>`
- `api_keys.id = md5(api_key)`
- Redis 缓存 key：`apikey:<md5>`
- 停用逻辑依赖 `user.status`

## 常用命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm start        # 运行生产服务器
npm run lint     # ESLint 检查
```

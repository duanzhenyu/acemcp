# AGENTS.md

## 工作区概览

这个目录下有两个**独立 Git 仓库**，共同组成 ACE MCP Relay：

- `acemcp-relay-frontend`：前端控制台，负责登录、API Key 管理、日志/排行榜/状态页展示
- `acemcp-relay`：Go relay 服务，负责把客户端请求转发到 Augment MCP / API 上游

它们不是单体 monorepo，但**共享同一套 PostgreSQL / Redis 数据**。

---

## 项目职责

### 1) `acemcp-relay-frontend`

- 技术栈：Next.js 16 / React 19 / TypeScript / Tailwind CSS / Better Auth
- 主要职责：
  - LinuxDo OAuth 登录
  - 用户控制台
  - API Key 生成、重置、展示
  - 请求日志、排行榜、健康状态展示
- 关键文件：
  - `app/console/page.tsx`：控制台主页面，含 MCP 配置文档
  - `app/status/page.tsx`：健康检查状态页
  - `app/login/page.tsx`：登录页
  - `app/api/key/route.ts`：创建/重置 API Key
  - `app/api/key/reveal/route.ts`：显示完整 API Key
  - `app/api/logs/route.ts`：日志列表与统计
  - `app/api/logs/[id]/route.ts`：日志详情
  - `app/api/leaderboard/route.ts`：排行榜
  - `app/api/health/history/route.ts`：健康检查历史
  - `app/api/user/route.ts`：当前用户信息
  - `lib/auth.ts`：Better Auth + LinuxDo OAuth 配置
  - `lib/db.ts`：前端侧数据库/Redis 访问层

### 2) `acemcp-relay`

- 技术栈：Go 1.25 / Gin / PostgreSQL / Redis
- 主要职责：
  - 校验 Bearer Token
  - 转发标准 HTTP 请求与 SSE 请求到上游 Augment API
  - 写入请求日志、错误详情、排行榜、健康检查
  - 对部分响应做脱敏/拦截
- 关键文件：
  - `main.go`：当前后端核心逻辑基本都在这里
  - `.env.example`：后端环境变量示例
  - `README.md`：支持路径、环境变量与运行说明

---

## 前后端数据边界

这是本工作区最重要的事实之一：

- **前端 `app/api/*` 不是通过 Go backend 获取业务数据**
- 前端 API 路由是**直接访问 PostgreSQL / Redis**
- Go 后端主要是**给 Augment / Auggie 客户端使用的 relay 层**

也就是说：

1. 前端负责登录与管理数据
2. 前端直接写 `api_keys` 等表
3. 后端读取这些表做鉴权与日志统计
4. 前端再直接读日志/排行榜/健康检查表进行展示

---

## 共享数据与联动点

两边通过同一套数据库/缓存协作：

- `api_keys`
  - 前端生成、重置
  - 后端用于 Bearer Token 鉴权
- `request_logs`
  - 后端写入
  - 前端读取并展示
- `error_details`
  - 后端写入
  - 前端日志详情页读取
- `leaderboard`
  - 后端定时统计写入
  - 前端排行榜页读取
- `health_checks`
  - 后端定时探测写入
  - 前端状态页读取

---

## 关键约束 / 易错点

### API Key 逻辑是前后端共享协议

修改 API Key 相关逻辑时，必须同时检查这两边：

- 前端：`acemcp-relay-frontend/lib/db.ts`
  - 生成格式：`ace_<hex>`
  - 主键 `id` 为 API Key 的 MD5
  - Redis 删除键名：`apikey:<md5>`
- 后端：`acemcp-relay/main.go`
  - `authenticateRequest()` 会对 Bearer Token 做 MD5
  - 再查 `api_keys.id`
  - Redis 缓存键同样是 `apikey:<md5>`

**如果你改了 key 格式、id 计算方式或缓存 key 规则，必须同步修改前后端。**

### 后端并不是前端业务 API

不要误把 Go relay 当成控制台后端：

- 控制台数据接口在 `acemcp-relay-frontend/app/api/*`
- Go 服务暴露的是 relay / proxy 能力，不是给网页控制台直接调用的 CRUD API

### 后端的主要修改入口在单文件 `main.go`

目前 Go 后端高度集中在一个文件内，常见修改点包括：

- `allowedPaths`
- `ssePaths`
- `authMiddleware()`
- `authenticateRequest()`
- `proxyHandler()`
- `sseProxyHandler()`
- `validateChatStreamRequest()`
- DB 初始化 / 自动迁移 / leaderboard / health scheduler

### 有几个特殊转发行为

- `/record-request-events` 与 `/report-error`：会被拦截，不转发到上游
- `/chat-stream`：有专门请求体验证
- `/get-models`：响应会脱敏
- pprof 固定监听 `127.0.0.1:6060`

---

## 常用命令

### 前端

```bash
cd acemcp-relay-frontend
npm install
npm run dev
npm run lint
npm run build
```

### 后端

```bash
cd acemcp-relay
go mod download
go run main.go
go build .
```

---

## 环境变量

### 前端：`acemcp-relay-frontend/.env.local`

基于 `.env.example`：

- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `AUTH_LINUXDO_ID`
- `AUTH_LINUXDO_SECRET`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `REDIS_HOST`
- `REDIS_PORT`

### 后端：`acemcp-relay/.env`

基于 `.env.example`：

- `SERVER_ADDR`
- `AUGMENT_API_URL`
- `AUGMENT_API_TOKEN`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `REDIS_PORT`
- `API_KEY_CACHE_TTL`
- `SESSION_TTL`

---

## 常见改动入口

### 改控制台 UI / 文档

- `acemcp-relay-frontend/app/console/page.tsx`

### 改登录 / OAuth

- `acemcp-relay-frontend/lib/auth.ts`
- `acemcp-relay-frontend/lib/auth-client.ts`
- `acemcp-relay-frontend/app/api/auth/[...all]/route.ts`
- `acemcp-relay-frontend/app/login/page.tsx`

### 改 API Key 生命周期

- `acemcp-relay-frontend/app/api/key/route.ts`
- `acemcp-relay-frontend/app/api/key/reveal/route.ts`
- `acemcp-relay-frontend/lib/db.ts`
- `acemcp-relay/main.go` 中鉴权逻辑

### 改日志 / 排行榜 / 状态页

- `acemcp-relay-frontend/app/api/logs/route.ts`
- `acemcp-relay-frontend/app/api/logs/[id]/route.ts`
- `acemcp-relay-frontend/app/api/leaderboard/route.ts`
- `acemcp-relay-frontend/app/api/health/history/route.ts`
- `acemcp-relay-frontend/app/status/page.tsx`
- `acemcp-relay-frontend/lib/db.ts`

### 改 relay / 上游兼容 / 路由白名单

- `acemcp-relay/main.go`

---

## 修改后建议验证

如果只改前端：

```bash
cd acemcp-relay-frontend
npm run lint
npm run build
```

如果只改后端：

```bash
cd acemcp-relay
go build .
```

如果改动涉及以下任一内容，建议联调前后端：

- API Key
- PostgreSQL 表结构
- Redis 缓存键
- 请求日志 / 排行榜 / 健康检查
- relay 路径或上游请求格式

---

## Agent 工作建议

1. **先确认你在改哪一个仓库**
   - 根目录只是工作区，不是实际应用入口
2. **涉及跨文件理解时优先做语义检索**
   - 优先考虑 `codebase-retrieval`
3. **涉及联网搜索、网页抓取、站点遍历、来源回溯、复杂检索规划时**
   - 优先使用 grok-search MCP
4. **不要基于假设修改共享协议**
   - 特别是 API Key、日志表、缓存 key、relay path
5. **涉及前后端共享逻辑时，默认检查两个项目**
   - 尤其是 `api_keys` / Redis / leaderboard / health_checks

---

## 当前仓库来源

- 前端：`https://github.com/duanzhenyu/acemcp-relay-frontend.git`
- 后端：`https://github.com/duanzhenyu/acemcp-relay.git`

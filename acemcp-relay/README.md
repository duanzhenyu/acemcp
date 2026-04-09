# acemcp-relay

Go HTTP relay / proxy，用于把客户端请求中继到 Augment API。基于 Gin 构建，支持标准 HTTP 请求与 SSE 流式传输。

## 功能特性

- **API 请求代理**：转发预定义的 Augment API 路径
- **SSE 流式传输**：支持 `/chat-stream` 和 `/prompt-enhancer`
- **API Key 鉴权**：Bearer Token → `md5(api_key)` → 查询 `api_keys.id`
- **Active 用户校验**：不仅校验 API Key，还会校验 `user.status='active'`
- **Redis 鉴权缓存**：缓存 `{user_id, status}`，降低高频鉴权开销
- **请求日志**：自动记录状态、耗时、来源 IP 等信息到 PostgreSQL
- **错误追踪**：异步记录 proxy / upstream 错误详情
- **隐私保护**：对 `/get-models` 响应中的用户敏感信息做脱敏
- **排行榜**：定时统计 `/agents/codebase-retrieval` 的每日用户请求量
- **健康检查**：周期探测上游 TCP 与 `/agents/codebase-retrieval` 可用性
- **请求验证**：对 `/chat-stream` 做请求体验证
- **安全拦截**：`/record-request-events` 与 `/report-error` 直接拦截，不转发上游

## 支持的 API 路径

### 标准代理路径

| 路径 | 说明 |
|------|------|
| `/get-models` | 获取模型列表（响应会脱敏） |
| `/settings/get-mcp-tenant-configs` | 获取租户级 MCP 配置 |
| `/settings/get-mcp-user-configs` | 获取用户级 MCP 配置 |
| `/agents/list-remote-tools` | 列出远程工具 |
| `/find-missing` | 查找缺失资源 |
| `/batch-upload` | 批量上传 |
| `/checkpoint-blobs` | 检查点数据 |
| `/agents/codebase-retrieval` | 代码库检索 |
| `/record-request-events` | 记录请求事件（拦截，不转发） |
| `/report-error` | 上报错误（拦截，不转发） |

### SSE 流式路径

| 路径 | 说明 |
|------|------|
| `/chat-stream` | 聊天流式传输（带请求体验证） |
| `/prompt-enhancer` | Prompt 增强 |

## 技术栈

- **语言**：Go 1.25
- **Web 框架**：Gin
- **数据库**：PostgreSQL
- **缓存**：Redis
- **依赖管理**：Go Modules

## 前置要求

- Go 1.25+
- PostgreSQL
- Redis

## 与前端的共享数据边界

relay 和前端共享同一套 PostgreSQL / Redis：

- 前端负责维护：`user`、`api_keys`
- relay 负责写入：`request_logs`、`error_details`、`leaderboard`、`health_checks`
- relay 鉴权依赖：
  - `api_keys.id = md5(api_key)`
  - Redis key：`apikey:<md5>`
  - `user.status` 必须为 `active`

这意味着：

- 前端停用用户后，relay 会拒绝该用户旧 API Key
- 前端重置 API Key 后，relay 旧缓存也必须同步失效

## 快速开始

### 1. 安装依赖

```bash
go mod download
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

### 3. 运行

```bash
go run main.go
```

### 4. 构建

```bash
go build -o acemcp-relay .
```

## 环境变量配置

通过 `.env` 文件或系统环境变量配置。

### 服务配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `SERVER_ADDR` | 服务监听地址 | `127.0.0.1:3009` |

### Augment API 配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `AUGMENT_API_URL` | Augment API 上游地址 | `https://your-api-url.com` |
| `AUGMENT_API_TOKEN` | Augment API 上游 Token | `token_xxx` |

### PostgreSQL 配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `DB_HOST` | 数据库主机 | `localhost` |
| `DB_PORT` | 数据库端口 | `5432` |
| `DB_USER` | 数据库用户名 | `postgres` |
| `DB_PASSWORD` | 数据库密码 | - |
| `DB_NAME` | 数据库名称 | `postgres` |

### Redis 配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `REDIS_HOST` | Redis 主机 | `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `API_KEY_CACHE_TTL` | API Key 鉴权缓存过期时间 | `1h` |

### Relay Session 配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `SESSION_TTL` | relay 模拟 CLI Session 的活跃续期时间 | `5m` |

> `API_KEY_CACHE_TTL` 与 `SESSION_TTL` 均支持 Go `time.ParseDuration` 格式，例如 `30m`、`1h`、`2h30m`。

## 数据库表结构

服务启动时会自动迁移/确保以下表存在：

- **`user`**：共享用户表，relay 读取 `status` 做 active 校验
- **`api_keys`**：共享 API Key 表，relay 用于 Bearer Token 鉴权
- **`request_logs`**：请求日志
- **`error_details`**：错误详情
- **`leaderboard`**：每日排行榜
- **`health_checks`**：健康检查结果

## 鉴权流程

1. 读取 `Authorization: Bearer <api_key>`
2. 计算 `md5(api_key)`
3. 先查 Redis：`apikey:<md5>`
4. 缓存未命中时查询 PostgreSQL：
   - `api_keys.id`
   - 关联 `user.status`
5. 仅当用户状态为 `active` 时允许放行

## 日志

服务日志同时输出到控制台和 `gin.log` 文件。

## 常用命令

```bash
go run main.go
go build .
```

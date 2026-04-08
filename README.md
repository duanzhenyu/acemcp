# acemcp

ACE MCP Relay 的 monorepo，包含：

- `acemcp-relay-frontend`：Next.js 控制台
- `acemcp-relay`：Go relay / proxy

推荐使用根目录 `docker compose` 一起启动整套环境。

## 目录结构

```text
.
├── acemcp-relay/             # Go relay 服务
├── acemcp-relay-frontend/    # Next.js 前端控制台
├── docker-compose.yml        # 一键启动前后端 + PostgreSQL + Redis
├── .env.example              # 根目录 compose 环境变量示例
└── AGENTS.md                 # 工作区说明
```

## 服务说明

### 前端：`acemcp-relay-frontend`

- Next.js 16 / React 19 / TypeScript
- 负责：
  - LinuxDo OAuth 登录
  - API Key 管理
  - 请求日志、排行榜、状态页
  - MCP 配置文档展示

### 后端：`acemcp-relay`

- Go 1.25 / Gin
- 负责：
  - Bearer Token 鉴权
  - 转发 Augment API / MCP 请求
  - SSE 转发
  - 请求日志、错误详情、排行榜、健康检查写入

### 基础设施

- PostgreSQL：存储用户、API Key、日志、排行榜、健康检查
- Redis：缓存 API Key

## 一键启动（推荐）

### 1. 复制根目录环境变量

```bash
cp .env.example .env
```

至少需要按需填写：

- `BETTER_AUTH_SECRET`
- `AUTH_LINUXDO_ID`
- `AUTH_LINUXDO_SECRET`
- `AUGMENT_API_URL`
- `AUGMENT_API_TOKEN`

默认本地访问地址：

- 前端：`http://localhost:3000`
- relay：`http://localhost:3009`

### 2. 构建并启动

```bash
docker compose up --build -d
```

查看日志：

```bash
docker compose logs -f frontend
docker compose logs -f backend
```

停止：

```bash
docker compose down
```

如果要连同数据库数据卷一起清理：

```bash
docker compose down -v
```

## Docker Compose 启动内容

根目录 `docker-compose.yml` 会启动 4 个服务：

- `frontend`
- `backend`
- `postgres`
- `redis`

其中：

- 前端暴露宿主机 `3000`
- 后端暴露宿主机 `3009`
- PostgreSQL / Redis 默认仅在 compose 内网使用，不直接暴露到宿主机

## Monorepo 启动说明

### 方式一：直接使用 Docker Compose

适合完整联调：

```bash
docker compose up --build
```

### 方式二：分别本地启动

适合单独开发某个子项目。

#### 启动前端

```bash
cd acemcp-relay-frontend
cp .env.example .env.local
npm install
npm run dev
```

#### 启动后端

```bash
cd acemcp-relay
cp .env.example .env
go mod download
go run main.go
```

## 关键环境变量

### 根目录 `.env`

| 变量 | 用途 |
|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | compose 内 PostgreSQL |
| `BETTER_AUTH_URL` | 前端 Better Auth 对外地址 |
| `BETTER_AUTH_SECRET` | Better Auth 密钥 |
| `AUTH_LINUXDO_ID` / `AUTH_LINUXDO_SECRET` | LinuxDo OAuth |
| `NEXT_PUBLIC_RELAY_URL` | 前端控制台显示给用户的 relay URL |
| `AUGMENT_API_URL` | Go relay 上游 Augment API 地址 |
| `AUGMENT_API_TOKEN` | Go relay 上游 Token |
| `API_KEY_CACHE_TTL` | relay Redis 缓存 TTL |
| `SESSION_TTL` | relay Session TTL |

> `NEXT_PUBLIC_RELAY_URL` 会在前端构建时写入页面展示文案；修改后请重新执行 `docker compose up --build`。

## 访问与使用

启动后：

1. 打开 `http://localhost:3000`
2. 使用 LinuxDo 登录
3. 在控制台生成 API Key
4. 按页面上的 MCP 配置示例，把：
   - `AUGMENT_API_TOKEN` 设为你的 API Key
   - `AUGMENT_API_URL` 设为 relay 地址（默认 `http://localhost:3009/`）

## 重要实现边界

- 前端 `app/api/*` 是**直接访问 PostgreSQL / Redis**
- Go 后端不是控制台 CRUD API，而是 **Augment relay**
- `api_keys` 是前后端共享协议：
  - 前端生成 key
  - 后端将 Bearer Token 做 MD5 后查 `api_keys.id`
  - Redis 缓存键格式为 `apikey:<md5>`

如果修改以下内容，前后端需要一起检查：

- API Key 格式
- `api_keys.id` 计算方式
- Redis 缓存 key
- 日志/排行榜/健康检查相关表

## 常用命令

### 根目录

```bash
docker compose up --build -d
docker compose logs -f
docker compose down
```

### 前端

```bash
cd acemcp-relay-frontend
npm run lint
npm run build
```

### 后端

```bash
cd acemcp-relay
go build .
```

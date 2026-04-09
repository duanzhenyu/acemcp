# acemcp

ACE MCP Relay 工作区，包含两个独立仓库：

- `acemcp-relay-frontend`：Next.js 管理控制台，负责 **API Key 登录、用户管理、日志/排行榜/状态页**
- `acemcp-relay`：Go relay / proxy，负责 **Bearer Token 鉴权、请求转发、日志写入、排行榜与健康检查**

推荐使用根目录 `docker compose` 一起启动整套环境。

## 目录结构

```text
.
├── acemcp-relay/             # Go relay 服务
├── acemcp-relay-frontend/    # Next.js 前端控制台
├── deploy/                   # 部署相关配置
├── scripts/                  # 构建 / 发布脚本
├── docker-compose.yml        # 一键启动前后端 + PostgreSQL + Redis
├── .env.example              # 根目录 compose 环境变量示例
└── AGENTS.md                 # 工作区说明
```

## 当前登录模型

项目已切换为 **管理员预置 API Key + 前端 API Key 会话**：

- LinuxDo OAuth / Better Auth 不再是主登录流程
- 前端登录页只接受 API Key
- 管理员在 `/admin/users` 中创建用户并自动生成 API Key
- 普通用户使用该 API Key：
  - 登录前端控制台
  - 作为 `AUGMENT_API_TOKEN` 调用 relay
- 用户被停用后：
  - 前端无法继续登录
  - relay Bearer Token 也会立即失效

## 一键启动（推荐）

### 1. 复制根目录环境变量

```bash
cp .env.example .env
```

至少需要填写：

- `WEB_SESSION_SECRET`
- `BOOTSTRAP_ADMIN_API_KEY`
- `ADMIN_USER_IDS`
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

## 首次初始化流程

1. 在根目录 `.env` 设置 `BOOTSTRAP_ADMIN_API_KEY`
2. 启动 `docker compose up --build -d`
3. 打开 `http://localhost:3000/login`
4. 使用 `BOOTSTRAP_ADMIN_API_KEY` 登录管理员账号
5. 进入 `/admin/users` 创建普通用户
6. 将生成的 API Key 分发给对应用户
7. 用户在控制台登录，或把该 Key 作为 `AUGMENT_API_TOKEN` 使用 relay

> `BOOTSTRAP_ADMIN_API_KEY` 对应的管理员用户会在前端首次访问数据库时自动创建/同步。

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

## 内网主机部署（可追踪）

当前内网主机的实际发布方式已经整理进仓库：

- 前端运行时覆盖配置：`deploy/internal-host/docker-compose.frontend-runtime.yml`
- 前端运行时打包脚本：`scripts/build-frontend-runtime.sh`
- 后端 `linux/amd64` 构建脚本：`scripts/build-backend-amd64.sh`
- 内网主机发布脚本：`scripts/deploy-internal-host.sh`

关键事实：

- 本地开发机通常是 **ARM**
- 内网主机是 **AMD64**
- 前端线上实际运行目录是 **`/srv/acemcp-frontend`**
- 后端当前沿用容器内 `/app/acemcp-relay`，发布脚本会把新的 amd64 二进制覆盖进去并重启容器
- 脚本默认只同步 `_dist/` 产物和 compose override，不会改远端 `.env`

### 1. 本地生成发布产物

```bash
./scripts/build-backend-amd64.sh
./scripts/build-frontend-runtime.sh
```

产物默认输出到：

- `dist/backend/acemcp-relay-linux-amd64`
- `dist/frontend-runtime/`
- `dist/frontend-runtime.tgz`

### 2. 发布到内网主机

```bash
ACE_RELAY_REMOTE_HOST=19730513uu.oicp.vip \
ACE_RELAY_REMOTE_PORT=1022 \
ACE_RELAY_REMOTE_USER=root \
ACE_RELAY_REMOTE_DIR=/home/tools/acemcp-relay-stack \
ACE_RELAY_REMOTE_PASSWORD='your-password' \
./scripts/deploy-internal-host.sh
```

脚本会：

1. 构建前端 runtime 与后端 amd64 二进制
2. 同步前端 runtime 到远端 `_dist/frontend-runtime`
3. 同步后端二进制到远端 `_dist/backend`
4. 同步 `deploy/internal-host/docker-compose.frontend-runtime.yml`
5. 通过 compose recreate 前端，使其从 `/srv/acemcp-frontend` 启动
6. 将新的后端二进制复制进 `acemcp-relay-backend` 容器并重启

如果已经手工构建好产物，可加：

```bash
./scripts/deploy-internal-host.sh --skip-build
```

更详细的部署说明见：

- `deploy/internal-host/README.md`

## 关键环境变量

### 根目录 `.env`

| 变量 | 用途 |
|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | compose 内 PostgreSQL |
| `WEB_SESSION_SECRET` | 前端 API Key Web Session 签名密钥 |
| `WEB_SESSION_TTL` | 前端登录 Cookie 有效期 |
| `ADMIN_USER_IDS` | 管理员用户 ID 列表，逗号分隔 |
| `BOOTSTRAP_ADMIN_USER_ID` / `BOOTSTRAP_ADMIN_NAME` / `BOOTSTRAP_ADMIN_NOTE` | 默认管理员资料 |
| `BOOTSTRAP_ADMIN_API_KEY` | 首个管理员登录 Key |
| `NEXT_PUBLIC_RELAY_URL` | 前端展示给用户的 relay URL |
| `AUGMENT_API_URL` | Go relay 上游 Augment API 地址 |
| `AUGMENT_API_TOKEN` | Go relay 上游 Token |
| `API_KEY_CACHE_TTL` | relay Redis 鉴权缓存 TTL |
| `SESSION_TTL` | relay 模拟 CLI 会话 TTL |

> `NEXT_PUBLIC_RELAY_URL` 会在前端构建时写入页面展示文案；修改后请重新执行 `docker compose up --build`。
>
> 对于内网主机发布，还需要重新执行 `scripts/build-frontend-runtime.sh` 并重新部署前端 runtime。

## 使用方式

启动后：

1. 管理员访问 `http://localhost:3000/login`
2. 使用 bootstrap 或已分配 API Key 登录
3. 管理员在 `/admin/users` 创建/编辑/停用用户
4. 普通用户登录 `/console` 查看自己的 API Key、日志和配置说明
5. 客户端把：
   - `AUGMENT_API_TOKEN` 设为用户 API Key
   - `AUGMENT_API_URL` 设为 relay 地址（默认 `http://localhost:3009/`）

## 重要实现边界

- 前端 `app/api/*` 是 **直接访问 PostgreSQL / Redis**
- Go 后端不是控制台 CRUD API，而是 **Augment relay**
- `api_keys` 是前后端共享协议：
  - key 格式：`ace_<hex>`
  - `api_keys.id = md5(api_key)`
  - Redis 缓存 key：`apikey:<md5>`
- relay 鉴权除了检查 `api_keys.id`，还会额外校验 `user.status='active'`

如果修改以下内容，前后端需要一起检查：

- API Key 格式
- `api_keys.id` 计算方式
- Redis 缓存 key
- 用户状态字段与停用逻辑
- 日志/排行榜/健康检查相关表

## 常用命令

### 根目录

```bash
docker compose up --build -d
docker compose logs -f
docker compose down
```

### 内网主机发布

```bash
./scripts/build-backend-amd64.sh
./scripts/build-frontend-runtime.sh
./scripts/deploy-internal-host.sh --skip-build
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

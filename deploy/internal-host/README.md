# 内网主机部署（可追踪版）

本文档固化当前内网主机的实际发布方式，避免再次出现“改了容器里的 `/app`，但线上页面仍然是旧版本”的问题。

## 当前真实运行方式

- 远端主目录：`/home/tools/acemcp-relay-stack`
- 前端实际运行目录（容器内）：`/srv/acemcp-frontend`
- 前端运行时来源（宿主机）：`/home/tools/acemcp-relay-stack/_dist/frontend-runtime`
- 前端 compose override：`docker-compose.frontend-runtime.yml`
- 后端二进制实际运行路径（容器内）：`/app/acemcp-relay`

也就是说：

- **前端不能只改 `/app`**
- 前端必须重新生成 runtime 产物并同步到 `_dist/frontend-runtime`
- 然后用 compose recreate `frontend`

## 仓库内对应文件

- `deploy/internal-host/docker-compose.frontend-runtime.yml`
- `scripts/build-frontend-runtime.sh`
- `scripts/build-backend-amd64.sh`
- `scripts/deploy-internal-host.sh`

## 推荐流程

### 1. 本地构建

```bash
./scripts/build-backend-amd64.sh
./scripts/build-frontend-runtime.sh
```

### 2. 发布

```bash
ACE_RELAY_REMOTE_HOST=19730513uu.oicp.vip \
ACE_RELAY_REMOTE_PORT=1022 \
ACE_RELAY_REMOTE_USER=root \
ACE_RELAY_REMOTE_DIR=/home/tools/acemcp-relay-stack \
ACE_RELAY_REMOTE_PASSWORD='your-password' \
./scripts/deploy-internal-host.sh
```

## 脚本行为说明

发布脚本会：

1. 将前端 runtime 同步到远端 `_dist/frontend-runtime`
2. 将后端 `linux/amd64` 二进制同步到远端 `_dist/backend`
3. 将 `docker-compose.frontend-runtime.yml` 同步到远端主目录
4. 执行：

```bash
docker compose -f docker-compose.yml -f docker-compose.frontend-runtime.yml up -d --no-build --force-recreate frontend
```

5. 把新的后端二进制复制进 `acemcp-relay-backend` 容器
6. 重启 `acemcp-relay-backend`

## 不会被修改的内容

脚本默认不会改：

- 远端 `.env`
- 远端主 `docker-compose.yml`
- PostgreSQL / Redis 数据目录

## 适用场景

- 本地是 ARM，服务器是 AMD64
- 只想同步最新前端 runtime / 后端二进制
- 需要保留服务器既有环境变量与数据

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SKIP_BUILD=0
if [[ "${1:-}" == "--skip-build" ]]; then
  SKIP_BUILD=1
fi

REMOTE_HOST="${ACE_RELAY_REMOTE_HOST:?ACE_RELAY_REMOTE_HOST is required}"
REMOTE_USER="${ACE_RELAY_REMOTE_USER:-root}"
REMOTE_PORT="${ACE_RELAY_REMOTE_PORT:-22}"
REMOTE_DIR="${ACE_RELAY_REMOTE_DIR:-/home/tools/acemcp-relay-stack}"
REMOTE_PASSWORD="${ACE_RELAY_REMOTE_PASSWORD:-}"

REMOTE_FRONTEND_SERVICE="${ACE_RELAY_FRONTEND_SERVICE:-frontend}"
REMOTE_BACKEND_CONTAINER="${ACE_RELAY_BACKEND_CONTAINER:-acemcp-relay-backend}"
REMOTE_OVERRIDE_FILE="${ACE_RELAY_REMOTE_OVERRIDE_FILE:-docker-compose.frontend-runtime.yml}"

FRONTEND_TAR="${ACE_RELAY_FRONTEND_DIST_TAR:-$ROOT_DIR/dist/frontend-runtime.tgz}"
BACKEND_BIN="${ACE_RELAY_BACKEND_DIST_DIR:-$ROOT_DIR/dist/backend}/acemcp-relay-linux-amd64"
LOCAL_OVERRIDE_FILE="$ROOT_DIR/deploy/internal-host/docker-compose.frontend-runtime.yml"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  "$ROOT_DIR/scripts/build-backend-amd64.sh"
  "$ROOT_DIR/scripts/build-frontend-runtime.sh"
fi

if [[ ! -f "$FRONTEND_TAR" ]]; then
  echo "[-] Missing frontend runtime tarball: $FRONTEND_TAR" >&2
  exit 1
fi

if [[ ! -f "$BACKEND_BIN" ]]; then
  echo "[-] Missing backend binary: $BACKEND_BIN" >&2
  exit 1
fi

TARGET="$REMOTE_USER@$REMOTE_HOST"

if [[ -n "$REMOTE_PASSWORD" ]]; then
  SSH_CMD=(sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT")
  SCP_CMD=(sshpass -p "$REMOTE_PASSWORD" scp -P "$REMOTE_PORT" -o StrictHostKeyChecking=no)
else
  SSH_CMD=(ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT")
  SCP_CMD=(scp -P "$REMOTE_PORT" -o StrictHostKeyChecking=no)
fi

REMOTE_FRONTEND_TAR="$REMOTE_DIR/_dist/frontend-runtime.tgz"
REMOTE_BACKEND_BIN="$REMOTE_DIR/_dist/backend/acemcp-relay-linux-amd64"

echo "[+] Ensuring remote directories..."
"${SSH_CMD[@]}" "$TARGET" "mkdir -p '$REMOTE_DIR/_dist/frontend-runtime' '$REMOTE_DIR/_dist/backend'"

echo "[+] Uploading frontend runtime tarball..."
"${SCP_CMD[@]}" "$FRONTEND_TAR" "$TARGET:$REMOTE_FRONTEND_TAR"

echo "[+] Uploading backend binary..."
"${SCP_CMD[@]}" "$BACKEND_BIN" "$TARGET:$REMOTE_BACKEND_BIN"

echo "[+] Uploading compose override..."
"${SCP_CMD[@]}" "$LOCAL_OVERRIDE_FILE" "$TARGET:$REMOTE_DIR/$REMOTE_OVERRIDE_FILE"

echo "[+] Applying remote deployment..."
"${SSH_CMD[@]}" "$TARGET" "set -euo pipefail; \
  cd '$REMOTE_DIR'; \
  rm -rf _dist/frontend-runtime/*; \
  tar -xzf '$REMOTE_FRONTEND_TAR' -C _dist/frontend-runtime; \
  chmod +x '$REMOTE_BACKEND_BIN'; \
  docker compose -f docker-compose.yml -f '$REMOTE_OVERRIDE_FILE' up -d --no-build --force-recreate '$REMOTE_FRONTEND_SERVICE'; \
  docker cp '$REMOTE_BACKEND_BIN' '$REMOTE_BACKEND_CONTAINER:/app/acemcp-relay'; \
  docker restart '$REMOTE_BACKEND_CONTAINER' >/dev/null; \
  docker compose ps"

echo "[+] Remote deployment finished."

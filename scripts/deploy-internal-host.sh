#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_HOST="${ACE_RELAY_REMOTE_HOST:?ACE_RELAY_REMOTE_HOST is required}"
REMOTE_USER="${ACE_RELAY_REMOTE_USER:-root}"
REMOTE_PORT="${ACE_RELAY_REMOTE_PORT:-22}"
REMOTE_DIR="${ACE_RELAY_REMOTE_DIR:-/home/tools/acemcp-relay-stack}"
REMOTE_PASSWORD="${ACE_RELAY_REMOTE_PASSWORD:-}"

if [[ -n "$REMOTE_PASSWORD" ]]; then
  SSH_CMD=(sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT")
  RSYNC_SSH="sshpass -p $REMOTE_PASSWORD ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT"
else
  SSH_CMD=(ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT")
  RSYNC_SSH="ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT"
fi

TARGET="$REMOTE_USER@$REMOTE_HOST"

echo "[+] Syncing source to remote..."
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude 'dist/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '!.env.example' \
  --exclude '_dist/' \
  -e "$RSYNC_SSH" \
  "$ROOT_DIR/" "$TARGET:$REMOTE_DIR/"

echo "[+] Building and deploying on remote..."
"${SSH_CMD[@]}" "$TARGET" "set -euo pipefail; \
  cd '$REMOTE_DIR'; \
  docker compose build; \
  docker compose up -d; \
  docker compose ps"

echo "[+] Remote deployment finished."

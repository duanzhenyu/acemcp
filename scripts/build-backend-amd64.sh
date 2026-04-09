#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/acemcp-relay"
OUT_DIR="${ACE_RELAY_BACKEND_DIST_DIR:-$ROOT_DIR/dist/backend}"
OUT_BIN="$OUT_DIR/acemcp-relay-linux-amd64"

mkdir -p "$OUT_DIR"

echo "[+] Building backend linux/amd64 binary..."
(
  cd "$BACKEND_DIR"
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o "$OUT_BIN" .
)

chmod +x "$OUT_BIN"

echo "[+] Backend binary ready: $OUT_BIN"

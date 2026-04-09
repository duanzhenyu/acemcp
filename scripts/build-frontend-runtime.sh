#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/acemcp-relay-frontend"
OUT_DIR="${ACE_RELAY_FRONTEND_DIST_DIR:-$ROOT_DIR/dist/frontend-runtime}"
OUT_TAR="${ACE_RELAY_FRONTEND_DIST_TAR:-$ROOT_DIR/dist/frontend-runtime.tgz}"

echo "[+] Building frontend runtime..."
(
  cd "$FRONTEND_DIR"
  npm run build
)

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/.next/static" "$ROOT_DIR/dist"

rsync -a "$FRONTEND_DIR/.next/standalone/" "$OUT_DIR/"
rsync -a "$FRONTEND_DIR/.next/static/" "$OUT_DIR/.next/static/"
rsync -a "$FRONTEND_DIR/public/" "$OUT_DIR/public/"

tar -C "$OUT_DIR" -czf "$OUT_TAR" .

echo "[+] Frontend runtime directory: $OUT_DIR"
echo "[+] Frontend runtime tarball:   $OUT_TAR"

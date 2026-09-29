#!/bin/bash
# LIVING CITY — container entrypoint: Hindsight (internal :8888) + Next.js (public :7860)
set -e

echo "[living-city] starting Hindsight memory server..."

# LLM gateway config comes from environment/secrets:
#   HINDSIGHT_API_LLM_API_KEY, HINDSIGHT_API_LLM_DEFAULT_HEADERS (JSON), optional HINDSIGHT_API_LLM_BASE_URL/MODEL
export HINDSIGHT_API_LLM_PROVIDER="${HINDSIGHT_API_LLM_PROVIDER:-openai}"
export HINDSIGHT_API_LLM_BASE_URL="${HINDSIGHT_API_LLM_BASE_URL:-https://internal-api.z.ai/v1}"
export HINDSIGHT_API_LLM_MODEL="${HINDSIGHT_API_LLM_MODEL:-glm-4.6}"
export HINDSIGHT_API_LLM_MAX_TOKENS="${HINDSIGHT_API_LLM_MAX_TOKENS:-4096}"

mkdir -p "$HINDSIGHT_API_DATA_DIR" /app/db

/opt/hindsight-venv/bin/python3 -u -m hindsight_api.main --host 127.0.0.1 --port 8888 \
  > /tmp/hindsight.log 2>&1 &

# Wait for Hindsight health (max 90s — ONNX model downloads on first boot)
for i in $(seq 1 90); do
  if curl -s -m 2 http://127.0.0.1:8888/health | grep -q healthy; then
    echo "[living-city] Hindsight healthy (attempt $i)"
    break
  fi
  if [ "$i" = "90" ]; then
    echo "[living-city] WARNING: Hindsight not healthy yet — continuing in degraded mode"
    tail -20 /tmp/hindsight.log || true
  fi
  sleep 1
done

echo "[living-city] ensuring database schema..."
cd /app && bunx prisma db push --skip-generate || echo "[living-city] WARN: db push failed (may already exist)"

echo "[living-city] starting Next.js on :${PORT}..."
cd /app
if [ -f .next/standalone/server.js ]; then
  cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
  cp -r public .next/standalone/ 2>/dev/null || true
  exec node .next/standalone/server.js
else
  exec ./node_modules/.bin/next start -p "${PORT}"
fi

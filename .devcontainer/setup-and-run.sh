#!/bin/bash
# LIVING CITY — Codespace bootstrap.
#   full  = install deps, build app, install Hindsight, start both servers
#   quick = (on restart) just ensure both servers are running
set -e
MODE="${1:-quick}"
cd "$GITHUB_WORKSPACE"

HVENV="$HOME/hvenv"
LOG="$HOME/living-city.log"

is_hindsight() { curl -s -m 2 http://127.0.0.1:8888/health | grep -q healthy; }
is_app()       { curl -s -m 3 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ | grep -q 200; }

start_hindsight() {
  mkdir -p "$HOME/hindsight-data"
  export HINDSIGHT_API_LLM_PROVIDER="${HINDSIGHT_API_LLM_PROVIDER:-openai}"
  export HINDSIGHT_API_LLM_BASE_URL="${HINDSIGHT_API_LLM_BASE_URL:-https://internal-api.z.ai/v1}"
  export HINDSIGHT_API_LLM_MODEL="${HINDSIGHT_API_LLM_MODEL:-glm-4.6}"
  export HINDSIGHT_API_LLM_MAX_TOKENS="${HINDSIGHT_API_LLM_MAX_TOKENS:-4096}"
  export HINDSIGHT_API_EMBEDDINGS_PROVIDER=onnx
  export HINDSIGHT_API_RERANKER_PROVIDER=rrf
  export HINDSIGHT_API_WORKER_MAX_SLOTS=2
  export HINDSIGHT_API_WORKER_ENABLED=false
  export OMP_NUM_THREADS=1
  export HINDSIGHT_API_LLM_TIMEOUT=60
  export HINDSIGHT_API_LLM_CONNECT_TIMEOUT=15
  export HINDSIGHT_API_DATA_DIR="$HOME/hindsight-data"
  nohup "$HVENV/bin/python3" -u -m hindsight_api.main --host 127.0.0.1 --port 8888 >> "$LOG" 2>&1 &
  disown || true
}

start_app() {
  if [ -f .next/standalone/server.js ]; then
    (cd .next/standalone && PORT=3000 HOSTNAME=0.0.0.0 nohup node server.js >> "$LOG" 2>&1 &)
  else
    (PORT=3000 nohup ./node_modules/.bin/next start -p 3000 >> "$LOG" 2>&1 &)
  fi
  disown || true
}

if [ "$MODE" = "full" ]; then
  echo "== [1/5] bun install" && bun install
  echo "== [2/5] prisma" && bunx prisma generate && bunx prisma db push
  echo "== [3/5] next build (production, standalone)" && NODE_ENV=production bun run build
  echo "== [4/5] hindsight-api deps" \
    && python3 -m venv "$HVENV" \
    && "$HVENV/bin/pip" install -q "hindsight-api==0.10.1" \
    && "$HVENV/bin/pip" install -q --force-reinstall "fastmcp==3.2.4" "starlette==0.49.3" \
    && "$HVENV/bin/pip" install -q transformers onnx
  echo "== [5/5] starting services"
  start_hindsight
  start_app
  echo "setup done — logs: $LOG"
else
  is_hindsight || start_hindsight
  is_app || start_app
  echo "quick check done"
fi

sleep 2
is_hindsight && echo "HINDSIGHT: healthy" || echo "HINDSIGHT: starting (ONNX downloads on first boot)"
is_app && echo "APP: healthy" || echo "APP: starting"

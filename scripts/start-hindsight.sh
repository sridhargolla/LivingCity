#!/bin/bash
# LIVING CITY — start the real Hindsight memory server (self-hosted, pip install hindsight-api).
# LLM provider: the sandbox OpenAI-compatible gateway (chat/completions).
set -a
ZCFG=$(python3 - <<'PY'
import json
c = json.load(open('/etc/.z-ai-config'))
print(c.get('apiKey','') + '\n' + c.get('token',''))
PY
)
set +a
APIKEY=$(echo "$ZCFG" | head -1)
TOKEN=$(echo "$ZCFG" | tail -1)
export HINDSIGHT_API_LLM_PROVIDER=openai
export HINDSIGHT_API_LLM_BASE_URL=https://internal-api.z.ai/v1
export HINDSIGHT_API_LLM_API_KEY="$APIKEY"
export HINDSIGHT_API_LLM_MODEL=glm-4.6
export HINDSIGHT_API_LLM_DEFAULT_HEADERS="{\"X-Token\":\"$TOKEN\",\"X-Z-AI-From\":\"Z\"}"
export HINDSIGHT_API_LLM_MAX_TOKENS=4096
export HINDSIGHT_API_DATA_DIR=/home/z/my-project/hindsight-data
mkdir -p "$HINDSIGHT_API_DATA_DIR"
exec /home/z/.venv/bin/hindsight-api --host 0.0.0.0 --port 8888

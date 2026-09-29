#!/bin/bash
# LIVING CITY — deploy to a free public Hugging Face Space (Docker SDK).
# Usage:  HF_TOKEN=hf_xxx HF_USERNAME=sridhargolla bash deploy/push-to-hf.sh
set -e

HF_TOKEN="${HF_TOKEN:?Set HF_TOKEN}"
HF_USERNAME="${HF_USERNAME:?Set HF_USERNAME}"
SPACE="${SPACE_NAME:-LivingCity}"
REPO="$HF_USERNAME/$SPACE"
SPACE_URL="https://huggingface.co/spaces/$REPO"
LIVE_URL="https://$HF_USERNAME-$SPACE.hf.space"

echo "== Creating Space $REPO (docker sdk) =="
curl -s -X POST "https://huggingface.co/api/repos" \
  -H "Authorization: Bearer $HF_TOKEN" -H "Content-Type: application/json" \
  -d "{\"type\":\"space\",\"name\":\"$SPACE\",\"sdk\":\"docker\",\"private\":false}" | head -c 200
echo

echo "== Pushing LLM secrets into the Space =="
python3 - <<'PY'
import json, os, urllib.request
cfg = json.load(open('/etc/.z-ai-config'))
token = os.environ['HF_TOKEN']
repo = os.environ['REPO']
def set_secret(name, value):
    req = urllib.request.Request(
        f"https://huggingface.co/api/spaces/{repo}/secrets",
        data=json.dumps({"key": name, "value": value, "description": "auto"}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST")
    try:
        print(name, urllib.request.urlopen(req).status)
    except Exception as e:
        print(name, "FAILED:", e)
set_secret("HINDSIGHT_API_LLM_API_KEY", cfg.get("apiKey", ""))
set_secret("HINDSIGHT_API_LLM_DEFAULT_HEADERS", json.dumps({"X-Token": cfg.get("token", ""), "X-Z-AI-From": "Z"}))
PY
export REPO

echo "== Cloning Space repo =="
WORK=$(mktemp -d)
git clone "https://$HF_USERNAME:$HF_TOKEN@huggingface.co/spaces/$REPO" "$WORK/space" 2>/dev/null

echo "== Copying project =="
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude db/custom.db --exclude hindsight-data --exclude '*.log' \
  --exclude .env --exclude 'shot-*.png' --exclude tool-results \
  --exclude tests --exclude examples --exclude .zscripts \
  /home/z/my-project/ "$WORK/space/"
mv "$WORK/space/README.md" "$WORK/space/README-project.md"
cp /home/z/my-project/deploy/space-README.md "$WORK/space/README.md"
cp /home/z/my-project/deploy/Dockerfile "$WORK/space/Dockerfile"

cd "$WORK/space"
git add -A
git -c user.name="$HF_USERNAME" -c user.email="$HF_USERNAME@users.noreply.huggingface.co" \
  commit -q -m "Living City — deploy" || echo "no changes"
echo "== Pushing to Space (HF builds the Docker image; first build ~8-15 min) =="
git push -f origin main 2>&1 | tail -3

echo
echo "✅ Deployed: build logs at $SPACE_URL"
echo "🌍 Live URL (once build finishes): $LIVE_URL"

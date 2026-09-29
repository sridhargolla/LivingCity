# LIVING CITY — all-in-one production image
# Runs: Hindsight memory server (:8888, internal) + Next.js app (:7860, public/HF)

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="/usr/local/bun/bin:/usr/local/bin:${PATH}"
ENV PYTHONUNBUFFERED=1
ENV HF_HUB_DISABLE_TELEMETRY=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg git python3.12 python3.12-venv python3-pip \
    build-essential openssl sqlite3 \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bunx prisma generate && bunx prisma db push \
 && NODE_ENV=production bun run build

# Hindsight server — exact versions proven working in dev
RUN python3.12 -m venv /opt/hindsight-venv \
 && /opt/hindsight-venv/bin/pip install --no-cache-dir "hindsight-api==0.10.1" \
 && /opt/hindsight-venv/bin/pip install --no-cache-dir --force-reinstall "fastmcp==3.2.4" "starlette==0.49.3" \
 && /opt/hindsight-venv/bin/pip install --no-cache-dir transformers onnx

RUN useradd -m -u 1000 appuser \
 && mkdir -p /app/db /app/hindsight-data /app/.pg0 \
 && chown -R appuser:appuser /app /opt/hindsight-venv
USER appuser

ENV PORT=7860
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/db/custom.db
ENV HINDSIGHT_BASE_URL=http://127.0.0.1:8888
ENV HINDSIGHT_ENABLED=true
ENV HINDSIGHT_API_EMBEDDINGS_PROVIDER=onnx
ENV HINDSIGHT_API_RERANKER_PROVIDER=rrf
ENV HINDSIGHT_API_WORKER_MAX_SLOTS=2
ENV HINDSIGHT_API_WORKER_ENABLED=false
ENV OMP_NUM_THREADS=1
ENV HINDSIGHT_API_LLM_TIMEOUT=60
ENV HINDSIGHT_API_LLM_CONNECT_TIMEOUT=15
ENV HINDSIGHT_API_DATA_DIR=/app/hindsight-data

EXPOSE 7860

COPY --chown=appuser deploy/start.sh /app/deploy/start.sh
RUN chmod +x /app/deploy/start.sh

CMD ["/app/deploy/start.sh"]

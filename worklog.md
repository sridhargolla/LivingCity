# LIVING CITY — Build Worklog

Project: Living City ("A city that remembers.") — Hyderabad city-operations memory agent for the Hindsight hackathon.

---

Task ID: 0
Agent: lead (main orchestrator)
Task: Repository audit + Hindsight research + data source verification

Work Log:
- Audited repository: fresh Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui scaffold; Prisma+SQLite configured (db/custom.db); no existing Hindsight integration; no tests; examples/websocket demo present.
- Researched Hindsight (vectorize-io/hindsight) from official repo + npm client:
  - Server: `pip install hindsight-api` (v0.10.1), default port 8888, embedded pg0 PostgreSQL.
  - LLM config: HINDSIGHT_API_LLM_PROVIDER=openai, HINDSIGHT_API_LLM_BASE_URL, HINDSIGHT_API_LLM_API_KEY, HINDSIGHT_API_LLM_MODEL, HINDSIGHT_API_LLM_DEFAULT_HEADERS (JSON dict).
  - Client: @vectorize-io/hindsight-client@0.10.1 (installed). Verified API: retain(bankId, content, {timestamp, context, metadata, tags}), recall(bankId, query, {types, budget, maxTokens}), reflect(bankId, query, {responseSchema}), listMemories. RecallResult: {id, text, type, occurred_start, occurred_end, metadata, context, score?}.
  - Sandbox found OpenAI-compatible gateway at https://internal-api.z.ai/v1 (config in /etc/.z-ai-config with apiKey + required X-Token header) — verified working with model "glm-4.6".
- Verified real data sources for Hyderabad (17.385, 78.4867):
  - Open-Meteo air-quality API: WORKS (real PM2.5/PM10/US AQI, no key).
  - Open-Meteo forecast: daily IP limit currently exceeded from shared sandbox IP (resets daily); still primary adapter (free tier, no key).
  - wttr.in JSON: WORKS (current conditions, no key) — fallback adapter.
- Installed @vectorize-io/hindsight-client@0.10.1 into project.
- Started `pip install hindsight-api` (background, detached; downloads torch ~554MB).

Stage Summary:
- Hindsight = REQUIRED core tech; will self-host real hindsight-api on port 8888 wired to z-ai gateway LLM.
- Weather data = adapter chain (Open-Meteo primary, wttr.in fallback, OpenWeather optional w/ env key) + air quality adapter.
- Next: Prisma schema, services, APIs, SSE, frontend.

---
Task ID: 1
Agent: lead (main orchestrator)
Task: Build the complete Living City vertical slice

Work Log:
- Designed Prisma schema: CityEvent, EventRelationship, EventOutcome, AnalysisResult, MemoryOperation, FeedRun; pushed to SQLite.
- Built backend: env config, HindsightMemoryService (real @vectorize-io/hindsight-client: retain/recall/reflect + health + MemoryOperation audit), z-ai LLM reasoning (injection-defended, zod-validated CityAnalysisSchema), SSE event bus, normalization/dedup (sha256 fingerprints, 2km grid, severity bands), provider adapters (open-meteo, air-quality, wttr-in fallback, openweather optional), error-isolated feed orchestrator, instrumentation boot scheduler, analysis pipeline (recall→LLM→relationships→retain), demo engine (seed + before/after), rate-limited /api/reports with bounding-box validation.
- 14 REST endpoints + SSE stream route.
- Frontend: dark command-center UI — HeaderBar (live indicator/stats/origin badges/mode toggle), CityMap (Leaflet + dark OSM + pulsing markers), EventStream (SSE-driven), EventDetailPanel (memory recall cards + assessment + outcomes), MemoryPanel (ops log + stats), MemoryTimeline (past/current), MemoryGraph (stored edges), FeedHealthPanel, ReportDialog, DemoDialog. Sticky footer, mobile safe area.
- Fixed: Leaflet SSR crash (dynamic import), lint errors (5), test fingerprint bug, Node undici IPv6 ETIMEDOUT to air-quality-api (global IPv4 dispatcher via undici Agent).
- Verified LIVE: air-quality feed healthy, first real event ingested + analyzed by LLM (AQI 81 summary), SSE streaming, report validation + geo bounding, dedup working (1 duplicate rejected), fallback chain (wttr.in HEALTHY when open-meteo 429).
- bun test: 21 pass / 0 fail. lint: clean.

Stage Summary:
- Full vertical slice works on real data with Hindsight pending server start (pip install downloading ~2.5GB CUDA deps in background).
- Remaining: start Hindsight server on :8888, verify recall/retain loop end-to-end, run before/after demo, agent-browser full pass, final report.

---
Task ID: 2
Agent: lead (main orchestrator)
Task: Hindsight server live + full memory loop verification

Work Log:
- Installed hindsight-api 0.10.1 (real server) into /home/z/.venv; fixed fastmcp/starlette version conflicts from concurrent pip runs.
- Created scripts/start-hindsight.sh: HINDSIGHT_API_LLM_PROVIDER=openai, BASE_URL=https://internal-api.z.ai/v1, MODEL=glm-4.6, DEFAULT_HEADERS with X-Token (from /etc/.z-ai-config), data dir hindsight-data/.
- Server UP on :8888: LLM connection verified, embedded pg0 PostgreSQL started, embedding models loaded, /health = healthy.
- App connects: /api/health → hindsight.available=true.
- Seeded 3 historical monsoon experiences via POST /api/demo/seed → bankMemoryCount=16 memory units (real Hindsight extraction).
- Implemented demo bank isolation (living-city-demo-beforeafter): deleteBank+createBank per demo run; demo events analyze/retain against demo bank; live bank untouched by SIMULATED data.
- RAN BEFORE/AFTER DEMO end-to-end (real pipeline, 46s):
  * Event A: memories=0 → generic "may cause localized flooding" assessment
  * Outcome retained (water accumulation ~30cm, traffic 30-45min)
  * Event B: memories=12 recalled → "closely resembling a recent event that caused significant water accumulation and traffic delays" + recurring outcomes listed
- User report flow verified: report → USER_REPORTED event → recall 8 memories from city bank → LLM analysis → RETAIN SUCCESS → retainedFact visible in UI data.
- Fixed extractFact bug in /api/events/[id]/memory (fact lives in op.query, not detail JSON).
- Relationships mining live: 1 RECURRING_PATTERN + 3 RELATED edges from real events.

Stage Summary:
- FULL MEMORY LOOP WORKING: real data → event → Hindsight recall → LLM analysis → relationships → Hindsight retain → SSE → UI.
- Remaining: browser-verify demo dialog + report dialog, tests re-run, README accuracy pass, final report.

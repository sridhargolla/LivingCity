# LIVING CITY — Hyderabad

> **"A city that remembers."**
> An AI city-operations agent that continuously observes real-world events, remembers what happened before (via [Hindsight](https://github.com/vectorize-io/hindsight)), and uses that experience to understand new situations.

Built for the Hindsight-focused AI agent hackathon. Not a generic smart-city dashboard — a demonstration of **persistent operational memory** for a city.

---

## 1. Problem

City dashboards answer *"what is happening right now?"* They discard the operational lessons of every previous event. Each new incident is assessed from scratch, by whoever happens to be on shift.

Living City answers a different set of questions:

- What is happening right now?
- What happened in **similar situations before**?
- What did the city **learn** from those situations?
- How does that **memory change the assessment** of the current event?

## 2. Core concept — the memory loop

```
REAL-WORLD SIGNAL (Open-Meteo weather, air quality, wttr.in, operator reports)
      ↓
LIVE EVENT (normalize → deduplicate → store)
      ↓
HINDSIGHT RECALL   ← what does the city remember about this?
      ↓
LLM REASONING      ← schema-validated, injection-defended, hedged language
      ↓
RELATIONSHIPS      ← RECURRING_PATTERN / RELATED / POSSIBLE_ESCALATION …
      ↓
HINDSIGHT RETAIN   ← store the distilled experience (not raw data)
      ↓
SSE → LIVE UI      ← map, stream, memory panel update without refresh
```

The system **shows** its memory: every recall and retain is visible in the UI and auditable in the database.

## 3. Hindsight's role (core technology, not decoration)

| Concern | Implementation |
|---|---|
| Memory store | Self-hosted **Hindsight server** (`hindsight-api` 0.10.x, embedded PostgreSQL) |
| Client | Official `@vectorize-io/hindsight-client` TypeScript SDK |
| Bank | `living-city-hyderabad` (`HINDSIGHT_BANK_ID`) |
| RETAIN | `HindsightMemoryService.retain_event_experience()` — distilled facts + consequences, tagged (`type:`, `zone:`, `origin:`), with `occurred_at` timestamps |
| RECALL | `HindsightMemoryService.recall_related_experiences()` — natural-language recall at analysis time; results feed the LLM prompt and the UI |
| REFLECT | `HindsightMemoryService.reflect_on_pattern()` — disposition-aware pattern synthesis |
| Degraded mode | If Hindsight is unreachable the system **says so** ("Hindsight memory temporarily unavailable") and continues with deterministic analysis. It never fabricates memories. |

What gets retained is **experience, not data**: "On 2026-09-07, heavy rainfall affected the Western Corridor… water accumulation observed within 90 minutes… traffic slowdown 25–40 min… GHMC cleared drains in 3 hours." Raw payloads stay in PostgreSQL.

## 4. Architecture

```
Next.js 16 (App Router, TypeScript)
├── src/app/api/**            REST API (see below) + SSE stream
├── src/instrumentation.ts    boots the feed scheduler at server start
├── src/server/
│   ├── hindsight/            HindsightMemoryService (retain/recall/reflect + health)
│   ├── ingestion/
│   │   ├── providers/        open-meteo, open-meteo-air-quality, wttr-in, openweather adapters
│   │   ├── normalize.ts      canonical event builder, dedup fingerprints, sanitization
│   │   ├── ingest.ts         dedup → store → SSE → async analysis trigger
│   │   └── runFeeds.ts       error-isolated feed orchestration + health
│   ├── analysis/             the memory loop (recall → LLM → relationships → retain)
│   ├── llm/reasoning.ts      z-ai LLM call: system/data separation, zod-validated JSON
│   ├── realtime/eventBus.ts  in-process SSE pub/sub
│   └── demo/scenarios.ts     before/after memory demo (real pipeline, SIMULATED events)
├── src/components/city/**    command-center UI (map, stream, memory panels, timeline, graph)
├── prisma/schema.prisma      CityEvent, EventRelationship, EventOutcome, AnalysisResult,
│                             MemoryOperation, FeedRun
└── scripts/start-hindsight.sh  starts the Hindsight server wired to the LLM gateway
```

**Stack:** Next.js 16 · TypeScript · Tailwind 4 · shadcn/ui · Prisma + SQLite · Leaflet (OSM tiles) · Server-Sent Events · Hindsight (`hindsight-api` + `@vectorize-io/hindsight-client`) · z-ai LLM.

## 5. Real data sources (verified)

| Source | What | Key required? | Status |
|---|---|---|---|
| [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | Temperature, precipitation, wind, WMO codes + 6h rain forecast | No (free tier; optional paid `OPEN_METEO_API_KEY`) | ✅ live |
| [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | PM2.5, PM10, US AQI | No | ✅ live |
| [wttr.in](https://wttr.in/:help) | Fallback current conditions | No | ✅ fallback (activates when primary fails) |
| OpenWeather | Rain 1h | **Yes — `WEATHER_API_KEY`** | dormant until key provided |
| Operator portal | Incident reports from the UI | — | ✅ live |
| Demo scenarios | Controlled memory-learning scenarios | — | ✅ labeled `SIMULATED` |

Event-worthy thresholds (IMD-informed): rain ≥ 0.5 mm/h (bands up to ≥ 15.1 mm/h "extremely heavy"), temperature ≥ 40 °C, WMO thunderstorm codes 95–99, US AQI ≥ 51. If nothing exceeds thresholds, **no event is created — nothing is fabricated**.

Every event carries `dataOrigin` — `LIVE` / `SIMULATED` / `USER_REPORTED` — and the UI labels it on every row. "LIVE ONLY" mode excludes simulated and user data from the map and stream.

## 6. Memory lifecycle (what Hindsight actually sees)

1. **Seed** (optional, demo): 3 historical monsoon experiences retained with real timestamps.
2. **Event A** (rain, Western Corridor): recall → (empty or shallow memory) → generic assessment → outcome recorded → **retain**.
3. **Event B** (similar rain, same corridor): recall → Hindsight returns Event A's experience → assessment now cites "historically associated with water accumulation / traffic slowdown" with hedged language.
4. All differences between A and B come from **real recall**, not scripted text.

The UI surfaces: memory count per event, recalled memory cards, the retained fact ("Memory updated"), a live memory-operations log, and the learning indicator (experiences / retains / recalls / patterns — all real numbers from Hindsight + the DB).

**Honesty rules enforced in prompts and UI:** the system never claims certainty about future flooding; it uses "historically associated with", "resembles", "possible risk".

## 7. API

```
GET  /api/health                     service + Hindsight + DB health
GET  /api/city                       operational summary (counts by origin/status)
GET  /api/events                     list (filters: origin, status, type, sinceHours, limit)
GET  /api/events/{id}                event + analysis + outcomes
GET  /api/events/{id}/memory         Hindsight recall scoped to the event + ops log
GET  /api/events/{id}/relationships  relationship edges for the graph
GET  /api/city/timeline              past vs current columns
GET  /api/city/patterns              recurring patterns + counts
GET  /api/memory/stats               learning indicator (real Hindsight bank count)
GET  /api/memory/operations          recent RETAIN/RECALL/REFLECT ops
GET  /api/feeds, /api/feeds/health   real feed status (HEALTHY/FAILED/DORMANT + errors)
POST /api/reports                    operator report (validated, sanitized, rate-limited)
GET  /api/events/stream              SSE: event.created, memory.recalled, analysis.completed,
                                     memory.retained, event.relationship.created, feed.status_changed…
POST /api/demo/seed                  seed historical experiences (real retain calls)
POST /api/demo/before-after          run the before/after demonstration
```

## 8. Setup

```bash
# 1. install deps
bun install

# 2. environment
cp .env.example .env        # adjust if needed

# 3. database
bun run db:push

# 4. Hindsight memory server (self-hosted, real)
/home/z/.venv/bin/pip3 install hindsight-api     # one-time
./scripts/start-hindsight.sh &                   # serves :8888 (API) — uses the sandbox LLM gateway
#    (in a normal deployment, set HINDSIGHT_API_LLM_* to your OpenAI-compatible endpoint)

# 5. app
bun run dev      # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path |
| `HINDSIGHT_BASE_URL` | Hindsight server URL (default `http://localhost:8888`) |
| `HINDSIGHT_API_KEY` | Hindsight auth key (self-hosted: optional) |
| `HINDSIGHT_BANK_ID` | Memory bank (default `living-city-hyderabad`) |
| `HINDSIGHT_ENABLED` | `false` disables all memory calls (degraded mode) |
| `WEATHER_API_KEY` | Optional OpenWeather key |
| `OPEN_METEO_API_KEY` | Optional Open-Meteo paid key |
| `FEED_POLL_INTERVAL_MS` | Ingestion interval (default 300000 = 5 min) |
| `FEED_POLLING_DISABLED` | Stop the scheduler (useful in tests) |
| `CITY_LAT`, `CITY_LON` | City focus coordinates |

The Hindsight **server** itself is configured by `scripts/start-hindsight.sh`: `HINDSIGHT_API_LLM_PROVIDER=openai`, `HINDSIGHT_API_LLM_BASE_URL`, `HINDSIGHT_API_LLM_API_KEY`, `HINDSIGHT_API_LLM_MODEL`, `HINDSIGHT_API_LLM_DEFAULT_HEADERS` — all from environment/secret store, never committed.

## 9. Demo instructions (judge script)

1. Open the app → header shows **LIVE**, feed health shows real source states.
2. **MEMORY DEMO** → *Seed historical memory* (optional) → 3 real `retain` calls.
3. *Run before/after demo* → watch the pipeline: Event A (generic, `memories used: 0`) → outcome recorded → retained → Event B → recall fires → `memories used: N`, summary cites historical outcomes. Compare the two cards.
4. Click any event (map or stream) → detail panel shows **🧠 City Memory** (actual recall results), the agent assessment (hedged language), and **Memory updated** (the retained fact).
5. Submit an **+ REPORT** → it appears labeled `USER-REPORTED`, runs the same memory pipeline, and enriches future recalls.
6. Watch **Data Sources** — statuses reflect *actual* adapter runs; fail one (e.g. no network) and it honestly shows `FAILED` while the rest continue.

## 10. Security

- **Prompt-injection defense**: all external text (weather descriptions, user reports) is rendered inert (`< >` escaped, control chars stripped, length-capped) and delivered inside `<event_content>` as *data only*; the system prompt forbids following instructions from content or memory text; output is zod-validated before use.
- Input validation (zod) on `/api/reports`; coordinates checked against the Hyderabad bounding box; partial coordinates rejected (never guessed).
- SQL-injection safe via Prisma parameterized queries; XSS-safe React rendering (no `dangerouslySetInnerHTML`).
- Rate limiting on reports (10 / 10 min / IP); bounded LLM/memory concurrency (analysis lock per event, staggered ingestion).
- Deduplication by content fingerprint (source | type | severity band | day | 2 km grid) prevents duplicate events and duplicate LLM/Hindsight spend.
- No secret reaches the client: LLM and Hindsight credentials are server-side only; frontend talks to Next.js API routes exclusively.

## 11. Known limitations (honest list)

- Open-Meteo free tier is IP-limited per day; when exhausted the weather feed shows `FAILED` and wttr.in takes over. No data is faked in the interim.
- Traffic/transit feeds (GTFS/roads) are **not** integrated — no legitimate free real-time incident feed for Hyderabad was verified during the build; the adapter interface accepts them without code changes. The prompt-forbidden alternative (fabricating traffic data) was rejected.
- Air-quality events are city-wide (single sensor grid point), not zone-resolved.
- The relationship graph lays out stored edges in a deterministic ring; it is not a force simulation.
- SSE is single-process in-memory — correct for this deployment, would need Redis pub/sub to scale horizontally.
- Hindsight `bankMemoryCount` uses `listMemories().total`; on older server versions it may be `null` (UI falls back to retained-count).

## 12. Tests

```bash
bun test            # unit tests (normalization, dedup, sanitization, severity, formatting)
```

Integration verification (Hindsight + DB + LLM + SSE) requires the running stack — see demo script above; the before/after demo is the end-to-end test of the memory loop.

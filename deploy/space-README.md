---
title: Living City — A City That Remembers
emoji: 🌆
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: true
license: mit
short_description: Real-time city intelligence with Hindsight long-term memory
---

# LIVING CITY — a city that remembers.

Real-time city operations agent built for the Hindsight-themed AI agent hackathon.

- **7 modular pages** — Dashboard · AI City Copilot · Memories · Live City · Live Events · Analytics · Settings
- **Real data** — Open-Meteo weather + air quality (wttr.in fallback). Metrics without a legitimate source display **Data Unavailable** — never fabricated.
- **Hindsight long-term memory** — self-hosted hindsight-api with per-city memory banks; the Copilot answers contextual questions ("Have we seen this before?") only from memories actually recalled.
- **Evidence-first** — every claim carries source, timestamp, location and event reference.

See [README-project.md](./README-project.md) for the full architecture.

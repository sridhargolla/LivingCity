# 🌆 Living City — Hyderabad

> ### **A city that remembers.**

**Living City** is an AI-powered city-operations agent for Hyderabad that combines **real-time urban signals, persistent memory, and AI reasoning** to understand what is happening now in the context of what happened before.

Instead of simply displaying city data, Living City builds a continuously evolving memory of meaningful city experiences.

```text
REAL WORLD
    ↓
LIVE SIGNALS
    ↓
CITY EVENT
    ↓
HINDSIGHT RECALL
    ↓
AI REASONING
    ↓
RELATIONSHIPS
    ↓
HINDSIGHT RETAIN
    ↓
LIVING CITY UI
```

---

## 🚀 Why Living City?

Most city dashboards answer:

> **"What is happening right now?"**

Living City asks a deeper question:

> **"Have we seen something like this before, and what did we learn from it?"**

A rainfall event today is not just another weather reading.

The system can connect today's conditions with relevant previous experiences, retrieve what happened, identify relationships, and preserve the new experience for future reasoning.

This creates a continuous memory loop:

**Observe → Remember → Reason → Learn → Remember**

---

# 🧠 Hindsight Is the Core

Hindsight is not a decorative feature or a secondary database.

It is the **long-term memory layer of Living City**.

Living City uses Hindsight to:

* Retain meaningful city experiences
* Recall relevant historical experiences
* Connect current events with previous events
* Preserve outcomes and observations
* Support contextual AI reasoning
* Build an evolving city memory

The core memory loop is:

```text
                 ┌───────────────┐
                 │  LIVE EVENT   │
                 └───────┬───────┘
                         ↓
                ┌─────────────────┐
                │ HINDSIGHT RECALL│
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │  AI REASONING   │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ RELATIONSHIPS   │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ HINDSIGHT RETAIN│
                └────────┬────────┘
                         ↓
                  FUTURE EVENTS
```

This allows the city intelligence layer to become more context-aware over time.

---

# 🤖 AI City Agent

Living City includes an AI City Agent that can reason over:

* Current city conditions
* Live events
* Historical experiences
* Hindsight memories
* Evidence and provenance
* Relationships between events

Users can ask questions such as:

```text
What's happening right now?

What happened here before?

Have we seen something similar?

What did the city learn?

Why is this happening?

Show me the evidence.

Where did this information come from?

Show this event on the map.
```

The agent is designed to provide **clear, concise, evidence-grounded responses** rather than unnecessary explanations.

---

# 💬 Ask the City

**Ask the City** is the conversational interface for Living City.

Users can discuss the current state of Hyderabad while maintaining conversation context.

The agent can combine:

```text
Current Data
     +
Current Events
     +
Conversation Context
     +
Hindsight Memory
     +
Evidence
     ↓
AI City Agent
```

When a question requires historical context, the agent can recall relevant Hindsight memories.

When evidence is requested, the system can surface the underlying source/event information.

---

# 🔎 Evidence & Provenance

Living City is designed around traceable information.

Important observations should be connected to their underlying evidence whenever available.

Users can inspect:

* Source
* Timestamp
* Location
* Event
* Data origin
* Related memory

The system distinguishes between different types of information rather than presenting everything as equally authoritative.

```text
LIVE
USER-REPORTED
HISTORICAL
SIMULATED
```

Simulated information must never be presented as live real-world information.

---

# 🌍 Real-Time City Intelligence

Living City connects to real-world data providers where legitimate live access is available.

Current integrations include supported sources for areas such as:

* 🌦️ Weather
* 🌫️ Air Quality
* 🚨 City Events
* 🗺️ Geographic Information

Traffic and transit are provider-dependent and are only presented as live when a verified live source is actually available.

If a legitimate live source is unavailable, the application reports the limitation instead of inventing values.

---

# 🗺️ Live City

The Live City interface provides a geographic view of the current city state.

It connects city events and available real-time information to locations on the map.

Users can:

* Explore current events
* Inspect locations
* View event details
* Follow evidence
* Jump from AI conversations to map locations

The map uses the same underlying city intelligence layer as the rest of the application.

---

# 🚨 Live Events

Living City provides a real-time event stream for supported city signals.

Events can contain:

```text
Event
Location
Observed At
Severity
Status
Source
Data Origin
```

Events are normalized before being passed into the intelligence layer.

Duplicate events are handled so that repeated provider updates do not create meaningless duplicate memories.

---

# 🧠 Memories

The Memories page provides a human-readable view of the city's accumulated experiences.

Users can explore:

* Previous incidents
* Relevant observations
* Outcomes
* Recurring patterns
* Related events
* Memory timelines
* Memory relationships

The goal is not to create a giant archive of raw messages.

The goal is to preserve **meaningful city experiences** that can help future reasoning.

---

# 🕸️ Memory Relationships

Living City can represent relationships between meaningful events and experiences.

For example:

```text
Heavy Rain
     │
     ├── Waterlogging
     │
     └── Traffic Disruption
             │
             └── Transit Delay
```

These relationships can help the AI agent understand a current event in a broader context.

---

# 📊 City Analytics

The Analytics interface provides a way to inspect patterns across collected city information.

Depending on available data, this can include:

* Event trends
* Historical comparisons
* Recurring patterns
* Anomalies
* Memory relationships
* City activity

Analytics are generated from available data rather than fabricated metrics.

---

# 💾 Persistent Conversations

AI City Agent conversations are persisted separately from long-term city memory.

### Conversation Storage

Stores:

* Conversations
* Messages
* Context
* Referenced events
* Relevant sources

### Hindsight Memory

Stores:

* Meaningful city experiences
* Observations
* Outcomes
* Relevant historical context

This separation prevents ordinary chat messages from becoming permanent city knowledge.

---

# 🔄 The Living City Loop

The defining architecture of the project is:

```text
        🌍 REAL WORLD
              ↓
        LIVE SIGNALS
              ↓
        CITY EVENTS
              ↓
       HINDSIGHT RECALL
              ↓
        AI REASONING
              ↓
       EVENT RELATIONSHIPS
              ↓
       HINDSIGHT RETAIN
              ↓
        CITY MEMORY
              ↓
       FUTURE EVENTS
              ↺
```

Every meaningful new experience can become part of the city's long-term context.

---

# 🏗️ Architecture

```text
                    🌍 REAL WORLD
                         │
                         ▼
                 LIVE DATA SOURCES
                         │
                         ▼
                  DATA INGESTION
                         │
                         ▼
                  CITY DATA LAYER
                         │
             ┌───────────┼───────────┐
             │           │           │
             ▼           ▼           ▼
        DASHBOARD     LIVE CITY   LIVE EVENTS
                         │
                         ▼
                     HINDSIGHT
                         │
                         ▼
                   CITY MEMORY
                         │
                         ▼
                  AI CITY AGENT
                         │
                 ┌───────┴───────┐
                 ▼               ▼
            USER CHAT         EVIDENCE
                 │
                 ▼
              OUTCOME
                 │
                 ▼
             HINDSIGHT
```

---

# 📱 Application

```text
Living City
│
├── 🏠 Dashboard
│   ├── Live City Status
│   ├── Current Events
│   ├── Alerts
│   └── Memory Insights
│
├── 🤖 AI City Agent
│   ├── Ask the City
│   ├── Conversations
│   ├── Evidence
│   └── Map Actions
│
├── 🧠 Memories
│   ├── Memory Search
│   ├── Experiences
│   ├── Relationships
│   └── Timeline
│
├── 🗺️ Live City
│   └── Interactive Map
│
├── 🚨 Live Events
│   └── Event Stream
│
├── 📊 Analytics
│   ├── Trends
│   ├── Patterns
│   └── Anomalies
│
└── ⚙️ Settings
```

---

# ⚡ Real-Time Architecture

The application is designed around continuously updating city information.

Depending on the underlying provider, real-time updates can use:

* Server-Sent Events
* WebSockets
* Polling
* Background ingestion

The frontend should update relevant views without requiring unnecessary page refreshes.

---

# 🔐 Data Integrity

Living City follows a strict principle:

> **Never pretend unavailable information is real.**

The application must distinguish between:

### 🟢 LIVE

Verified information received from an active external source.

### 🟡 DEGRADED

A provider is partially available or experiencing issues.

### ⚪ UNAVAILABLE

A legitimate source is currently unavailable.

### 👤 USER-REPORTED

Information explicitly submitted by a human.

### 📚 HISTORICAL

Previously collected information.

### 🧪 SIMULATED

Development/testing information that must never be presented as live.

---

# 🔒 Security

Living City follows security practices including:

* Server-side API credentials
* Environment-based secrets
* Input validation
* External URL validation
* Protected Hindsight credentials
* No secrets committed to source control
* Separation of trusted and untrusted external data

---

# 🛠️ Technology

The project is built around:

* **AI City Agent**
* **Hindsight**
* **Real-time data providers**
* **Persistent application storage**
* **Interactive maps**
* **Real-time event processing**
* **Conversational AI**
* **Evidence/provenance**

The implementation-specific technologies and provider configuration are documented in the project source and deployment configuration.

---

# ⚙️ Environment Variables

Example configuration:

```env
HINDSIGHT_BASE_URL=
HINDSIGHT_API_KEY=
HINDSIGHT_BANK_ID=

AI_API_KEY=

WEATHER_API_KEY=
AIR_QUALITY_API_KEY=
```

Only configure providers actually used by the deployment.

**Never commit real credentials.**

---

# 🚀 Getting Started

## Clone

```bash
git clone <YOUR_REPOSITORY_URL>
cd living-city
```

## Install

```bash
npm install
```

## Configure

Create the required environment files and add your provider credentials.

## Run

```bash
npm run dev
```

Use the project's backend startup command as documented in the source tree.

---

# 🧪 Testing

Before deployment, verify:

* Live data providers
* Event ingestion
* Hindsight connection
* Hindsight RETAIN
* Hindsight RECALL
* AI City Agent
* Conversation persistence
* Evidence generation
* Map interactions
* Real-time updates
* Data-origin labels
* Provider failure handling

---

# 🎯 Hackathon Focus

Living City is built around a focused question:

> **What if a city could remember?**

Rather than creating another dashboard, the project explores how persistent memory can give an AI city-operations agent context across time.

The important distinction is:

```text
Traditional Dashboard
        ↓
"What is happening?"

Living City
        ↓
"What is happening?"
        +
"Have we seen this before?"
        +
"What happened then?"
        +
"What did we learn?"
        +
"What evidence supports this?"
```

---

# 🌆 Vision

A city produces enormous amounts of information every day.

But information alone is not memory.

Living City aims to create an intelligence layer that can:

**Observe → Remember → Understand → Discuss → Learn**

The long-term vision is a city intelligence system where today's meaningful experiences become context for tomorrow's decisions.

---

# 🏆 Built For

**HackWithHyderabad 3.0**

### Theme

**AI Agents for Real-World Impact**

---

# 📌 Project Status

🚧 **Active Development**

Current focus:

* [x] Real-time city intelligence architecture
* [x] Hindsight memory architecture
* [x] AI City Agent
* [x] Persistent conversations
* [x] Evidence/provenance architecture
* [x] Live city interface
* [x] City memory interface
* [x] Event intelligence
* [x] Additional verified live city providers
* [x] Advanced city relationships
* [x] Expanded real-world integrations

---

# 👥 Team

Built with the goal of creating a new kind of human interface for city intelligence.

---

# 📄 License

Add the project's selected license here.

---

<div align="center">

## 🌆 Living City

### **A city that remembers.**

**Observe. Remember. Understand. Discuss.**

</div>

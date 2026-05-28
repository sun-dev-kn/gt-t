# DotGit Multi-Account Scraper — Design Spec

**Date:** 2026-05-27
**Status:** Approved

---

## Overview

Add a multi-account web scraping pipeline to DotGit. The feature rotates through a pool of 20–50 pre-created Outlook accounts (each isolated in a Firefox Multi-Account Container), automates scraping of WebSiteLaunches.com every 12 hours using ui.vision macros driven by a visual node-based workflow designer, and stores all scraped launch data in the vuln-scanner's existing Postgres database.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  DotGit Extension                   │
│                                                     │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │  Background │    │     Options Page          │   │
│  │  Worker     │    │  - Import CSV/JSON creds  │   │
│  │  (dotgit.js)│    │  - Account pool status    │   │
│  │             │    │  - Scrape schedule toggle │   │
│  │  - 12hr     │    └──────────────────────────┘   │
│  │    alarm    │                                     │
│  │  - Account  │    ┌──────────────────────────┐   │
│  │    rotation │    │     Popup                 │   │
│  │  - ui.vision│    │  - Latest launches list   │   │
│  │    trigger  │    │  - Last scrape timestamp  │   │
│  │  - Backend  │    │  - Manual trigger button  │   │
│  │    relay    │    └──────────────────────────┘   │
│  └─────────────┘                                     │
└───────────────────┬─────────────────────────────────┘
                    │ localStorage trigger (XrunnerInput key)
                    ▼
┌─────────────────────────────────────────────────────┐
│              ui.vision RPA Extension                │
│                                                     │
│  Triggered via localStorage: DotGit injects a       │
│  content script into the scraper tab that sets      │
│  localStorage.XrunnerInput = JSON.stringify({        │
│    cmd: "run", macro: "<macro-name>"                │
│  }); ui.vision polls this key and starts the macro. │
│                                                     │
│  Macro: websitelaunches-scrape (generated from      │
│         workflow designer graph JSON)               │
└───────────────────┬─────────────────────────────────┘
                    │ Firefox contextualIdentities API
                    ▼
┌─────────────────────────────────────────────────────┐
│         Firefox Multi-Account Containers            │
│   One container per Outlook account (named by email)│
└───────────────────┬─────────────────────────────────┘
                    │ HTTP POST
                    ▼
┌─────────────────────────────────────────────────────┐
│        vuln-scanner Backend (Fastify + Prisma)      │
│   New endpoint: POST /api/launches                  │
│   New Prisma models: WebsiteLaunch, Workflow        │
└─────────────────────────────────────────────────────┘
```

### Scrape Cycle Flow

1. `browser.alarms` fires every 12 hours (also triggerable manually from popup)
2. Background worker picks the next non-suspended account (round-robin)
3. Worker ensures a Firefox container exists for that account (`contextualIdentities` API)
4. Worker opens one reusable scraper tab inside that container
5. Worker triggers ui.vision to run the macro for the target domain
6. ui.vision macro executes the workflow (login → navigate → scrape) and returns results
7. Worker deduplicates results against local cache, then POSTs to `/api/launches`
8. Tab is discarded (`browser.tabs.discard`) immediately after macro completes
9. Popup and options page reflect updated results and last-scrape timestamp

---

## 2. Memory Management

- **Discard tabs immediately** — `browser.tabs.discard()` after each macro run; tab stays in bar but is unloaded from RAM
- **Single reusable tab per cycle** — one tab opened per account per cycle, reused for the full workflow, then discarded
- **Service worker dormancy** — MV3 background worker sleeps between alarms; zero persistent memory cost
- **Container session persistence** — containers keep accounts logged in between 12-hour cycles, avoiding re-auth RAM overhead
- **Local storage cap** — `browser.storage.local` launch cache capped at 500 entries (configurable); oldest pruned before backend POST

---

## 3. Workflow Designer (Node-Based Canvas)

### Technology

A dedicated extension page (`workflow/workflow.html`) containing a React + React Flow application, bundled at build time. Completely isolated from DotGit's existing non-bundled scripts.

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ☰  Workflow: [name]                  [Run] [Save] [Export ▾]     │
├────────────┬─────────────────────────────────────────────────────┤
│  Node      │                                                      │
│  Library   │          Infinite Canvas (React Flow)               │
│            │                                                      │
│ ▸ Triggers │   ┌──────────┐      ┌──────────────┐               │
│   Schedule │   │ Schedule ├──────► Navigate URL  ├──► ...       │
│   Manual   │   │ Trigger  │      └──────────────┘               │
│            │   └──────────┘                                      │
│ ▸ Browser  │                                                      │
│   Navigate │   ┌─────────────────────────────────┐              │
│   Click    │   │  Loop                           │              │
│   Fill     │   │  ┌──────────┐  ┌─────────────┐ ├─done──►...  │
│   Scroll   │   │  │ Extract  ├──► Condition    │ │             │
│   Hover    │   │  │ Listings │  │ has_next?   ├─┼─loop──►...  │
│   Wait     │   │  └──────────┘  └─────────────┘ │             │
│            │   └─────────────────────────────────┘             │
│ ▸ Data     │                                                     │
│   Extract  ├─────────────────────────────────────────────────────┤
│   Filter   │  🔍 [−] [+]  [↺]  [⛶]              ▣ minimap     │
│   Transform│                                                     │
│            │                                                     │
│ ▸ Control  │                                                     │
│   Condition│                                                     │
│   Loop     │                                                     │
│   Merge    │                                                     │
│            │                                                     │
│ ▸ Account  │                                                     │
│   Inject   │                                                     │
│   Switch   │                                                     │
│            │                                                     │
│ ▸ Output   │                                                     │
│   Backend  │                                                     │
│   Local    │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

### Node Types & Ports

| Category | Node | Output Ports |
|----------|------|-------------|
| Trigger | Schedule, Manual | → (single) |
| Browser | Navigate, Click, Fill, Scroll, Hover | success / error |
| Wait | Wait for selector, Delay, Network idle | → (single) |
| Data | Extract (CSS selector + field name mapping), Extract table | → (with data payload) |
| Control | Condition | true / false |
| Control | Loop | loop / done |
| Control | Merge | → (combines branches) |
| Account | Inject credentials (`{{account.email}}`, `{{account.password}}`) | → |
| Account | Switch account (advances rotation pointer) | → |
| Output | Send to backend (POST /api/launches) | success / error |
| Output | Save locally | → |

Loop nodes render a **visual container box** grouping the nodes inside the iteration, matching the n8n visual style.

### Canvas Interactions

- Drag node from library → drops onto canvas
- Click node → opens Inspector panel (right side) for config
- Draw connection by dragging from output port to input port; type mismatch shown in red
- Right-click canvas → Add node menu
- Right-click node → Delete / Duplicate / Add note
- Ctrl+Z / Ctrl+Y undo/redo
- Minimap in bottom-right corner

### Workflow Storage & Export

- Saved as JSON in `browser.storage.local`, keyed by workflow name
- Multiple workflows supported (one per target domain/website)
- **Export → ui.vision macro JSON** — converts graph to ui.vision command sequence
- **Export → Raw JSON** — workflow backup
- **Import** — from ui.vision macro JSON or raw workflow JSON
- The 12-hour scheduler resolves the workflow for the active target domain and feeds it to ui.vision

---

## 4. Account Management & Container Lifecycle

### Credential Import

- Options page accepts CSV or JSON file upload
- CSV format: `email, password, label`
- Credentials encrypted at rest in `browser.storage.local` using Web Crypto API (AES-GCM, key derived from a user-set master password)
- Master password is set once on first use via a prompt in the options page; it is never stored — only its derived key (PBKDF2) is held in session memory and cleared when the browser closes
- Credentials never leave the browser except when injected into ui.vision macros at runtime

### Container Lifecycle

```
Import account
    → contextualIdentities.create({ name: "DotGit: alice@outlook.com", color: auto })
    → cookieStoreId saved alongside credentials in storage

Every 12hr cycle
    → open tab with that account's cookieStoreId
    → run workflow macro
    → browser.tabs.discard()

If container missing (deleted externally)
    → recreate silently before next cycle
```

### Account Rotation

- Round-robin pointer stored in `browser.storage.local`
- Each cycle advances the pointer by one
- **Suspended accounts** are skipped:
  - Rate limit detected → suspended 48 hours
  - Macro error → suspended 24 hours
  - Login failure → marked `error` (requires manual reset; user notified)
- Suspension clears automatically when `suspendedUntil` timestamp passes

### Options Page — Account Pool UI

```
┌─────────────────────────────────────────────────┐
│ Account Pool                    [Import CSV/JSON]│
├──────────────────────┬──────────┬───────────────┤
│ Email                │ Status   │ Last Used      │
├──────────────────────┼──────────┼───────────────┤
│ alice@outlook.com    │ ✅ active │ 2h ago        │
│ bob@outlook.com      │ ⏸ susp.  │ 14h ago       │
│ carol@outlook.com    │ ❌ error  │ 5h ago        │
├──────────────────────┴──────────┴───────────────┤
│ [Delete selected]              [Clear all]       │
└─────────────────────────────────────────────────┘
```

---

## 5. Data Model

### Prisma Schema Additions (vuln-scanner)

```prisma
model WebsiteLaunch {
  id            String    @id @default(cuid())
  url           String    @unique
  name          String?
  thumbnailUrl  String?
  description   String?
  launchDate    DateTime?
  category      String?
  tags          String[]
  pricingModel  String?   // "free" | "paid" | "freemium" | "open-source"
  techStack     String[]
  founderInfo   String?
  socialLinks   Json?     // { twitter, linkedin, github, ... }
  traffic       String?
  revenue       String?
  upvotes       Int?
  websiteStatus String?   // "live" | "coming-soon" | "beta"
  rawData       Json?     // catch-all for any extra scraped fields
  scrapedAt     DateTime  @default(now())
  scrapedBy     String    // outlook email used for this scrape
  workflowId    String
  workflow      Workflow  @relation(fields: [workflowId], references: [id])

  @@index([launchDate])
  @@index([scrapedAt])
  @@index([category])
}

model Workflow {
  id        String          @id @default(cuid())
  name      String
  domain    String          @unique
  graph     Json            // React Flow node/edge JSON
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  launches  WebsiteLaunch[]
}
```

### API Endpoints (vuln-scanner Fastify backend)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/launches` | Upsert scraped launch records (body: `{ workflowId, scrapedBy, items[] }`) |
| GET | `/api/launches` | Paginated launch list (query: `page, limit, category, from, to`) |
| POST | `/api/workflows` | Save a workflow definition |
| GET | `/api/workflows/:domain` | Retrieve workflow for a domain |

Duplicate URLs are silently skipped via Prisma `createMany` + `skipDuplicates`. Response includes `{ inserted, skipped }`.

### Data Flow

```
ui.vision macro completes
    → DotGit worker receives items[]
    → deduplicate against local cache (skip URLs seen today)
    → POST /api/launches
    → Prisma upsert (skipDuplicates)
    → Response { inserted, skipped }
    → update local cache + last-scrape timestamp
    → popup reflects new count
```

---

## 6. Popup — Launches Tab

New "Launches" tab added to the DotGit popup alongside the existing findings list:

```
┌──────────────────────────────┐
│ DotGit   [Findings][Launches]│
├──────────────────────────────┤
│ Last scrape: 2h ago          │
│ Next: in 10h  [Run now]      │
├──────────────────────────────┤
│ ● example.com                │
│   SaaS · Launched 2026-05-26 │
│ ● another.io                 │
│   Marketplace · 2026-05-25   │
├──────────────────────────────┤
│ [View all in backend →]      │
└──────────────────────────────┘
```

---

## 7. Error Handling & Resilience

| Failure | Detection | Response |
|---------|-----------|----------|
| ui.vision not installed | Check for extension on startup | Warning banner in popup + options; scheduling disabled |
| ui.vision macro error | Error response from macro | Suspend account 24hr; advance rotation; log error |
| Rate limit detected | Macro detects "limit reached" element | Suspend account 48hr; try next account immediately |
| Outlook login fails | Macro detects login error state | Mark account `error`; fire `browser.notifications` alert |
| Container missing | `contextualIdentities.get` throws | Recreate container silently before next cycle |
| Backend unreachable | Fetch throws / non-2xx | Cache locally (up to 1000 entries); retry next cycle |
| Partial scrape (timeout) | Macro timeout event | Save partial results; flag records with `partial: true` in rawData |
| Duplicate URL | Prisma upsert | Silently skip; count as `skipped` |

### Retry & Backoff

- Backend POST: exponential backoff, 3 attempts (1s → 5s → 15s), then cache locally
- Cached offline items flushed on next successful cycle
- Outlook login failures require manual intervention — no automated retry

### Observability

- DotGit debug mode extended to log all scrape cycle events to browser console
- Options page **Scrape Log** table: timestamp, account used, items inserted, skipped, errors
- `browser.notifications` on: scrape complete (with count), account entering error state, backend unreachable

---

## 8. New Files & Build Changes

### DotGit Extension

```
workflow/
  workflow.html         — workflow designer page
  workflow.css          — designer styles
  src/
    App.tsx             — React root
    nodes/              — custom React Flow node components
    edges/              — custom edge types
    export/             — ui.vision macro exporter
    store.ts            — Zustand state (nodes, edges, workflow metadata)
  package.json          — React, React Flow, Zustand, TypeScript
  vite.config.ts        — bundles to workflow/dist/

options/
  options.html          — updated: adds account pool section + scrape log
  options.js            — updated: credential import, pool management

popup/
  popup.html            — updated: adds Launches tab
  popup.js              — updated: launches display, manual trigger

dotgit.js               — updated: 12hr alarm, rotation logic, ui.vision trigger, backend relay
```

### vuln-scanner Backend

```
prisma/schema.prisma              — adds WebsiteLaunch, Workflow models
src/app/api/launches/route.ts     — POST + GET handlers
src/app/api/workflows/[domain]/route.ts — GET handler
src/app/api/workflows/route.ts    — POST handler
```

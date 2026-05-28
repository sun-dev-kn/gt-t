# DotGit Multi-Account Scraper Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 12-hour scheduled scraping pipeline to DotGit that rotates 20–50 pre-created Outlook accounts (each isolated in a Firefox Multi-Account Container), triggers ui.vision macros to scrape WebSiteLaunches.com, and stores all launch data in the vuln-scanner Postgres database.

**Architecture:** The DotGit background service worker fires a `browser.alarms` event every 12 hours, picks the next active account via round-robin rotation, opens a tab in that account's Firefox container, injects a content script that triggers a ui.vision macro via `localStorage.XrunnerInput`, receives scraped results, and POSTs them to the vuln-scanner Fastify/Next.js backend. Credentials are encrypted at rest with AES-GCM (Web Crypto API). This plan covers backend + extension core only. The visual workflow designer is a separate Plan B.

**Tech Stack:** Firefox WebExtension MV3, `browser.contextualIdentities` API, `browser.scripting` (world: MAIN), Web Crypto API (AES-GCM + PBKDF2), ui.vision RPA extension (localStorage trigger protocol), Next.js App Router (route handlers), Prisma 7, Postgres, Zod 4

**Spec:** `docs/superpowers/specs/2026-05-27-dotgit-multiaccount-scraper-design.md`

---

## File Map

### vuln-scanner backend (`d:\workspace\vuln-scanner`)

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `WebsiteLaunch` + `Workflow` models |
| Create | `src/app/api/launches/route.ts` | POST (upsert) + GET (paginated list) |
| Create | `src/app/api/workflows/route.ts` | POST (save workflow) |
| Create | `src/app/api/workflows/[domain]/route.ts` | GET (workflow by domain) |

### DotGit extension (`d:\workspace\DotGit`)

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `manifest.json` | Add `contextualIdentities` + `alarms` permissions |
| Create | `scraper/crypto.js` | AES-GCM encrypt/decrypt, PBKDF2 key derivation |
| Create | `scraper/accounts.js` | Account pool CRUD, CSV/JSON import |
| Create | `scraper/containers.js` | `contextualIdentities` create/verify/recreate |
| Create | `scraper/rotation.js` | Round-robin pointer, suspension logic |
| Create | `scraper/uivision.js` | localStorage XrunnerInput trigger + result polling |
| Create | `scraper/relay.js` | POST to backend with retry/backoff, offline cache |
| Create | `scraper/log.js` | Append-only scrape event log in storage |
| Create | `scraper/orchestrate.js` | Scrape cycle: ties all scraper modules together |
| Modify | `dotgit.js` | Register alarm, wire alarm listener to orchestrate |
| Modify | `options/options.html` | Add: master password, backend URL, account pool, scrape log |
| Modify | `options/options.js` | Handle: file import, pool table render, log render |
| Modify | `popup/popup.html` | Add Launches tab |
| Modify | `popup/popup.js` | Render launches tab, manual trigger button |

---

## Task 1: Backend — Prisma Schema

**Files:**
- Modify: `d:\workspace\vuln-scanner\prisma\schema.prisma`

- [ ] **Step 1: Add models to schema.prisma**

Open `d:\workspace\vuln-scanner\prisma\schema.prisma` and append these two models at the end of the file (after all existing models):

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
  pricingModel  String?
  techStack     String[]
  founderInfo   String?
  socialLinks   Json?
  traffic       String?
  revenue       String?
  upvotes       Int?
  websiteStatus String?
  rawData       Json?
  scrapedAt     DateTime  @default(now())
  scrapedBy     String
  workflowId    String
  workflow      Workflow  @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@index([launchDate])
  @@index([scrapedAt])
  @@index([category])
}

model Workflow {
  id        String          @id @default(cuid())
  name      String
  domain    String          @unique
  graph     Json
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  launches  WebsiteLaunch[]
}
```

- [ ] **Step 2: Run migration**

```powershell
cd d:\workspace\vuln-scanner
npx prisma migrate dev --name add_website_launches_and_workflows
```

Expected output ends with: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify Prisma client regenerated**

```powershell
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add WebsiteLaunch and Workflow prisma models"
```

---

## Task 2: Backend — POST /api/launches

**Files:**
- Create: `d:\workspace\vuln-scanner\src\app\api\launches\route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/launches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

const launchItemSchema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
  thumbnailUrl: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  launchDate: z.string().datetime().optional().nullable(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  pricingModel: z.string().optional().nullable(),
  techStack: z.array(z.string()).optional().default([]),
  founderInfo: z.string().optional().nullable(),
  socialLinks: z.record(z.string()).optional().nullable(),
  traffic: z.string().optional().nullable(),
  revenue: z.string().optional().nullable(),
  upvotes: z.number().int().optional().nullable(),
  websiteStatus: z.string().optional().nullable(),
  rawData: z.record(z.unknown()).optional().nullable(),
});

const postSchema = z.object({
  workflowId: z.string().min(1),
  scrapedBy: z.string().email(),
  items: z.array(launchItemSchema).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = postSchema.parse(body);

    const result = await prisma.websiteLaunch.createMany({
      data: parsed.items.map((item) => ({
        ...item,
        workflowId: parsed.workflowId,
        scrapedBy: parsed.scrapedBy,
        launchDate: item.launchDate ? new Date(item.launchDate) : null,
        tags: item.tags ?? [],
        techStack: item.techStack ?? [],
      })),
      skipDuplicates: true,
    });

    return NextResponse.json(
      { inserted: result.count, skipped: parsed.items.length - result.count },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    console.error("[launches POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manually test POST endpoint**

Start the vuln-scanner dev server:
```powershell
cd d:\workspace\vuln-scanner
npm run dev
```

In a new terminal, send a test request:
```powershell
$body = @{
  workflowId = "test-workflow-id"
  scrapedBy = "test@outlook.com"
  items = @(
    @{
      url = "https://example-launch.com"
      name = "Example Launch"
      description = "A test launch"
      category = "SaaS"
      tags = @("AI", "Productivity")
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:3000/api/launches" -Method POST -Body $body -ContentType "application/json"
```

Expected: `{ inserted: 1, skipped: 0 }` (note: will fail on `workflowId` FK until a Workflow row exists — that's expected; use `npx prisma studio` to seed a Workflow first or temporarily make the relation optional for testing)

- [ ] **Step 3: Commit**

```powershell
git add src/app/api/launches/route.ts
git commit -m "feat: add POST /api/launches endpoint"
```

---

## Task 3: Backend — GET /api/launches

**Files:**
- Modify: `d:\workspace\vuln-scanner\src\app\api\launches\route.ts`

- [ ] **Step 1: Add GET handler to the same file**

Append to `src/app/api/launches/route.ts`:

```typescript
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const category = searchParams.get("category") ?? undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where = {
      ...(category ? { category } : {}),
      ...((from || to) ? {
        launchDate: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.websiteLaunch.findMany({
        where,
        orderBy: { scrapedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { workflow: { select: { name: true, domain: true } } },
      }),
      prisma.websiteLaunch.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (e) {
    console.error("[launches GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manually test GET endpoint**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/launches?limit=10" -Method GET
```

Expected: `{ items: [...], total: N, page: 1, limit: 10 }`

- [ ] **Step 3: Commit**

```powershell
git add src/app/api/launches/route.ts
git commit -m "feat: add GET /api/launches endpoint with pagination and filters"
```

---

## Task 4: Backend — Workflows API

**Files:**
- Create: `d:\workspace\vuln-scanner\src\app\api\workflows\route.ts`
- Create: `d:\workspace\vuln-scanner\src\app\api\workflows\[domain]\route.ts`

- [ ] **Step 1: Create POST /api/workflows**

```typescript
// src/app/api/workflows/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

const workflowSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  graph: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = workflowSchema.parse(body);

    const workflow = await prisma.workflow.upsert({
      where: { domain: parsed.domain },
      update: { name: parsed.name, graph: parsed.graph },
      create: parsed,
    });

    return NextResponse.json(workflow, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    console.error("[workflows POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create GET /api/workflows/[domain]**

```typescript
// src/app/api/workflows/[domain]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { domain: params.domain },
    });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(workflow);
  } catch (e) {
    console.error("[workflows GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Seed a test Workflow row** (needed to test Task 2's POST properly)

```powershell
$body = @{
  name = "WebSiteLaunches Scraper"
  domain = "websitelaunches.com"
  graph = @{ nodes = @(); edges = @() }
} | ConvertTo-Json -Depth 5

$wf = Invoke-RestMethod -Uri "http://localhost:3000/api/workflows" -Method POST -Body $body -ContentType "application/json"
Write-Host "Workflow ID: $($wf.id)"
```

Save the returned `id` — it's needed for testing the launches endpoint.

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/workflows/
git commit -m "feat: add workflows API (POST upsert, GET by domain)"
```

---

## Task 5: Extension — Manifest Updates

**Files:**
- Modify: `d:\workspace\DotGit\manifest.json`

- [ ] **Step 1: Add permissions**

Open `manifest.json`. Change the `"permissions"` array from:

```json
"permissions": [
    "webRequest",
    "storage",
    "notifications",
    "downloads",
    "tabs",
    "scripting"
],
```

to:

```json
"permissions": [
    "webRequest",
    "storage",
    "notifications",
    "downloads",
    "tabs",
    "scripting",
    "contextualIdentities",
    "alarms",
    "cookies"
],
```

`contextualIdentities` = create/manage Firefox containers.
`alarms` = 12-hour schedule.
`cookies` = required when opening tabs with a specific `cookieStoreId`.

- [ ] **Step 2: Commit**

```powershell
cd d:\workspace\DotGit
git add manifest.json
git commit -m "feat: add contextualIdentities, alarms, cookies permissions"
```

---

## Task 6: Extension — Crypto Module

**Files:**
- Create: `d:\workspace\DotGit\scraper\crypto.js`

- [ ] **Step 1: Create crypto.js**

```javascript
// scraper/crypto.js
// AES-GCM credential encryption. Key derived from master password via PBKDF2.
// _derivedKey held in memory only — cleared on service worker restart.

let _derivedKey = null;

const SALT = new TextEncoder().encode("dotgit-scraper-v1");

export async function setMasterPassword(password) {
  const raw = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  _derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100000, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function hasMasterPassword() {
  return _derivedKey !== null;
}

export function clearMasterPassword() {
  _derivedKey = null;
}

export async function encrypt(plaintext) {
  if (!_derivedKey) throw new Error("Master password not set");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    _derivedKey,
    new TextEncoder().encode(plaintext)
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

export async function decrypt({ iv, data }) {
  if (!_derivedKey) throw new Error("Master password not set");
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const dataBytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    _derivedKey,
    dataBytes
  );
  return new TextDecoder().decode(plain);
}
```

- [ ] **Step 2: Verify the module loads without errors**

Load the extension in Firefox (`about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`). Open the browser console. No errors should appear on load.

- [ ] **Step 3: Commit**

```powershell
git add scraper/crypto.js
git commit -m "feat: add AES-GCM crypto module for credential encryption"
```

---

## Task 7: Extension — Account Pool Module

**Files:**
- Create: `d:\workspace\DotGit\scraper\accounts.js`

- [ ] **Step 1: Create accounts.js**

```javascript
// scraper/accounts.js
import { encrypt, decrypt } from "./crypto.js";

const STORAGE_KEY = "scraper_accounts";

export async function loadAccounts() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

async function saveAccounts(accounts) {
  await browser.storage.local.set({ [STORAGE_KEY]: accounts });
}

// records: Array<{ email: string, password: string, label?: string }>
export async function importAccounts(records) {
  const existing = await loadAccounts();
  const existingEmails = new Set(existing.map((a) => a.email));
  const added = [];

  for (const r of records) {
    if (!r.email || !r.password) continue;
    if (existingEmails.has(r.email)) continue;
    const { iv, data } = await encrypt(r.password);
    added.push({
      id: crypto.randomUUID(),
      email: r.email,
      encryptedPassword: data,
      iv,
      label: r.label || r.email,
      status: "active",      // "active" | "suspended" | "error"
      suspendedUntil: null,  // ISO string or null
      cookieStoreId: null,   // set when container is created
      lastUsed: null,        // ISO string or null
    });
    existingEmails.add(r.email);
  }

  await saveAccounts([...existing, ...added]);
  return added.length;
}

export async function getDecryptedPassword(account) {
  return decrypt({ iv: account.iv, data: account.encryptedPassword });
}

export async function updateAccount(id, patch) {
  const accounts = await loadAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return;
  accounts[idx] = { ...accounts[idx], ...patch };
  await saveAccounts(accounts);
}

export async function deleteAccount(id) {
  const accounts = await loadAccounts();
  await saveAccounts(accounts.filter((a) => a.id !== id));
}

export async function clearAllAccounts() {
  await browser.storage.local.remove(STORAGE_KEY);
}

// Parse CSV text into records array. Expects header row: email,password,label
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// Parse JSON text — expects array of { email, password, label? }
export function parseJSON(text) {
  return JSON.parse(text);
}
```

- [ ] **Step 2: Commit**

```powershell
git add scraper/accounts.js
git commit -m "feat: add account pool module with CSV/JSON import and encrypted storage"
```

---

## Task 8: Extension — Container Management Module

**Files:**
- Create: `d:\workspace\DotGit\scraper\containers.js`

- [ ] **Step 1: Create containers.js**

```javascript
// scraper/containers.js
import { loadAccounts, updateAccount } from "./accounts.js";

const COLORS = ["blue", "turquoise", "green", "yellow", "orange", "red", "pink", "purple"];

// Ensures a container exists for the account. Recreates if deleted.
// Returns the cookieStoreId.
export async function ensureContainer(account, colorIndex = 0) {
  if (account.cookieStoreId) {
    try {
      await browser.contextualIdentities.get(account.cookieStoreId);
      return account.cookieStoreId; // still alive
    } catch {
      // was deleted externally — fall through to create
    }
  }

  const container = await browser.contextualIdentities.create({
    name: `DotGit: ${account.email}`,
    color: COLORS[colorIndex % COLORS.length],
    icon: "briefcase",
  });

  await updateAccount(account.id, { cookieStoreId: container.cookieStoreId });
  return container.cookieStoreId;
}

// Ensures all accounts in the pool have containers. Safe to call on startup.
export async function ensureAllContainers() {
  const accounts = await loadAccounts();
  for (let i = 0; i < accounts.length; i++) {
    await ensureContainer(accounts[i], i);
  }
}

// Removes the container for an account (called when account is deleted from pool).
export async function removeContainer(cookieStoreId) {
  if (!cookieStoreId) return;
  try {
    await browser.contextualIdentities.remove(cookieStoreId);
  } catch {
    // already gone
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git add scraper/containers.js
git commit -m "feat: add container management module using contextualIdentities API"
```

---

## Task 9: Extension — Rotation Module

**Files:**
- Create: `d:\workspace\DotGit\scraper\rotation.js`

- [ ] **Step 1: Create rotation.js**

```javascript
// scraper/rotation.js
import { loadAccounts, updateAccount } from "./accounts.js";

const ROTATION_KEY = "scraper_rotation";

async function getRotation() {
  const result = await browser.storage.local.get(ROTATION_KEY);
  return result[ROTATION_KEY] ?? { index: 0, lastScrapeAt: null };
}

async function saveRotation(r) {
  await browser.storage.local.set({ [ROTATION_KEY]: r });
}

// Returns the next active (non-suspended, non-error) account, or null if none available.
export async function getNextAccount() {
  const accounts = await loadAccounts();
  if (accounts.length === 0) return null;

  const rotation = await getRotation();
  const now = Date.now();

  for (let i = 0; i < accounts.length; i++) {
    const idx = (rotation.index + i) % accounts.length;
    const account = accounts[idx];

    if (account.status === "error") continue;

    if (account.status === "suspended" && account.suspendedUntil) {
      if (new Date(account.suspendedUntil).getTime() > now) continue;
      // suspension expired — clear it
      await updateAccount(account.id, { status: "active", suspendedUntil: null });
      accounts[idx] = { ...account, status: "active", suspendedUntil: null };
    }

    // Found a usable account
    await saveRotation({ index: (idx + 1) % accounts.length, lastScrapeAt: now });
    await updateAccount(account.id, { lastUsed: new Date().toISOString() });
    return accounts[idx];
  }

  return null; // all suspended or error
}

export async function suspendAccount(id, hours) {
  const suspendedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  await updateAccount(id, { status: "suspended", suspendedUntil });
}

export async function markAccountError(id) {
  await updateAccount(id, { status: "error", suspendedUntil: null });
}

export async function getLastScrapeAt() {
  const r = await getRotation();
  return r.lastScrapeAt;
}
```

- [ ] **Step 2: Commit**

```powershell
git add scraper/rotation.js
git commit -m "feat: add account rotation module with suspension and round-robin logic"
```

---

## Task 10: Extension — ui.vision Trigger Module

**Files:**
- Create: `d:\workspace\DotGit\scraper\uivision.js`

- [ ] **Step 1: Create uivision.js**

The trigger protocol: DotGit injects a script into the scraper tab (world: MAIN) that sets `localStorage.XrunnerInput`. ui.vision's content script monitors this key and starts the macro. The macro writes results to `localStorage.DotGitScrapedData` and signals completion via `localStorage.XrunnerOutput`.

```javascript
// scraper/uivision.js

const MACRO_NAME = "dotgit-websitelaunches";
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL_MS = 1500;

// Opens a tab in the given container, waits for load, triggers the macro, returns scraped items.
// Caller is responsible for discarding the tab after this resolves/rejects.
export async function runMacroInContainer(cookieStoreId, macroName = MACRO_NAME) {
  const tab = await browser.tabs.create({
    url: "https://websitelaunches.com",
    cookieStoreId,
    active: false,
  });

  try {
    await waitForTabLoad(tab.id);
    await injectTrigger(tab.id, macroName);
    const items = await pollForResult(tab.id);
    return items;
  } finally {
    await browser.tabs.discard(tab.id).catch(() => {});
  }
}

async function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Tab load timeout")), 30000);
    browser.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === "complete") {
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

async function injectTrigger(tabId, macroName) {
  await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (macro) => {
      localStorage.removeItem("DotGitScrapedData");
      localStorage.removeItem("XrunnerOutput");
      localStorage.setItem(
        "XrunnerInput",
        JSON.stringify({ cmd: "run", macro, closeRPA: false })
      );
    },
    args: [macroName],
  });
}

async function pollForResult(tabId) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + TIMEOUT_MS;

    const interval = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(interval);
        reject(new Error("ui.vision macro timed out after 5 minutes"));
        return;
      }

      let result;
      try {
        const [frame] = await browser.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: () => ({
            output: localStorage.getItem("XrunnerOutput"),
            data: localStorage.getItem("DotGitScrapedData"),
          }),
        });
        result = frame.result;
      } catch {
        return; // tab navigated away mid-poll, keep waiting
      }

      if (result?.output) {
        clearInterval(interval);
        try {
          const parsed = JSON.parse(result.output);
          if (parsed.status === "error") {
            reject(new Error(parsed.msg || "Macro reported error"));
          } else {
            resolve(result.data ? JSON.parse(result.data) : []);
          }
        } catch (e) {
          reject(new Error("Failed to parse macro result: " + e.message));
        }
      }
    }, POLL_INTERVAL_MS);
  });
}
```

- [ ] **Step 2: Commit**

```powershell
git add scraper/uivision.js
git commit -m "feat: add ui.vision localStorage trigger module"
```

---

## Task 11: Extension — Backend Relay Module

**Files:**
- Create: `d:\workspace\DotGit\scraper\relay.js`

- [ ] **Step 1: Create relay.js**

```javascript
// scraper/relay.js

const CACHE_KEY = "scraper_pending_launches";
const MAX_CACHE = 1000;

async function getCached() {
  const result = await browser.storage.local.get(CACHE_KEY);
  return result[CACHE_KEY] ?? [];
}

async function setCached(items) {
  await browser.storage.local.set({ [CACHE_KEY]: items.slice(-MAX_CACHE) });
}

async function postOnce(backendUrl, workflowId, scrapedBy, items) {
  const res = await fetch(`${backendUrl}/api/launches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflowId, scrapedBy, items }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postWithRetry(backendUrl, workflowId, scrapedBy, items) {
  const delays = [1000, 5000, 15000];
  let last;
  for (const delay of delays) {
    try {
      return await postOnce(backendUrl, workflowId, scrapedBy, items);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last;
}

// Sends items to backend. Flushes cached items first. Caches on failure.
// Returns { inserted, skipped, cached } where cached = items that couldn't be sent.
export async function relay(backendUrl, workflowId, scrapedBy, items) {
  const cached = await getCached();

  // Try to flush cache first
  if (cached.length > 0) {
    try {
      await postWithRetry(backendUrl, workflowId, scrapedBy, cached);
      await setCached([]);
    } catch {
      // still offline — just add new items to cache
      await setCached([...cached, ...items]);
      return { inserted: 0, skipped: 0, cached: items.length };
    }
  }

  // Send new items
  try {
    const result = await postWithRetry(backendUrl, workflowId, scrapedBy, items);
    return { ...result, cached: 0 };
  } catch {
    await setCached([...await getCached(), ...items]);
    return { inserted: 0, skipped: 0, cached: items.length };
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git add scraper/relay.js
git commit -m "feat: add backend relay module with retry/backoff and offline cache"
```

---

## Task 12: Extension — Scrape Log Module

**Files:**
- Create: `d:\workspace\DotGit\scraper\log.js`

- [ ] **Step 1: Create log.js**

```javascript
// scraper/log.js

const LOG_KEY = "scraper_log";
const MAX_LOG = 100;

export async function appendLog(entry) {
  // entry: { timestamp, accountEmail, itemsInserted, itemsSkipped, cached, error }
  const result = await browser.storage.local.get(LOG_KEY);
  const log = result[LOG_KEY] ?? [];
  log.unshift({ timestamp: new Date().toISOString(), ...entry });
  await browser.storage.local.set({ [LOG_KEY]: log.slice(0, MAX_LOG) });
}

export async function getLog() {
  const result = await browser.storage.local.get(LOG_KEY);
  return result[LOG_KEY] ?? [];
}

export async function clearLog() {
  await browser.storage.local.remove(LOG_KEY);
}
```

- [ ] **Step 2: Commit**

```powershell
git add scraper/log.js
git commit -m "feat: add scrape log module"
```

---

## Task 13: Extension — Orchestration Module

**Files:**
- Create: `d:\workspace\DotGit\scraper\orchestrate.js`

- [ ] **Step 1: Create orchestrate.js**

This is the main scrape cycle logic. It is called by the background worker alarm listener.

```javascript
// scraper/orchestrate.js
import { ensureContainer } from "./containers.js";
import { getNextAccount, suspendAccount, markAccountError } from "./rotation.js";
import { runMacroInContainer } from "./uivision.js";
import { relay } from "./relay.js";
import { appendLog } from "./log.js";

const SETTINGS_KEY = "scraper_settings";

async function getSettings() {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY] ?? {
    backendUrl: "http://localhost:3000",
    workflowId: "",
    enabled: false,
  };
}

export async function saveScraperSettings(settings) {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getScraperSettings() {
  return getSettings();
}

export async function runScrapeCycle() {
  const settings = await getSettings();

  if (!settings.enabled) return;
  if (!settings.workflowId) {
    await appendLog({ accountEmail: null, itemsInserted: 0, itemsSkipped: 0, cached: 0, error: "No workflowId configured" });
    return;
  }

  const account = await getNextAccount();
  if (!account) {
    await appendLog({ accountEmail: null, itemsInserted: 0, itemsSkipped: 0, cached: 0, error: "No active accounts available" });
    return;
  }

  try {
    const cookieStoreId = await ensureContainer(account, 0);
    const items = await runMacroInContainer(cookieStoreId);

    if (!items || items.length === 0) {
      await appendLog({ accountEmail: account.email, itemsInserted: 0, itemsSkipped: 0, cached: 0, error: null });
      return;
    }

    const result = await relay(settings.backendUrl, settings.workflowId, account.email, items);
    await appendLog({
      accountEmail: account.email,
      itemsInserted: result.inserted,
      itemsSkipped: result.skipped,
      cached: result.cached,
      error: null,
    });

    if (result.cached > 0) {
      browser.notifications.create({ type: "basic", iconUrl: "/icons/dotgit-48.png", title: "DotGit Scraper", message: "Backend unreachable — results cached locally." });
    } else {
      browser.notifications.create({ type: "basic", iconUrl: "/icons/dotgit-48.png", title: "DotGit Scraper", message: `Scraped ${result.inserted} new launches.` });
    }

  } catch (e) {
    const msg = e.message ?? String(e);

    if (msg.includes("rate") || msg.toLowerCase().includes("limit")) {
      await suspendAccount(account.id, 48);
    } else if (msg.includes("login") || msg.includes("auth")) {
      await markAccountError(account.id);
      browser.notifications.create({ type: "basic", iconUrl: "/icons/dotgit-48.png", title: "DotGit Scraper — Login Failed", message: `${account.email} needs a password reset.` });
    } else {
      await suspendAccount(account.id, 24);
    }

    await appendLog({ accountEmail: account.email, itemsInserted: 0, itemsSkipped: 0, cached: 0, error: msg });
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git add scraper/orchestrate.js
git commit -m "feat: add scrape cycle orchestration module"
```

---

## Task 14: Extension — Background Worker Alarm Integration

**Files:**
- Modify: `d:\workspace\DotGit\dotgit.js`

- [ ] **Step 1: Add scraper imports and alarm setup to dotgit.js**

Add these lines at the very top of `dotgit.js` (after the existing imports):

```javascript
import { runScrapeCycle } from "/scraper/orchestrate.js";
import { ensureAllContainers } from "/scraper/containers.js";

const ALARM_NAME = "dotgit-scraper-12h";
```

- [ ] **Step 2: Register alarm on install and startup**

Find the `browser.runtime.onInstalled` listener in `dotgit.js` (or add one if it doesn't exist). Add alarm registration inside it, and also register on startup:

```javascript
// Add inside browser.runtime.onInstalled.addListener callback:
browser.alarms.create(ALARM_NAME, { periodInMinutes: 720 }); // 12 hours
await ensureAllContainers();

// Also add this new listener at module level (after existing listeners):
browser.runtime.onStartup.addListener(async () => {
  browser.alarms.create(ALARM_NAME, { periodInMinutes: 720 });
  await ensureAllContainers();
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await runScrapeCycle();
  }
});
```

- [ ] **Step 3: Add message handler for manual trigger from popup**

Find or add a `browser.runtime.onMessage.addListener` block in `dotgit.js`. Add this case:

```javascript
// Inside the onMessage listener, add:
if (message.type === "SCRAPER_RUN_NOW") {
  runScrapeCycle(); // intentionally not awaited — fire and forget
  return Promise.resolve({ ok: true });
}
```

- [ ] **Step 4: Reload and verify alarm is registered**

Load the extension in Firefox, then in the browser console (background script context):

```javascript
browser.alarms.getAll().then(console.log)
```

Expected: an array containing `{ name: "dotgit-scraper-12h", periodInMinutes: 720, ... }`.

- [ ] **Step 5: Commit**

```powershell
git add dotgit.js
git commit -m "feat: register 12hr alarm and wire scrape cycle to background worker"
```

---

## Task 15: Options Page — Settings + Account Pool UI

**Files:**
- Modify: `d:\workspace\DotGit\options\options.html`
- Modify: `d:\workspace\DotGit\options\options.js`

- [ ] **Step 1: Add scraper section to options.html**

Find the closing `</body>` tag in `options/options.html`. Insert before it:

```html
<!-- SCRAPER SETTINGS -->
<div class="section" id="scraper-section">
  <h2>Scraper Settings</h2>

  <label>Master Password (encrypts stored credentials)
    <input type="password" id="master-password" placeholder="Set once per browser session" />
    <button id="set-master-password">Unlock</button>
    <span id="master-password-status"></span>
  </label>

  <label>Backend URL
    <input type="text" id="backend-url" placeholder="http://localhost:3000" />
  </label>

  <label>Workflow ID (from /api/workflows)
    <input type="text" id="workflow-id" placeholder="cuid..." />
  </label>

  <label>
    <input type="checkbox" id="scraper-enabled" />
    Enable 12-hour scheduled scraping
  </label>

  <button id="save-scraper-settings">Save Settings</button>

  <h3>Account Pool</h3>
  <input type="file" id="account-file" accept=".csv,.json" />
  <button id="import-accounts">Import</button>
  <span id="import-status"></span>

  <table id="account-table">
    <thead>
      <tr><th>Email</th><th>Status</th><th>Last Used</th><th>Action</th></tr>
    </thead>
    <tbody id="account-tbody"></tbody>
  </table>

  <button id="clear-accounts">Clear All Accounts</button>

  <h3>Scrape Log</h3>
  <button id="clear-log">Clear Log</button>
  <table id="log-table">
    <thead>
      <tr><th>Time</th><th>Account</th><th>Inserted</th><th>Skipped</th><th>Cached</th><th>Error</th></tr>
    </thead>
    <tbody id="log-tbody"></tbody>
  </table>
</div>
```

- [ ] **Step 2: Add scraper logic to options.js**

Append to the bottom of `options/options.js`:

```javascript
// ---- SCRAPER OPTIONS ----
import { importAccounts, loadAccounts, deleteAccount, clearAllAccounts, parseCSV, parseJSON } from "/scraper/accounts.js";
import { setMasterPassword, hasMasterPassword } from "/scraper/crypto.js";
import { saveScraperSettings, getScraperSettings } from "/scraper/orchestrate.js";
import { getLog, clearLog } from "/scraper/log.js";

async function renderAccountTable() {
  const accounts = await loadAccounts();
  const tbody = document.getElementById("account-tbody");
  tbody.innerHTML = accounts.map((a) => `
    <tr>
      <td>${a.email}</td>
      <td>${a.status}${a.suspendedUntil ? " until " + new Date(a.suspendedUntil).toLocaleString() : ""}</td>
      <td>${a.lastUsed ? new Date(a.lastUsed).toLocaleString() : "—"}</td>
      <td><button data-delete="${a.id}">Delete</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteAccount(btn.dataset.delete);
      await renderAccountTable();
    });
  });
}

async function renderLog() {
  const log = await getLog();
  const tbody = document.getElementById("log-tbody");
  tbody.innerHTML = log.map((e) => `
    <tr>
      <td>${new Date(e.timestamp).toLocaleString()}</td>
      <td>${e.accountEmail ?? "—"}</td>
      <td>${e.itemsInserted}</td>
      <td>${e.itemsSkipped}</td>
      <td>${e.cached}</td>
      <td>${e.error ?? "—"}</td>
    </tr>
  `).join("");
}

async function initScraperSection() {
  const settings = await getScraperSettings();
  document.getElementById("backend-url").value = settings.backendUrl;
  document.getElementById("workflow-id").value = settings.workflowId;
  document.getElementById("scraper-enabled").checked = settings.enabled;

  if (hasMasterPassword()) {
    document.getElementById("master-password-status").textContent = "✅ Unlocked";
  }

  document.getElementById("set-master-password").addEventListener("click", async () => {
    const pw = document.getElementById("master-password").value;
    if (!pw) return;
    await setMasterPassword(pw);
    document.getElementById("master-password-status").textContent = "✅ Unlocked";
    document.getElementById("master-password").value = "";
  });

  document.getElementById("save-scraper-settings").addEventListener("click", async () => {
    await saveScraperSettings({
      backendUrl: document.getElementById("backend-url").value,
      workflowId: document.getElementById("workflow-id").value,
      enabled: document.getElementById("scraper-enabled").checked,
    });
  });

  document.getElementById("import-accounts").addEventListener("click", async () => {
    const file = document.getElementById("account-file").files[0];
    if (!file) return;
    if (!hasMasterPassword()) {
      document.getElementById("import-status").textContent = "❌ Unlock master password first";
      return;
    }
    const text = await file.text();
    const records = file.name.endsWith(".json") ? parseJSON(text) : parseCSV(text);
    const count = await importAccounts(records);
    document.getElementById("import-status").textContent = `✅ Imported ${count} accounts`;
    await renderAccountTable();
  });

  document.getElementById("clear-accounts").addEventListener("click", async () => {
    if (!confirm("Delete all accounts?")) return;
    await clearAllAccounts();
    await renderAccountTable();
  });

  document.getElementById("clear-log").addEventListener("click", async () => {
    await clearLog();
    await renderLog();
  });

  await renderAccountTable();
  await renderLog();
}

initScraperSection();
```

- [ ] **Step 3: Enable ES modules on the options page**

Open `options/options.html`. Find the `<script>` tag that loads `options.js` and add `type="module"`:

```html
<!-- Before -->
<script src="options.js"></script>
<!-- After -->
<script src="options.js" type="module"></script>
```

This is required for the `import` statements in options.js to work. The existing options.js code is already ES-module-compatible (no CommonJS patterns).

- [ ] **Step 4: Verify the options page loads without JS errors**

Open the extension options page in Firefox. The Scraper Settings section should render with empty tables. No console errors.

- [ ] **Step 4: Commit**

```powershell
git add options/options.html options/options.js
git commit -m "feat: add scraper settings and account pool UI to options page"
```

---

## Task 16: Extension — Popup Launches Tab

**Files:**
- Modify: `d:\workspace\DotGit\popup\popup.html`
- Modify: `d:\workspace\DotGit\popup\popup.js`

- [ ] **Step 1: Add Launches tab to popup.html**

Find the tab/navigation area in `popup/popup.html`. Add a Launches tab button and panel. Insert before the closing `</body>`:

```html
<!-- Tab button (add alongside existing tab buttons) -->
<button class="tab-btn" id="tab-launches">Launches</button>

<!-- Launches panel -->
<div id="panel-launches" class="tab-panel" style="display:none;">
  <div id="scrape-meta">
    <span id="last-scrape-text">Last scrape: —</span>
    <button id="run-scrape-now">Run now</button>
  </div>
  <ul id="launches-list"></ul>
  <a id="view-all-launches" href="#" target="_blank">View all in backend →</a>
</div>
```

- [ ] **Step 2: Add Launches tab logic to popup.js**

Append to `popup/popup.js`:

```javascript
// ---- LAUNCHES TAB ----
import { getLastScrapeAt } from "/scraper/rotation.js";

async function renderLaunchesTab() {
  const lastAt = await getLastScrapeAt();
  document.getElementById("last-scrape-text").textContent =
    lastAt ? "Last scrape: " + new Date(lastAt).toLocaleString() : "Last scrape: never";

  // Load cached launches from storage (set by relay on success)
  const result = await browser.storage.local.get("scraper_recent_launches");
  const launches = result.scraper_recent_launches ?? [];
  const list = document.getElementById("launches-list");
  list.innerHTML = launches.slice(0, 20).map((l) => `
    <li>
      <a href="${l.url}" target="_blank">${l.name || l.url}</a>
      <small>${l.category ?? ""} ${l.launchDate ? "· " + l.launchDate.slice(0, 10) : ""}</small>
    </li>
  `).join("");
}

document.getElementById("tab-launches").addEventListener("click", () => {
  document.querySelectorAll(".tab-panel").forEach((p) => (p.style.display = "none"));
  document.getElementById("panel-launches").style.display = "block";
  renderLaunchesTab();
});

document.getElementById("run-scrape-now").addEventListener("click", () => {
  browser.runtime.sendMessage({ type: "SCRAPER_RUN_NOW" });
});

// Link to backend
const settings = await browser.storage.local.get("scraper_settings");
const backendUrl = settings.scraper_settings?.backendUrl ?? "http://localhost:3000";
document.getElementById("view-all-launches").href = `${backendUrl}/api/launches`;
```

- [ ] **Step 3: Update relay.js to cache recent launches in storage**

Open `scraper/relay.js`. At the end of the successful `postWithRetry` call (in the `relay` function), after getting `result`, add:

```javascript
// Cache the last 50 items for popup display
const { scraper_recent_launches: existing = [] } = await browser.storage.local.get("scraper_recent_launches");
const merged = [...items, ...existing].slice(0, 50);
await browser.storage.local.set({ scraper_recent_launches: merged });
```

- [ ] **Step 4: Enable ES modules on the popup page**

Open `popup/popup.html`. Find the `<script>` tag that loads `popup.js` and add `type="module"`:

```html
<!-- Before -->
<script src="popup.js"></script>
<!-- After -->
<script src="popup.js" type="module"></script>
```

- [ ] **Step 5: Verify popup renders without errors**

Open the DotGit popup in Firefox. Click the Launches tab. It should show "Last scrape: never" and an empty list. No console errors.

- [ ] **Step 5: Commit**

```powershell
git add popup/popup.html popup/popup.js scraper/relay.js
git commit -m "feat: add Launches tab to popup with manual trigger and recent launches list"
```

---

## Task 17: End-to-End Smoke Test

This task verifies the full pipeline manually using a real Firefox instance.

**Prerequisites:** ui.vision extension installed. vuln-scanner backend running. A test Outlook account pre-created (real credentials).

- [ ] **Step 1: Load the extension**

Go to `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json` from `d:\workspace\DotGit`.

- [ ] **Step 2: Set master password and import test account**

Open Options → Scraper Settings. Set master password. Import a CSV with one test account:

```csv
email,password,label
your@outlook.com,yourpassword,test-account
```

Verify it appears in the account table with status `active`.

- [ ] **Step 3: Configure settings**

Set Backend URL to `http://localhost:3000`. Set Workflow ID to the cuid from Task 4 Step 3. Enable scraping.

- [ ] **Step 4: Create and import a test ui.vision macro**

In ui.vision, create a macro named `dotgit-websitelaunches` with these steps:
1. `open | https://websitelaunches.com`
2. `storeText | css=.launch-title | launchName` (adjust selector to real page)
3. A `executeScript` step that writes to `localStorage.DotGitScrapedData`:
   ```javascript
   localStorage.setItem("DotGitScrapedData", JSON.stringify([{url: "https://test-launch.com", name: "Test Launch", category: "Test"}]));
   ```
4. `echo | Done`

This minimal macro verifies the handshake without needing to scrape real data yet.

- [ ] **Step 5: Trigger a manual scrape**

Open the DotGit popup → Launches tab → click "Run now". Watch the browser console (background script). Expected log sequence:

```
[orchestrate] Starting scrape cycle
[orchestrate] Using account: your@outlook.com
[uivision] Tab opened, waiting for load...
[uivision] Trigger injected
[uivision] Result received: 1 items
[relay] Posted to backend: { inserted: 1, skipped: 0 }
```

- [ ] **Step 6: Verify data in backend**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/launches" -Method GET
```

Expected: `items` array contains the test launch record.

- [ ] **Step 7: Commit**

No code changes in this task. If you had to fix anything during smoke test, commit those fixes separately with descriptive messages.

---

## What's Next: Plan B — Workflow Designer

Plan A is complete. The scraping pipeline is functional with manually created ui.vision macros. The visual node-based workflow designer (React + React Flow + Vite, exported as ui.vision macro JSON) is a separate implementation plan. Start it by running the brainstorming skill on the workflow designer subsystem, using the spec at `docs/superpowers/specs/2026-05-27-dotgit-multiaccount-scraper-design.md` (section 3) as the starting point.

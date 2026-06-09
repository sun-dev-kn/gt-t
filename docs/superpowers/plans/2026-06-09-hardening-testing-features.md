# DotGit Hardening, Testing & Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the newly-implemented features with security fixes, a test suite, architecture cleanup, and four new user-facing capabilities.

**Architecture:** Twelve independent tasks across four subsystems — Security (safe validator sandbox + rate limiting), Architecture (shared path map, config fixes, startup validation), Testing (Vitest for stealth helpers + backend services), and Features (export, CI, sync storage, push notifications, severity override).

**Tech Stack:** Browser Extension MV3, Vitest, express-rate-limit, GitHub Actions, chrome.storage.sync, Telegram/Slack webhooks

**Branch:** Continue on `feat/hot-reload-stealth-intel`.

---

## Files Map

| File | Action | Why |
|------|--------|-----|
| `lib/validate-sandbox.js` | **Create** | Safe pattern parser replacing `new Function` |
| `content_script.js` | Modify | Use safe validator at line ~1096 |
| `intelligence-backend/routes/enrich.js` | Modify | Add rate limiter |
| `intelligence-backend/server.js` | Modify | Startup validation |
| `intelligence-backend/routes/admin.js` | Modify | Richer health endpoint |
| `lib/finding-paths.js` | **Create** | Single source of truth for 91 path mappings |
| `dotgit.js` | Modify | Import from lib/finding-paths.js |
| `popup/popup.js` | Modify | Import from lib/finding-paths.js + export buttons |
| `popup/popup.html` | Modify | Add export buttons |
| `.web-ext.config.cjs` | Modify | Change `firefoxdeveloperedition` → `firefox` |
| `lib/stealth.js` | **Create** | Pure stealth utility functions (testable) |
| `lib/stealth.test.js` | **Create** | Vitest tests for stealth helpers |
| `intelligence-backend/services/enricher.test.js` | **Create** | Tests for enrichFinding with mocked AI/DB |
| `intelligence-backend/services/extractor.test.js` | **Create** | Tests for extractChecksFromMessage |
| `intelligence-backend/services/notifier.js` | **Create** | Telegram/Slack push notification service |
| `.github/workflows/ci.yml` | **Create** | CI: test + web-ext lint |
| `options/options.html` | Modify | Sync toggle + per-check severity override UI |
| `options/options.js` | Modify | Wire sync toggle + severity override |

---

## Task 1 — Security: Replace `new Function` with Safe Pattern Parser

**Problem:** `content_script.js:1096` uses `new Function('text', c.validate_js)` to run arbitrary remote-supplied code in the user's browser. This is an XSS/code-injection vector if the intelligence backend is compromised.

**Solution:** Accept only safe patterns (`/regex/.test(text)`, `text.includes("x")`, `text.startsWith("x")`). Parse and execute natively without `eval` or `new Function`.

**Files:**
- Create: `d:\workspace\DotGit\lib\validate-sandbox.js`
- Modify: `d:\workspace\DotGit\content_script.js` (line ~1096)

- [ ] **Step 1: Create `lib/validate-sandbox.js`**

```javascript
/**
 * Safe validator — parses only known-safe validate_js patterns.
 * Never calls eval or new Function.
 *
 * Accepted forms (matching intelligence-backend extractor output):
 *   return /pattern/flags.test(text)
 *   return text.includes("string")
 *   return text.startsWith("string")
 *   return true
 *   return false
 *
 * Any unrecognised pattern returns false (safe default).
 */
export function safeValidate(validateJs, text) {
  if (!validateJs || typeof validateJs !== 'string') return true;
  const src = validateJs.trim();

  if (src === 'return true' || src === 'return true;') return true;
  if (src === 'return false' || src === 'return false;') return false;

  // return /pattern/flags.test(text)
  const regexMatch = src.match(/^return\s+\/(.+?)\/([gimsuy]*)\s*\.test\(text\)\s*;?$/);
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1], regexMatch[2]).test(text);
    } catch {
      return false;
    }
  }

  // return text.includes("string") or text.includes('string')
  const includesMatch = src.match(/^return\s+text\.includes\((['"])(.+?)\1\)\s*;?$/);
  if (includesMatch) {
    return text.includes(includesMatch[2]);
  }

  // return text.startsWith("string") or text.startsWith('string')
  const startsMatch = src.match(/^return\s+text\.startsWith\((['"])(.+?)\1\)\s*;?$/);
  if (startsMatch) {
    return text.startsWith(startsMatch[2]);
  }

  // Unrecognised pattern — safe default: don't match
  return false;
}
```

- [ ] **Step 2: Add `lib/validate-sandbox.js` to `manifest.json` `web_accessible_resources`**

In `manifest.json`, find the first `web_accessible_resources` entry (the one with `"content_script.js"` and `"recorder.js"`). Add `"lib/validate-sandbox.js"`:

```json
"web_accessible_resources": [
  {
    "resources": [
      "content_script.js",
      "recorder.js",
      "lib/validate-sandbox.js"
    ],
    "matches": ["<all_urls>"]
  },
  ...
]
```

- [ ] **Step 3: Replace `new Function` in `content_script.js` at line ~1096**

The current code:
```javascript
validate: c.validate_js ? new Function('text', c.validate_js) : () => true,
```

Since `content_script.js` is a classic script (not a module), we cannot `import` directly. Instead, add a self-contained `safeValidate` function inline at the top of content_script.js, right after the `rateLimitMap` declaration (line ~7). Copy the body of `lib/validate-sandbox.js` as a plain `function safeValidate(validateJs, text) { ... }` inside the `if (typeof window.dotGitInjected === 'undefined')` block.

Then replace line ~1096:
```javascript
validate: c.validate_js ? (text) => safeValidate(c.validate_js, text) : () => true,
```

- [ ] **Step 4: Verify tests still pass**

```
cd d:\workspace\DotGit\workflow && npm test
```
Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/validate-sandbox.js manifest.json content_script.js
git commit -m "security: replace new Function with safe pattern parser for validate_js"
```

---

## Task 2 — Security: Rate Limit `/api/enrich`

**Problem:** `intelligence-backend/routes/enrich.js` has no rate limiting — a caller can hammer AI enrichment indefinitely.

**Files:**
- Modify: `d:\workspace\DotGit\intelligence-backend\routes\enrich.js`
- Modify: `d:\workspace\DotGit\intelligence-backend\package.json`

- [ ] **Step 1: Install `express-rate-limit`**

```bash
cd d:\workspace\DotGit\intelligence-backend && npm install express-rate-limit
```

- [ ] **Step 2: Add rate limiter to `routes/enrich.js`**

Read the current file first. At the top (after existing imports), add:

```javascript
import rateLimit from 'express-rate-limit';

const enrichLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enrichment requests, please try again later.' },
});
```

On the `router.post('/enrich', ...)` line, add `enrichLimiter` as middleware:

```javascript
router.post('/enrich', enrichLimiter, async (req, res) => {
```

- [ ] **Step 3: Commit**

```bash
git add intelligence-backend/routes/enrich.js intelligence-backend/package.json intelligence-backend/package-lock.json
git commit -m "security: add express-rate-limit (20 req/min) to /api/enrich"
```

---

## Task 3 — Architecture: Shared `FINDING_PATH_MAP`

**Problem:** The 91-entry path map is duplicated between `dotgit.js` (`FINDING_PATH_MAP`, lines 136-226) and `popup/popup.js` (`FINDING_LINK_MAP`, lines 8-96). They differ in one entry: `"git"` maps to `"/.git/"` in dotgit.js but `"/.git/config"` in popup.js. These will diverge as dynamic checks are added.

**Decision:** Create `lib/finding-paths.js` as the canonical source. The popup already uses `type="module"` (`popup.html:11`), so it can import ES modules.

**Files:**
- Create: `d:\workspace\DotGit\lib\finding-paths.js`
- Modify: `d:\workspace\DotGit\dotgit.js` (remove lines 136-226, add import)
- Modify: `d:\workspace\DotGit\popup\popup.js` (remove lines 8-96, add import)

- [ ] **Step 1: Read both maps to confirm the one difference**

Read `dotgit.js:136-226` and `popup/popup.js:8-96`. Verify the only difference is `"git": "/.git/"` vs `"git": "/.git/config"`. The popup version (link to a specific file) is better for the popup use case, but use `"/.git/"` as canonical and let popup add the `/config` suffix when building links.

- [ ] **Step 2: Create `lib/finding-paths.js`**

Copy all 91 entries from `dotgit.js:136-226` (use `"/.git/"` for "git"):

```javascript
// Canonical check-id → relative path mapping. Shared between background and popup.
export const FINDING_PATH_MAP = {
  "git": "/.git/",
  "svn": "/.svn/",
  "hg": "/.hg/",
  "env": "/.env",
  "ds_store": "/.DS_Store",
  "cvs": "/CVS/",
  "bzr": "/.bzr/",
  "svn_entries": "/.svn/entries",
  "env_local": "/.env.local",
  "env_production": "/.env.production",
  // ... (all 91 entries from dotgit.js) ...
  "log_files": "/access.log",
  "api_config": "/api/config",
  "client_access_policy": "/clientaccesspolicy.xml",
  "readme_docs": "/README.md",
  "csv_export": "/export.csv"
};

export function getFindingPath(type) {
  return FINDING_PATH_MAP[type] || '/' + type;
}
```

**IMPORTANT:** Include ALL 91 entries verbatim from dotgit.js — do not truncate.

- [ ] **Step 3: Update `dotgit.js` — remove duplicate and add import**

Remove the `const FINDING_PATH_MAP = { ... }` block (lines 136-226) and any existing `getFindingPath` function. Add at the top of the file (after existing imports, before `const ALARM_NAME`):

```javascript
import { FINDING_PATH_MAP, getFindingPath } from '/lib/finding-paths.js';
```

- [ ] **Step 4: Update `popup/popup.js` — remove duplicate and add import**

Remove the `const FINDING_LINK_MAP = { ... }` block (lines 8-96). At the top of the file, add:

```javascript
import { FINDING_PATH_MAP } from '/lib/finding-paths.js';
```

Then replace all occurrences of `FINDING_LINK_MAP` with `FINDING_PATH_MAP` throughout popup.js. Note: the popup previously used `"/.git/config"` — this changes to `"/.git/"`. If the popup appends "config" separately anywhere, keep that logic; otherwise the behaviour changes slightly (links to `/.git/` dir instead of `/.git/config` file). This is acceptable.

- [ ] **Step 5: Verify tests pass**

```
cd d:\workspace\DotGit\workflow && npm test
```

- [ ] **Step 6: Commit**

```bash
git add lib/finding-paths.js dotgit.js popup/popup.js
git commit -m "refactor: extract shared FINDING_PATH_MAP to lib/finding-paths.js"
```

---

## Task 4 — Architecture: web-ext Config Fix + Backend Startup Validation

Two small fixes bundled together.

**Files:**
- Modify: `d:\workspace\DotGit\.web-ext.config.cjs`
- Modify: `d:\workspace\DotGit\intelligence-backend\server.js`
- Modify: `d:\workspace\DotGit\intelligence-backend\routes\admin.js`

- [ ] **Step 1: Read `.web-ext.config.cjs`**

Find the line that says `firefox: 'firefoxdeveloperedition'`. Change it to `firefox: 'firefox'`. Add a comment above it:
```javascript
// Change to 'firefoxdeveloperedition' if you have Firefox Developer Edition installed locally.
firefox: 'firefox',
```

- [ ] **Step 2: Add startup validation function to `intelligence-backend/server.js`**

After the existing `if (!INTEL_API_KEY)` warning block (line ~13), add:

```javascript
function validateStartupConfig() {
  if (!process.env.INTEL_API_KEY) {
    console.error('[intel] ✖  INTEL_API_KEY is not set — all API requests will be rejected (401)');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[intel] ⚠  ANTHROPIC_API_KEY is not set — /api/enrich will fail');
  }
  if (process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_CHANNELS) {
    console.warn('[intel] ⚠  TELEGRAM_BOT_TOKEN set but TELEGRAM_CHANNELS is empty — scheduler will not start');
  }
}

validateStartupConfig();
```

Remove the old `if (!INTEL_API_KEY) console.warn(...)` block — it's superseded by `validateStartupConfig()`.

- [ ] **Step 3: Enrich the `/api/health` response in `intelligence-backend/routes/admin.js`**

Read the current admin.js file. Find the `/health` GET handler. Replace its response body with:

```javascript
res.json({
  ok: !!process.env.INTEL_API_KEY,
  db_checks: count.n,
  ai_provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'none',
  telegram_enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNELS),
  timestamp: new Date().toISOString(),
});
```

- [ ] **Step 4: Commit**

```bash
git add .web-ext.config.cjs intelligence-backend/server.js intelligence-backend/routes/admin.js
git commit -m "fix: web-ext uses 'firefox' default; intel backend validates env vars on startup"
```

---

## Task 5 — Feature: Export Findings (JSON + CSV)

Allow users to download their findings from the popup.

**Files:**
- Modify: `d:\workspace\DotGit\popup\popup.html`
- Modify: `d:\workspace\DotGit\popup\popup.js`

- [ ] **Step 1: Add export buttons to `popup.html`**

In `popup.html`, inside `<ul class="right">` (line ~21), add two buttons next to the existing icon buttons:

```html
<li><a><button id="export-json" title="Export findings as JSON" style="background:none;border:none;cursor:pointer;padding:0 4px;color:inherit;font-size:11px;line-height:64px;">JSON</button></a></li>
<li><a><button id="export-csv" title="Export findings as CSV" style="background:none;border:none;cursor:pointer;padding:0 4px;color:inherit;font-size:11px;line-height:64px;">CSV</button></a></li>
```

- [ ] **Step 2: Add export functions to `popup.js`**

Add these two functions before the DOMContentLoaded handler:

```javascript
function exportJSON(findings) {
  const blob = new Blob([JSON.stringify(findings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dotgit-findings-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSV(findings) {
  const headers = ['url', 'type', 'severity', 'foundAt', 'cve_id', 'cvss_score', 'remediation'];
  const escape = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = findings.map(f => [
    f.url || '',
    f.type || '',
    f.severity || '',
    f.foundAt || '',
    f.enrichment?.cve_id || '',
    f.enrichment?.cvss_score ?? '',
    f.enrichment?.remediation || '',
  ].map(escape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dotgit-findings-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Wire up buttons**

Read popup.js to find where findings are loaded (look for `chrome.storage.local.get` with `withExposedGit`). Inside that callback, after the findings array is built, add:

```javascript
document.getElementById('export-json')?.addEventListener('click', () => exportJSON(array));
document.getElementById('export-csv')?.addEventListener('click', () => exportCSV(array));
```

(Replace `array` with the actual variable name holding the findings array in context.)

- [ ] **Step 4: Commit**

```bash
git add popup/popup.html popup/popup.js
git commit -m "feat: add JSON and CSV export buttons to findings popup"
```

---

## Task 6 — DevOps: GitHub Actions CI

**Files:**
- Create: `d:\workspace\DotGit\.github\workflows\ci.yml`

- [ ] **Step 1: Create `.github/workflows/` directory**

```bash
mkdir -p d:\workspace\DotGit\.github\workflows
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master, 'feat/**']
  pull_request:
    branches: [master]

jobs:
  test-workflow:
    name: Workflow Designer Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: workflow/package-lock.json
      - run: cd workflow && npm ci
      - run: cd workflow && npm test

  test-intel:
    name: Intelligence Backend Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: intelligence-backend/package-lock.json
      - run: cd intelligence-backend && npm ci
      - run: cd intelligence-backend && npm test --if-present

  lint-extension:
    name: web-ext Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g web-ext
      - run: web-ext lint --source-dir . --ignore-files 'workflow/**' 'relay-server/**' 'intelligence-backend/**' 'node_modules/**' '.git/**' 'docs/**'
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for tests and web-ext lint"
```

---

## Task 7 — Testing: Stealth Helper Unit Tests

**Problem:** The stealth functions in `content_script.js` (rate-limit tracking, header building) are pure and testable, but trapped inside a classic-script guard. Extract them so Vitest can import and test them.

**Files:**
- Create: `d:\workspace\DotGit\lib\stealth.js`
- Create: `d:\workspace\DotGit\lib\stealth.test.js`
- Modify: `d:\workspace\DotGit\content_script.js` (inline the functions from stealth.js)
- Modify: `d:\workspace\DotGit\workflow\vite.config.ts` (add `../lib/**/*.test.js` to test include)

- [ ] **Step 1: Read content_script.js to find all stealth function definitions**

Search for `buildStealthHeaders`, `randomDelay`, `isOriginSuspended`, `markRateLimited`, `trackHttp403`. Note their exact implementations.

- [ ] **Step 2: Create `lib/stealth.js`**

```javascript
// Pure stealth utility functions — mirrored in content_script.js for testing.
// content_script.js is a classic script that cannot import ES modules, so these
// are kept in sync manually. Tests import from this file.

export const rateLimitMap = new Map();

export function buildStealthHeaders(origin) {
  return {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": origin + "/",
  };
}

export function randomDelay(min, max) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

export function isOriginSuspended(origin) {
  const state = rateLimitMap.get(origin);
  if (!state?.suspended) return false;
  if (Date.now() > state.suspendedUntil) {
    state.suspended = false;
    return false;
  }
  return true;
}

export function markRateLimited(origin) {
  rateLimitMap.set(origin, {
    count403: 0,
    suspended: true,
    suspendedUntil: Date.now() + 5 * 60 * 1000,
  });
}

export function trackHttp403(origin) {
  const state = rateLimitMap.get(origin) || { count403: 0, suspended: false, suspendedUntil: 0 };
  state.count403 = (state.count403 || 0) + 1;
  rateLimitMap.set(origin, state);
  if (state.count403 >= 5) {
    markRateLimited(origin);
    return true;
  }
  return false;
}
```

**Note:** Copy the actual implementations from content_script.js — do not invent different implementations.

- [ ] **Step 3: Create `lib/stealth.test.js`**

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  rateLimitMap,
  buildStealthHeaders,
  isOriginSuspended,
  markRateLimited,
  trackHttp403,
} from './stealth.js';

beforeEach(() => rateLimitMap.clear());

describe('buildStealthHeaders', () => {
  it('includes all required stealth headers', () => {
    const h = buildStealthHeaders('https://example.com');
    expect(h['Accept']).toContain('text/html');
    expect(h['Accept-Language']).toBe('en-US,en;q=0.9');
    expect(h['Cache-Control']).toBe('no-cache');
    expect(h['Pragma']).toBe('no-cache');
    expect(h['Referer']).toBe('https://example.com/');
  });

  it('sets Referer to origin + trailing slash', () => {
    const h = buildStealthHeaders('https://target.io');
    expect(h['Referer']).toBe('https://target.io/');
  });
});

describe('isOriginSuspended', () => {
  it('returns false for unknown origin', () => {
    expect(isOriginSuspended('https://new.com')).toBe(false);
  });

  it('returns true after markRateLimited', () => {
    markRateLimited('https://target.com');
    expect(isOriginSuspended('https://target.com')).toBe(true);
  });

  it('auto-clears after suspension window expires', () => {
    rateLimitMap.set('https://old.com', {
      count403: 5,
      suspended: true,
      suspendedUntil: Date.now() - 1,
    });
    expect(isOriginSuspended('https://old.com')).toBe(false);
  });
});

describe('trackHttp403', () => {
  it('returns false for first 4 hits', () => {
    for (let i = 0; i < 4; i++) {
      expect(trackHttp403('https://x.com')).toBe(false);
    }
  });

  it('returns true and suspends on 5th hit', () => {
    for (let i = 0; i < 4; i++) trackHttp403('https://x.com');
    expect(trackHttp403('https://x.com')).toBe(true);
    expect(isOriginSuspended('https://x.com')).toBe(true);
  });

  it('tracks separate origins independently', () => {
    for (let i = 0; i < 5; i++) trackHttp403('https://a.com');
    expect(isOriginSuspended('https://a.com')).toBe(true);
    expect(isOriginSuspended('https://b.com')).toBe(false);
  });
});
```

- [ ] **Step 4: Add `lib/` to Vitest include in `workflow/vite.config.ts`**

Read the current `workflow/vite.config.ts`. Find the `test` config block. Add `'../lib/**/*.test.js'` to the `include` array:

```typescript
test: {
  include: [
    'src/**/*.{test,spec}.{ts,tsx}',
    '../lib/**/*.test.js',
  ],
  environment: 'jsdom',
  globals: true,
},
```

If there's no explicit `include`, add the block.

- [ ] **Step 5: Run tests to verify they pass**

```
cd d:\workspace\DotGit\workflow && npm test
```

Expected: all existing tests pass + new stealth tests appear in output.

- [ ] **Step 6: Commit**

```bash
git add lib/stealth.js lib/stealth.test.js workflow/vite.config.ts
git commit -m "test: extract stealth helpers to lib/stealth.js and add Vitest tests"
```

---

## Task 8 — Testing: Intelligence Backend Services

**Files:**
- Create: `d:\workspace\DotGit\intelligence-backend\services\enricher.test.js`
- Create: `d:\workspace\DotGit\intelligence-backend\services\extractor.test.js`
- Modify: `d:\workspace\DotGit\intelligence-backend\package.json`

- [ ] **Step 1: Add Vitest to `intelligence-backend`**

```bash
cd d:\workspace\DotGit\intelligence-backend && npm install --save-dev vitest
```

Add to `package.json` scripts:
```json
"test": "vitest run --reporter=verbose"
```

- [ ] **Step 2: Read `services/enricher.js` to understand its signature**

Look for the exported `enrichFinding` function and what it imports (db, AI service).

- [ ] **Step 3: Create `services/enricher.test.js`**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB before importing module under test
vi.mock('../db.js', () => ({
  getDb: () => ({
    prepare: vi.fn(() => ({
      get: vi.fn(() => null),  // no cache hit
      run: vi.fn(),
    })),
  }),
}));

vi.mock('./ai.js', () => ({
  callAI: vi.fn(async () => JSON.stringify({
    cve_id: 'CVE-2024-1234',
    cvss_score: 7.5,
    cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
    remediation: 'Disable phpinfo in production.',
    references: ['https://php.net/phpinfo'],
    ai_summary: 'PHP info page exposed.',
  })),
}));

const { enrichFinding } = await import('./enricher.js');

describe('enrichFinding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns enrichment from AI when no cache', async () => {
    const result = await enrichFinding({
      checkId: 'phpinfo',
      checkLabel: 'PHP Info',
      siteUrl: 'https://example.com',
      matchedPath: '/phpinfo.php',
      responseSnippet: '<?php phpinfo(); ?>',
    });
    expect(result).not.toBeNull();
    expect(result.cve_id).toBe('CVE-2024-1234');
    expect(result.cvss_score).toBe(7.5);
    expect(result.remediation).toContain('phpinfo');
  });

  it('returns null when AI throws', async () => {
    const { callAI } = await import('./ai.js');
    callAI.mockRejectedValueOnce(new Error('API timeout'));
    const result = await enrichFinding({
      checkId: 'env',
      checkLabel: '.env file',
      siteUrl: 'https://example.com',
      matchedPath: '/.env',
    });
    expect(result).toBeNull();
  });
});
```

**Note:** If `enricher.js` imports from a different path than `./ai.js` or `../db.js`, adjust the mock paths to match what you find when you read the file.

- [ ] **Step 4: Read `services/extractor.js` to understand its signature and imports**

Look for `extractChecksFromMessage` export and what it imports.

- [ ] **Step 5: Create `services/extractor.test.js`**

```javascript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../db.js', () => ({
  getDb: () => ({
    prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(() => null) })),
  }),
}));

vi.mock('./ai.js', () => ({
  callAI: vi.fn(async () => JSON.stringify({
    checks: [{
      id: 'dynamic_cve_2024_test',
      label: 'Test Exposure',
      category: 'debug',
      paths: ['/test-exposure.php'],
      validate_js: 'return /testExposure/.test(text);',
      severity: 'high',
      cve_id: 'CVE-2024-9999',
    }],
  })),
}));

const { extractChecksFromMessage } = await import('./extractor.js');

describe('extractChecksFromMessage', () => {
  it('extracts checks from a vulnerability message', async () => {
    const inserted = await extractChecksFromMessage(
      'CVE-2024-9999: testExposure.php exposes server config at /test-exposure.php',
      'cvenotify',
      42
    );
    expect(Array.isArray(inserted)).toBe(true);
    expect(inserted.length).toBeGreaterThan(0);
  });

  it('returns empty array when AI finds no checks', async () => {
    const { callAI } = await import('./ai.js');
    callAI.mockResolvedValueOnce(JSON.stringify({ checks: [] }));
    const result = await extractChecksFromMessage('unrelated news', 'chan', 99);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd d:\workspace\DotGit\intelligence-backend && npm test
```

Expected: all tests pass (adjust mock paths if needed based on actual file content).

- [ ] **Step 7: Commit**

```bash
git add intelligence-backend/services/enricher.test.js intelligence-backend/services/extractor.test.js intelligence-backend/package.json intelligence-backend/package-lock.json
git commit -m "test: add unit tests for enricher and extractor with mocked AI/DB"
```

---

## Task 9 — Feature: `chrome.storage.sync` for Settings

Settings are currently device-local. This adds an opt-in toggle to sync settings across browsers signed into the same account.

**Files:**
- Modify: `d:\workspace\DotGit\dotgit.js`
- Modify: `d:\workspace\DotGit\options\options.html`
- Modify: `d:\workspace\DotGit\options\options.js`

- [ ] **Step 1: Read `dotgit.js` to find `DEFAULT_OPTIONS` and how options are loaded/saved**

Find the `DEFAULT_OPTIONS` object and the `chrome.storage.local.get` / `chrome.storage.local.set` calls.

- [ ] **Step 2: Add `syncSettings` to `DEFAULT_OPTIONS` in `dotgit.js`**

```javascript
syncSettings: false,  // when true, options are also written to chrome.storage.sync
```

- [ ] **Step 3: Add `saveOptions` and `loadOptions` helpers in `dotgit.js`**

After the `DEFAULT_OPTIONS` block, add:

```javascript
async function saveOptions(opts) {
  await chrome.storage.local.set({ options: opts });
  if (opts.syncSettings) {
    // sync storage has 100KB total limit — only sync the lightweight options
    const { syncSettings, color, max_sites, notification, check_opensource,
            check_securitytxt, debug, check_failed, blacklist, stealth } = opts;
    try {
      await chrome.storage.sync.set({ options: {
        syncSettings, color, max_sites, notification, check_opensource,
        check_securitytxt, debug, check_failed, blacklist, stealth,
      }});
    } catch (e) {
      console.warn('[dotgit] sync storage write failed:', e.message);
    }
  }
}

async function loadOptions() {
  const local = await chrome.storage.local.get(['options']);
  const base = { ...DEFAULT_OPTIONS, ...(local.options || {}) };
  if (base.syncSettings) {
    try {
      const synced = await chrome.storage.sync.get(['options']);
      if (synced.options) return { ...base, ...synced.options };
    } catch {}
  }
  return base;
}
```

- [ ] **Step 4: Replace direct `chrome.storage.local.get` calls for options with `loadOptions()`**

Find the background script's startup options loading. Update it to use `await loadOptions()`.

- [ ] **Step 5: Read `options/options.html` to find the general settings section**

- [ ] **Step 6: Add sync toggle to `options.html`**

In the general options section (near color/notification controls), add:

```html
<div class="row" style="margin-bottom: 0;">
  <div class="col s12">
    <label>
      <input type="checkbox" id="sync-settings" class="filled-in" />
      <span>Sync settings across devices</span>
    </label>
    <p class="grey-text" style="font-size: 12px; margin: 0 0 8px 26px;">
      Mirrors general settings to chrome.storage.sync. Findings and intelligence keys are never synced.
    </p>
  </div>
</div>
```

- [ ] **Step 7: Wire up sync toggle in `options.js`**

Read `options.js`. Find where options are loaded from storage and controls are initialized. Add:

```javascript
const syncEl = document.getElementById('sync-settings');
if (syncEl) {
  syncEl.checked = !!options.syncSettings;
  syncEl.addEventListener('change', function() {
    options.syncSettings = this.checked;
    chrome.storage.local.set({ options });
    chrome.runtime.sendMessage({ type: 'OPTIONS_UPDATED', options });
  });
}
```

- [ ] **Step 8: Commit**

```bash
git add dotgit.js options/options.html options/options.js
git commit -m "feat: add opt-in chrome.storage.sync to mirror settings across devices"
```

---

## Task 10 — Feature: Per-Check Severity Override

Allow users to downgrade or upgrade the severity of individual checks (e.g. treat `csv_export` as `info` instead of `medium`).

**Files:**
- Modify: `d:\workspace\DotGit\dotgit.js`
- Modify: `d:\workspace\DotGit\content_script.js`
- Modify: `d:\workspace\DotGit\options\options.js`
- Modify: `d:\workspace\DotGit\options\options.html`

- [ ] **Step 1: Add `severityOverrides` to `DEFAULT_OPTIONS` in `dotgit.js`**

```javascript
severityOverrides: {},  // { [checkId]: 'critical' | 'high' | 'medium' | 'info' }
```

- [ ] **Step 2: Verify `options` is forwarded to content script in the `CHECK_SITE` message**

Read `dotgit.js` to find where `CHECK_SITE` is sent to content scripts. Confirm `options` (which now includes `severityOverrides`) is included in the message payload.

- [ ] **Step 3: Apply severity override in `content_script.js` before sending `FINDINGS_FOUND`**

Read `content_script.js`. Find where `FINDINGS_FOUND` is sent (or where the finding's `severity` field is set). Before building the finding object, add:

```javascript
const effectiveSeverity = (options?.severityOverrides?.[checkId]) || check.severity;
```

Use `effectiveSeverity` instead of `check.severity` in the finding data sent to the background.

- [ ] **Step 4: Add severity dropdowns dynamically in `options.js`**

Read `options.js` to find the loop or function that renders check toggles. After toggles are rendered, add a function:

```javascript
function initSeverityOverrides(options) {
  const overrides = options.severityOverrides || {};
  document.querySelectorAll('.function-toggle, input[data-check-id]').forEach(checkbox => {
    const checkId = checkbox.dataset.checkId || checkbox.id?.replace(/^(toggle-|fn-)/, '');
    if (!checkId || document.getElementById('sev-' + checkId)) return;

    const sel = document.createElement('select');
    sel.id = 'sev-' + checkId;
    sel.title = 'Override severity for ' + checkId;
    sel.style.cssText = 'font-size:11px;margin-left:8px;vertical-align:middle;border:1px solid #ccc;border-radius:3px;';

    for (const val of ['', 'critical', 'high', 'medium', 'info']) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val || 'default';
      if (overrides[checkId] === val) opt.selected = true;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', function () {
      const newOverrides = { ...options.severityOverrides };
      if (this.value) {
        newOverrides[checkId] = this.value;
      } else {
        delete newOverrides[checkId];
      }
      options.severityOverrides = newOverrides;
      chrome.storage.local.set({ options });
    });

    checkbox.parentElement?.appendChild(sel);
  });
}
```

Call `initSeverityOverrides(options)` after the options are loaded and check toggles are initialized.

- [ ] **Step 5: Commit**

```bash
git add dotgit.js content_script.js options/options.js
git commit -m "feat: add per-check severity override in options page"
```

---

## Task 11 — Feature: Push Notifications (Telegram / Slack)

When a critical or high-severity finding is enriched, optionally send a push notification to a configured Telegram chat or Slack webhook.

**Files:**
- Create: `d:\workspace\DotGit\intelligence-backend\services\notifier.js`
- Modify: `d:\workspace\DotGit\intelligence-backend\routes\enrich.js`
- Create or Modify: `d:\workspace\DotGit\intelligence-backend\.env.example`

- [ ] **Step 1: Create `services/notifier.js`**

```javascript
import fetch from 'node-fetch';

export async function notifyFinding({ checkId, siteUrl, severity, enrichment }) {
  const message = formatMessage(checkId, siteUrl, severity, enrichment);
  await Promise.allSettled([
    notifyTelegram(message),
    notifySlack(message),
  ]);
}

function formatMessage(checkId, siteUrl, severity, enrichment) {
  const cve = enrichment?.cve_id ? ` (${enrichment.cve_id})` : '';
  const cvss = enrichment?.cvss_score != null ? ` CVSS ${enrichment.cvss_score}` : '';
  const rem = enrichment?.remediation ? `\n${enrichment.remediation}` : '';
  return `DotGit Alert\n${severity.toUpperCase()} — ${checkId}${cve}${cvss}\nSite: ${siteUrl}${rem}`.slice(0, 4096);
}

async function notifyTelegram(message) {
  const token = process.env.NOTIFY_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.NOTIFY_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error('[notifier] Telegram error:', resp.status, body.slice(0, 200));
  }
}

async function notifySlack(message) {
  const webhookUrl = process.env.NOTIFY_SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) {
    console.error('[notifier] Slack error:', resp.status);
  }
}
```

- [ ] **Step 2: Call `notifyFinding` from `routes/enrich.js` for critical/high findings**

Read `routes/enrich.js`. After `res.json(enrichment)` (the successful enrichment response), add:

```javascript
// Fire-and-forget push notification
const notifySeverities = new Set(['critical', 'high']);
const sev = req.body.severity || '';
const cvssHigh = enrichment?.cvss_score >= 7;
if (notifySeverities.has(sev) || cvssHigh) {
  import('../services/notifier.js').then(({ notifyFinding }) => {
    notifyFinding({
      checkId: req.body.check_id || 'unknown',
      siteUrl: req.body.site_url || '',
      severity: sev || (cvssHigh ? 'high' : 'unknown'),
      enrichment,
    }).catch(err => console.error('[enrich] notify error:', err.message));
  });
}
```

- [ ] **Step 3: Create or update `.env.example`**

```
# Push notifications (both optional — set whichever you use)
# Telegram: create a bot with @BotFather, send a message to the bot, then
#   GET https://api.telegram.org/bot<TOKEN>/getUpdates to find your chat_id
NOTIFY_TELEGRAM_BOT_TOKEN=
NOTIFY_TELEGRAM_CHAT_ID=

# Slack: create an Incoming Webhook at https://api.slack.com/apps
NOTIFY_SLACK_WEBHOOK_URL=
```

- [ ] **Step 4: Add startup warning in `server.js` if neither notification channel is configured**

In `validateStartupConfig()` (added in Task 4), add:

```javascript
if (!process.env.NOTIFY_TELEGRAM_BOT_TOKEN && !process.env.NOTIFY_SLACK_WEBHOOK_URL) {
  console.info('[intel] ℹ  No push notification channels configured (NOTIFY_TELEGRAM_BOT_TOKEN / NOTIFY_SLACK_WEBHOOK_URL)');
}
```

- [ ] **Step 5: Commit**

```bash
git add intelligence-backend/services/notifier.js intelligence-backend/routes/enrich.js intelligence-backend/.env.example intelligence-backend/server.js
git commit -m "feat: push notifications to Telegram/Slack on critical/high findings"
```

---

## Verification Checklist

After all tasks:

1. **Security (validator sandbox):** Enable dynamic checks in intel backend → scan a site → confirm DevTools console has no `new Function` calls or eval errors. Test a dynamic check that should match and one that shouldn't.

2. **Rate limiting:** Use curl/Postman to hit `/api/enrich` 21 times in 1 minute → 21st response is HTTP 429.

3. **Shared paths:** Verify popup still shows correct `.git` link. Search codebase for `FINDING_LINK_MAP` — should be zero results (fully replaced).

4. **web-ext:** `npx web-ext lint --source-dir d:\workspace\DotGit` → passes without "firefoxdeveloperedition" errors.

5. **Export:** Load popup with findings → click JSON → download opens. Click CSV → download opens. Open CSV in spreadsheet — columns correct.

6. **Tests:** `cd workflow && npm test` → all pass including stealth tests. `cd intelligence-backend && npm test` → all pass.

7. **CI:** Push branch to GitHub → Actions tab shows 3 jobs running (workflow tests, intel tests, web-ext lint).

8. **Sync:** Enable sync toggle → change a setting → open second browser profile with same account → setting is reflected.

9. **Severity override:** Set `.git` to `info` in options → visit a site with `.git` exposed → popup shows `info` badge.

10. **Notifications:** Set `NOTIFY_TELEGRAM_BOT_TOKEN` + `NOTIFY_TELEGRAM_CHAT_ID` → enrich a critical finding → Telegram message received within 10s.

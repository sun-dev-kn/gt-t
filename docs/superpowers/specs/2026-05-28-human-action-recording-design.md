# Human Action Recording — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add human action recording to the DotGit workflow designer — users click Record, interact with a real browser tab, and their actions auto-populate as workflow nodes they can edit and replay. Also expands the node library from 19 to 46 node types covering the full vocabulary of web automation.

**Architecture:** Three browser contexts connected by two persistent `browser.runtime.connect` ports: a content script (`recorder.js`) captures events in the recorded tab → background buffers and relays → designer tab displays a live log sidebar. On Stop, a filter checklist lets users remove noise before importing as a connected node chain.

**Tech Stack:** TypeScript, React 18, Zustand 5, @xyflow/react v12, WebExtension MV3 (Firefox), Vite 6

---

## Scope

This spec covers two tightly coupled deliverables:

1. **Extended Node Library** — 27 new node subtypes (browser interactions, wait, data/read, human-in-the-loop, control flow, variables, page/tab)
2. **Human Action Recording** — the recorder content script, background relay, designer UI (toolbar + panel), and event→node conversion

---

## New Node Types (22 additions, 19 existing → 41 total)

### Browser Actions (9 new)

| Subtype | Fields | Handles | ui.vision command |
|---------|--------|---------|-------------------|
| `doubleClick` | `selector: string` | in:flow, out-success:flow, out-error:error | `doubleClick` |
| `rightClick` | `selector: string` | in:flow, out-success:flow, out-error:error | `rightClickAt` |
| `selectOption` | `selector: string`, `value: string` | in:flow, out-success:flow, out-error:error | `select` |
| `check` | `selector: string`, `checked: boolean` | in:flow, out-success:flow, out-error:error | `check` / `uncheck` |
| `pressKey` | `key: string` (e.g. `"Enter"`, `"Tab"`, `"Control+a"`) | in:flow, out:flow | `sendKeys` |
| `dragDrop` | `sourceSelector: string`, `targetSelector: string` | in:flow, out-success:flow, out-error:error | `dragAndDropToObject` |
| `uploadFile` | `selector: string`, `fileName: string` | in:flow, out-success:flow, out-error:error | `type` (ui.vision file upload) |
| `paste` | `selector: string`, `text: string` | in:flow, out:flow | `type` |

### Wait (2 new)

| Subtype | Fields | Handles | ui.vision command |
|---------|--------|---------|-------------------|
| `waitForUrl` | `pattern: string`, `timeoutMs: number` | in:flow, out:flow | `waitForCondition` |
| `waitForVisible` | `selector: string`, `visible: boolean`, `timeoutMs: number` | in:flow, out:flow | `waitForElementVisible` / `waitForElementNotPresent` |

### Data / Read (4 new)

| Subtype | Fields | Handles | ui.vision command |
|---------|--------|---------|-------------------|
| `getCurrentUrl` | `varName: string` | in:flow, out:data | `storeLocation` |
| `getValue` | `selector: string`, `varName: string` | in:flow, out:data | `storeValue` |
| `screenshot` | `varName: string` | in:flow, out:data | `captureScreenshot` |
| `countElements` | `selector: string`, `varName: string` | in:flow, out:data | `storeXpathCount` |

### Human-in-the-Loop (1 new)

| Subtype | Fields | Handles | ui.vision command |
|---------|--------|---------|-------------------|
| `notifyUser` | `title: string`, `message: string`, `waitForDismiss: boolean` | in:flow, out:flow | `comment` (+ runtime notification) |

`notifyUser` fires a native browser notification (`browser.notifications.create`) with a configurable title and message. When `waitForDismiss: true`, workflow execution pauses until the user clicks the notification or clicks a "Continue" button in the designer — use case: CAPTCHA encountered, 2FA code needed, manual approval required. When `waitForDismiss: false`, the notification fires and execution continues immediately.

### Control Flow (2 new)

| Subtype | Fields | Handles | ui.vision command |
|---------|--------|---------|-------------------|
| `forEach` | `listVar: string`, `itemVar: string` | in:flow, out-loop:flow, out-done:flow | `forEach` |
| `tryCatch` | _(none)_ | in:flow, out-try:flow, out-catch:flow | _(comment pair)_ |

### Variables / Data Structures (3 new)

| Subtype | Fields | Handles | ui.vision command |
|---------|--------|---------|-------------------|
| `setVariable` | `varName: string`, `value: string` (supports `${varName}` interpolation) | in:flow, out:flow | `store` |
| `setArray` | `varName: string`, `items: string[]` (one per line in inspector) | in:flow, out:data | `store` (JSON-serialised) |
| `setObject` | `varName: string`, `pairs: Array<{key:string, value:string}>` | in:flow, out:data | `store` (JSON-serialised) |

These nodes let workflows define constants and structured data at any point in the graph. `setVariable` values support `${varName}` interpolation so they can reference earlier-extracted values. Array/object vars are stored as JSON strings in the variable space and can be consumed by `forEach` or `condition` nodes.

### Page / Tab (7 new)

| Subtype | Fields | Handles | ui.vision command |
|---------|--------|---------|-------------------|
| `goBack` | _(none)_ | in:flow, out:flow | `goBack` |
| `goForward` | _(none)_ | in:flow, out:flow | `goForward` |
| `reload` | _(none)_ | in:flow, out:flow | `refresh` |
| `openTab` | `url: string` | in:flow, out:flow | `open` |
| `closeTab` | _(none)_ | in:flow, out:flow | `closeWindow` |
| `switchTab` | `urlPattern: string` | in:flow, out:flow | `selectWindow` |
| `runScript` | `script: string`, `varName?: string` | in:flow, out:data | `executeScript` |

---

## Architecture

### Three-Context Port Model

```
Recorded Tab (recorder.js)          Background (background.js)        Designer Tab (App.tsx)
──────────────────────────          ──────────────────────────        ──────────────────────
DOM event listeners         ──port "recorder"──►  buffer events[]   ──port "designer-relay"──►  RecordingPanel
smart selector generator                           recordingTabId                                live log sidebar
webNavigation listener                             designerTabId                                 filter + import UI
```

- Content script connects to background via `browser.runtime.connect({ name: 'recorder' })` on recording start.
- Background connects to designer via `browser.tabs.connect(designerTabId, { name: 'designer-relay' })`.
- Every `RecordedEvent` is forwarded immediately to the designer for the live log.
- Background also accumulates a full `events[]` buffer — sent as a bulk payload on Stop for the filter dialog.
- If the port drops mid-session (tab closed, extension reloaded), background sets `recordingState = 'error'` and notifies the designer to show a recovery banner.

### RecordedEvent Type

```typescript
type RecordedEvent = {
  type: 'navigate' | 'click' | 'dblclick' | 'rightClick' | 'fill' | 'selectOption' |
        'check' | 'scroll' | 'hover' | 'pressKey' | 'dragDrop' | 'uploadFile' | 'paste' |
        'goBack' | 'goForward' | 'reload';
  selector: string;
  selectorStrategy: 'id' | 'aria' | 'name' | 'css' | 'xpath';
  value?: string;
  checked?: boolean;
  key?: string;
  targetSelector?: string;       // dragDrop only
  position?: { x: number; y: number };
  timestamp: number;
  url: string;                   // page URL at capture time
  frameId: number;
};
```

### Selector Generation Priority

When capturing an interaction, the recorder generates the most stable selector available:

1. `#id` — only if id looks non-generated (no UUID pattern, not purely numeric)
2. `[data-testid]`, `[data-cy]`, `[data-qa]` — explicit test attributes
3. `[aria-label]`, `[name]` — semantic attributes
4. Shortest unique CSS path — up to 3 ancestor hops (e.g. `form.login > input[type=password]`)
5. XPath — absolute fallback (`//*[contains(@class,"submit-btn")]`)

`selectorStrategy` is stored on the event. The Inspector shows a warning badge on nodes that used strategy `'xpath'` since these are most likely to break on page changes.

### Debouncing Rules

- **fill / input:** 800ms debounce after last keystroke — only the final `input.value` is captured as one event. Regular printable keystrokes are NOT captured as `pressKey`; only special keys (Enter, Tab, Escape, F1–F12, arrow keys, Ctrl/Cmd combinations) are.
- **scroll:** 300ms debounce, accumulated into a single `{ direction: 'down'|'up', amount: number }` per burst.
- **hover:** Only captured when the user pauses on an element for >500ms (prevents noise from transient mouseovers).

---

## Recording UX

### Toolbar — Three States

**Idle:**
- Red "⏺ Record" button in the toolbar.
- Clicking it: if `workflowDomain` is set, opens `https://{workflowDomain}` in a new tab and starts recording. If domain is empty, shows a small inline prompt to enter a URL before proceeding.

**Recording:**
- Toolbar border turns red, shows pulsing dot + "RECORDING — {domain} — N actions" label.
- "■ Stop" button replaces the Record button. All other toolbar actions (Undo, Redo, Save) remain available but are visually muted.
- A `RecordingPanel` slides in from the right edge of the canvas. It shows the live event log.

**Review & Import (after Stop):**
- The recorded tab is closed.
- `RecordingPanel` switches to a checklist — all captured events listed with checkboxes. Default: all checked.
- User unchecks noise (accidental clicks, exploratory navigation).
- "Import N nodes to canvas" button runs `eventsToNodes()` and dispatches to the Zustand store.
- "Discard" clears the session.

### RecordingPanel Component

Located at the right side of the canvas (200px wide), only visible during/after recording:

```
┌─ CAPTURED ACTIONS ───── 4 ─┐
│ → navigate   github.com    │
│ ↙ click      .sign-in-btn  │
│ T  fill      #username     │  ← live items append here
│ T  fill      #password  ✎  │  ← ✎ = xpath selector (warning)
└────────────────────────────┘
```

Each entry shows: action type icon, node type label, truncated selector. Items with `selectorStrategy === 'xpath'` show a ⚠ icon.

### eventsToNodes()

`eventsToNodes(events: RecordedEvent[]): { nodes: WorkflowNode[], edges: WorkflowEdge[] }`

- One `WorkflowNode` per event, placed in a horizontal chain (x += 220 per step, y = 300).
- Each node gets a `crypto.randomUUID()` id.
- Edges auto-wired: `out` / `out-success` → `in` of next node (using `HANDLE_TYPES` to pick the correct source handle).
- Navigation events that change origin (new domain) insert an auto `navigate` node before the next action.

---

## Background Script Changes

New message handlers in `background.js`:

```
RECORDING_START  { designerTabId, domain }
  → opens new tab at https://{domain}
  → stores recordingTabId, designerTabId
  → on tab load: injects recorder.js (or it auto-connects if always-on content script)
  → connects designer-relay port to designerTabId

RECORDING_STOP   { }
  → sends { type: 'RECORDING_COMPLETE', events: buffer[] } to designer port
  → clears buffer, recordingTabId
  → closes recorded tab
```

Port lifecycle: if `port.onDisconnect` fires (tab closed unexpectedly), background sends `{ type: 'RECORDING_ERROR', reason: 'tab_closed' }` to designer.

---

## Store Changes

New fields and actions added to `useWorkflowStore`:

```typescript
// State
recordingState: 'idle' | 'recording' | 'reviewing' | 'error';
capturedEvents: RecordedEvent[];

// Actions
startRecording(): Promise<void>;   // sends RECORDING_START to background
stopRecording(): void;             // sends RECORDING_STOP to background
importRecording(selected: RecordedEvent[]): void;  // eventsToNodes → addNode batch
discardRecording(): void;          // clears capturedEvents, resets state
appendEvent(event: RecordedEvent): void;           // called by port listener
```

---

## Files to Create / Modify

| File | Action | Description |
|------|--------|-------------|
| `workflow/src/types.ts` | Modify | Add 22 new subtypes to `NodeData`, extend `HANDLE_TYPES` |
| `workflow/src/nodes/index.ts` | Modify | Register new node components |
| `workflow/src/nodes/BrowserNode.tsx` | Modify | Render 8 new browser subtypes |
| `workflow/src/nodes/WaitNode.tsx` | Modify | Render `waitForUrl`, `waitForVisible` |
| `workflow/src/nodes/DataNode.tsx` | Modify | Render `getCurrentUrl`, `getValue`, `screenshot`, `countElements` |
| `workflow/src/nodes/ControlNode.tsx` | Modify | Render `forEach`, `tryCatch` |
| `workflow/src/nodes/VariableNode.tsx` | **Create** | New component for `setVariable`, `setArray`, `setObject` |
| `workflow/src/nodes/PageNode.tsx` | **Create** | New component for all 7 page/tab subtypes |
| `workflow/src/nodes/HumanNode.tsx` | **Create** | New component for `notifyUser` |
| `workflow/src/components/Inspector.tsx` | Modify | Add inspector fields for all 22 new subtypes |
| `workflow/src/components/NodeLibrary.tsx` | Modify | Add new nodes to sidebar palette + new PAGE category |
| `workflow/src/components/Toolbar.tsx` | Modify | Record/Stop button, recording state visual |
| `workflow/src/components/RecordingPanel.tsx` | **Create** | Live log sidebar + filter/import dialog |
| `workflow/src/store.ts` | Modify | Recording state, capturedEvents, recording actions |
| `recorder.js` (extension root, alongside `content_script.js`) | **Create** | Content script: event listeners, selector generator, port connect. Plain JS/TS compiled separately from the workflow Vite bundle — listed in `manifest.json` as a content script matching `<all_urls>`. |
| `workflow/src/recording/eventsToNodes.ts` | **Create** | `RecordedEvent[]` → `{ nodes, edges }` |
| `workflow/src/export/toUiVision.ts` | Modify | Extend `nodeToCommand` for all 22 new subtypes |
| `background.js` | Modify | Port management, RECORDING_START/STOP handlers, tab lifecycle |
| `manifest.json` | Modify | Add `recorder.js` as content script (`matches: ["<all_urls>"]`); add `notifications` permission for `notifyUser` node |

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `workflowDomain` empty when Record clicked | Inline URL prompt appears in toolbar; recording starts after URL entered |
| Recorded tab closed by user mid-session | Background sends `RECORDING_ERROR`; designer shows banner "Recording ended — tab was closed. Import what was captured?" |
| Designer port disconnects (page refresh) | Background clears buffer, sets `recordingState = 'idle'` |
| Selector generation fails (no stable selector) | Falls back to XPath with ⚠ badge in panel and Inspector |
| Zero actions captured on Stop | Import button disabled; "Nothing was captured" shown |
| Extension reloaded mid-session | Content script port disconnects; same recovery as tab-closed |

---

## Testing

- Unit tests for `eventsToNodes()` covering each of the 15 recordable event types → correct node subtype
- Unit tests for selector generator: id, aria, name, css, xpath priority cascade
- Unit tests for scroll/fill debounce logic
- Unit test for `toUiVision` covering all 22 new node subtypes
- Component test for `RecordingPanel`: log append, checkbox filter, import/discard
- Component test for `Toolbar`: Record button shows, Stop button shows during recording, disabled state
- Integration test for store recording actions: startRecording → appendEvent × N → stopRecording → importRecording → nodes present
- Unit test for `notifyUser` node: `waitForDismiss: true` pauses execution, `false` continues immediately
- Unit test for `setVariable` interpolation: `${varName}` resolved at runtime
- Unit test for `setArray` / `setObject` → JSON serialisation round-trip

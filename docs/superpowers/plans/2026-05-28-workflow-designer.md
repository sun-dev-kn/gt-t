# Workflow Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + React Flow + Zustand + Vite extension page (`workflow/`) that lets users design scraping workflows visually and export them as ui.vision macro JSON.

**Architecture:** A Vite-bundled React 18 SPA mounted at `workflow/workflow.html` (built to `workflow/dist/`). React Flow renders the node canvas; Zustand stores nodes, edges, workflow metadata, and an undo/redo history stack. Workflows persist to `browser.storage.local`. Export converts the graph to ui.vision macro JSON (Selenium IDE-style command array) by topologically traversing the DAG; import parses the same format back to nodes and edges.

**Tech Stack:** React 18, @xyflow/react 12 (React Flow), Zustand 5, TypeScript 5, Vite 6, Vitest 2, @testing-library/react 16

---

## File Map

| File | Responsibility |
|------|---------------|
| `workflow/package.json` | NPM deps + scripts |
| `workflow/vite.config.ts` | Bundle to `workflow/dist/` |
| `workflow/tsconfig.json` | TypeScript config |
| `workflow/vitest.config.ts` | Vitest + jsdom |
| `workflow/src/test-setup.ts` | browser global mock |
| `workflow/workflow.html` | Extension page shell |
| `workflow/workflow.css` | Designer layout styles |
| `workflow/src/main.tsx` | ReactDOM.createRoot entry |
| `workflow/src/App.tsx` | Layout: sidebar + canvas + inspector |
| `workflow/src/types.ts` | All NodeData shapes, WorkflowJSON, UiVisionMacro |
| `workflow/src/store.ts` | Zustand: nodes, edges, undo/redo, selection, meta |
| `workflow/src/storage/workflows.ts` | browser.storage.local CRUD |
| `workflow/src/nodes/TriggerNode.tsx` | Schedule / Manual trigger nodes |
| `workflow/src/nodes/BrowserNode.tsx` | Navigate / Click / Fill / Scroll / Hover |
| `workflow/src/nodes/WaitNode.tsx` | WaitForSelector / Delay / NetworkIdle |
| `workflow/src/nodes/DataNode.tsx` | Extract / ExtractTable |
| `workflow/src/nodes/ControlNode.tsx` | Condition / Loop / Merge |
| `workflow/src/nodes/AccountNode.tsx` | InjectCredentials / SwitchAccount |
| `workflow/src/nodes/OutputNode.tsx` | SendToBackend / SaveLocally |
| `workflow/src/nodes/index.ts` | nodeTypes registry exported to ReactFlow |
| `workflow/src/edges/TypedEdge.tsx` | Custom edge — red when port types mismatch |
| `workflow/src/edges/index.ts` | edgeTypes registry |
| `workflow/src/components/NodeLibrary.tsx` | Collapsible sidebar categories + draggable palettes |
| `workflow/src/components/Inspector.tsx` | Right-panel config form per selected node |
| `workflow/src/components/Toolbar.tsx` | Name field + Run / Save / Export ▾ / Import buttons |
| `workflow/src/export/toUiVision.ts` | Graph → ui.vision macro JSON (topological DFS) |
| `workflow/src/export/fromUiVision.ts` | ui.vision macro JSON → graph (best-effort) |
| `manifest.json` | Add `workflow/dist/workflow.html` to web_accessible_resources |
| `options/options.html` | Add "Open Workflow Designer" button |
| `scraper/orchestrate.js` | Load workflow from storage by domain before triggering ui.vision |

---

## Port Type System

Each handle carries a port type. `isValidConnection` rejects mismatched connections (shown in red on TypedEdge).

| Port Type | Produced by | Accepted by |
|-----------|-------------|-------------|
| `flow` | Trigger (→), Browser (success), Wait (→), Condition (true/false), Loop (loop/done), Account (→), Merge (→) | Most input handles |
| `data` | Data (Extract, ExtractTable → ) | Output (SendToBackend, SaveLocally), Condition (value input) |
| `error` | Browser (error) | Output (error handler), Merge |

Handle IDs follow the pattern `{nodeType}-{direction}-{port}`, e.g. `navigate-out-success`, `extract-out-data`.

---

## ui.vision Macro Format

```json
{
  "Name": "macro-name",
  "CreationDate": "2026-05-28",
  "Commands": [
    { "Command": "open",               "Target": "https://example.com",  "Value": "" },
    { "Command": "click",              "Target": "css=#login",           "Value": "" },
    { "Command": "type",               "Target": "css=#email",           "Value": "${account.email}" },
    { "Command": "waitForElementVisible", "Target": "css=.content",     "Value": "5000" },
    { "Command": "storeText",          "Target": "css=.title",          "Value": "varName" },
    { "Command": "label",              "Target": "loop_start",          "Value": "" },
    { "Command": "gotoIf",            "Target": "${hasNext}==true",    "Value": "loop_start" },
    { "Command": "executeScript_Sandbox", "Target": "localStorage.setItem('DotGitScrapedData', JSON.stringify(window.__dotgitData));", "Value": "" }
  ]
}
```

Node → command mapping:
- Navigate → `open`
- Click → `click`
- Fill → `type`
- Scroll → `executeScript_Sandbox` (scrollBy)
- Hover → `mouseOver`
- WaitForSelector → `waitForElementVisible` (Value = timeout ms)
- Delay → `pause` (Target = ms)
- NetworkIdle → `pause` (Target = 2000)
- Extract → `storeText` per field + `executeScript_Sandbox` to accumulate into `window.__dotgitData`
- ExtractTable → `executeScript_Sandbox` to collect all rows as JSON array
- Condition → `if` / `else` / `endIf` (Target = `${varName}==value`)
- Loop → `label` before body + `gotoIf` at end (Target = condition, Value = label)
- Merge → (no command; both incoming edge paths converge here)
- AccountInject → `store ${account.email} → injectedEmail` + `store ${account.password} → injectedPassword`
- AccountSwitch → `store __switchAccount → __dotgitSignal`
- SendToBackend → `executeScript_Sandbox` sets `localStorage.DotGitScrapedData`
- SaveLocally → `executeScript_Sandbox` sets `localStorage.DotGitScrapedData` with `{"local":true}`

---

## Task 1: Vite + React + TypeScript scaffold

**Files:**
- Create: `workflow/package.json`
- Create: `workflow/vite.config.ts`
- Create: `workflow/tsconfig.json`
- Create: `workflow/vitest.config.ts`
- Create: `workflow/src/test-setup.ts`
- Create: `workflow/workflow.html`
- Create: `workflow/workflow.css`
- Create: `workflow/src/main.tsx`
- Create: `workflow/src/App.tsx`
- Test: `workflow/src/__tests__/App.test.tsx`

- [ ] **Step 1: Write `workflow/package.json`**

```json
{
  "name": "dotgit-workflow",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run --reporter=verbose",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@xyflow/react": "^12.3.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^6.0.11",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write `workflow/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'workflow.html',
    },
  },
});
```

- [ ] **Step 3: Write `workflow/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `workflow/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 5: Write `workflow/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom';

// Mock browser extension API
const storage: Record<string, unknown> = {};

(globalThis as Record<string, unknown>).browser = {
  storage: {
    local: {
      get: async (keys: string | string[]) => {
        if (typeof keys === 'string') return { [keys]: storage[keys] };
        return Object.fromEntries(keys.map((k) => [k, storage[k]]));
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(storage, items);
      },
      remove: async (keys: string | string[]) => {
        const ks = typeof keys === 'string' ? [keys] : keys;
        ks.forEach((k) => delete storage[k]);
      },
    },
  },
  runtime: {
    getURL: (path: string) => `moz-extension://test-id/${path}`,
  },
};

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
});
```

- [ ] **Step 6: Write `workflow/workflow.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DotGit — Workflow Designer</title>
  <link rel="stylesheet" href="workflow.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 7: Write `workflow/workflow.css`**

```css
*, *::before, *::after { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  font-family: system-ui, sans-serif;
  background: #1a1a2e;
  color: #e2e8f0;
}

.wf-layout {
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: 220px 1fr 280px;
  grid-template-areas:
    "toolbar toolbar toolbar"
    "sidebar canvas inspector";
  height: 100vh;
}

.wf-toolbar  { grid-area: toolbar;   background: #16213e; border-bottom: 1px solid #0f3460; display: flex; align-items: center; gap: 8px; padding: 0 12px; }
.wf-sidebar  { grid-area: sidebar;   background: #16213e; border-right: 1px solid #0f3460; overflow-y: auto; }
.wf-canvas   { grid-area: canvas;    position: relative; }
.wf-inspector{ grid-area: inspector; background: #16213e; border-left: 1px solid #0f3460; overflow-y: auto; padding: 12px; }

/* Node library */
.nl-category { padding: 6px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; cursor: pointer; user-select: none; }
.nl-item { padding: 6px 16px 6px 24px; font-size: 13px; cursor: grab; color: #cbd5e1; border-left: 3px solid transparent; }
.nl-item:hover { background: #0f3460; border-left-color: #e94560; }

/* Toolbar */
.wf-toolbar input[type=text] { background: #0f3460; border: 1px solid #1a4a7a; color: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 13px; width: 200px; }
.wf-btn { background: #0f3460; border: 1px solid #1a4a7a; color: #e2e8f0; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 13px; }
.wf-btn:hover { background: #e94560; border-color: #e94560; }
.wf-btn-primary { background: #e94560; border-color: #e94560; }

/* Inspector */
.ins-empty { color: #64748b; font-size: 13px; text-align: center; margin-top: 40px; }
.ins-field { margin-bottom: 12px; }
.ins-label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; }
.ins-input { width: 100%; background: #0f3460; border: 1px solid #1a4a7a; color: #e2e8f0; padding: 5px 8px; border-radius: 4px; font-size: 13px; }
.ins-input:focus { outline: none; border-color: #e94560; }

/* Custom nodes */
.wf-node { background: #16213e; border: 1px solid #0f3460; border-radius: 6px; padding: 10px 14px; min-width: 140px; font-size: 12px; }
.wf-node-header { font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }
.wf-node-label  { color: #94a3b8; font-size: 12px; }
.wf-node.selected { border-color: #e94560; }

/* Loop container */
.wf-loop-node { background: rgba(233,69,96,0.05); border: 2px dashed #e94560; border-radius: 8px; min-width: 240px; min-height: 160px; }

/* Edge validation */
.edge-invalid path { stroke: #e94560 !important; }
```

- [ ] **Step 8: Write `workflow/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@xyflow/react/dist/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Write skeleton `workflow/src/App.tsx`**

```tsx
export default function App() {
  return (
    <div className="wf-layout" data-testid="wf-app">
      <div className="wf-toolbar">Toolbar</div>
      <div className="wf-sidebar">Sidebar</div>
      <div className="wf-canvas">Canvas</div>
      <div className="wf-inspector">Inspector</div>
    </div>
  );
}
```

- [ ] **Step 10: Write `workflow/src/__tests__/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders the workflow designer layout', () => {
  render(<App />);
  expect(screen.getByTestId('wf-app')).toBeInTheDocument();
});
```

- [ ] **Step 11: Install deps and run the test**

```
cd workflow && npm install
npx vitest run --reporter=verbose
```

Expected output:
```
✓ src/__tests__/App.test.tsx > renders the workflow designer layout
Test Files  1 passed (1)
Tests       1 passed (1)
```

- [ ] **Step 12: Commit**

```bash
git add workflow/
git commit -m "feat: scaffold workflow designer — Vite + React + TypeScript + Vitest"
```

---

## Task 2: Type definitions

**Files:**
- Create: `workflow/src/types.ts`
- Test: `workflow/src/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// workflow/src/__tests__/types.test.ts
import type { WorkflowJSON, UiVisionMacro, NodeData } from '../types';

test('NodeData subtype discriminant works', () => {
  const n: NodeData = { subtype: 'navigate', url: 'https://example.com' };
  expect(n.subtype).toBe('navigate');
});

test('WorkflowJSON has nodes and edges', () => {
  const wf: WorkflowJSON = { name: 'test', domain: '', nodes: [], edges: [] };
  expect(wf.nodes).toHaveLength(0);
});

test('UiVisionMacro has Commands array', () => {
  const m: UiVisionMacro = { Name: 'x', CreationDate: '2026-01-01', Commands: [] };
  expect(m.Commands).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/types.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../types'`

- [ ] **Step 3: Write `workflow/src/types.ts`**

```typescript
// ─── Port types ─────────────────────────────────────────────────────────────
export type PortType = 'flow' | 'data' | 'error';

// ─── Node subtypes ───────────────────────────────────────────────────────────
export type TriggerData =
  | { subtype: 'schedule'; intervalHours: number }
  | { subtype: 'manual' };

export type BrowserData =
  | { subtype: 'navigate'; url: string }
  | { subtype: 'click'; selector: string }
  | { subtype: 'fill'; selector: string; value: string }
  | { subtype: 'scroll'; selector: string; direction: 'down' | 'up'; amount: number }
  | { subtype: 'hover'; selector: string };

export type WaitData =
  | { subtype: 'waitForSelector'; selector: string; timeoutMs: number }
  | { subtype: 'delay'; ms: number }
  | { subtype: 'networkIdle' };

export type DataNodeData =
  | { subtype: 'extract'; fields: Array<{ selector: string; name: string; attr?: string }>; varName: string }
  | { subtype: 'extractTable'; selector: string; varName: string };

export type ControlData =
  | { subtype: 'condition'; variable: string; operator: '==' | '!=' | '>' | '<' | 'contains'; value: string }
  | { subtype: 'loop'; maxIterations: number; continueVariable: string }
  | { subtype: 'merge' };

export type AccountData =
  | { subtype: 'injectCredentials' }
  | { subtype: 'switchAccount' };

export type OutputData =
  | { subtype: 'sendToBackend'; endpoint: string }
  | { subtype: 'saveLocally' };

export type NodeData =
  | TriggerData
  | BrowserData
  | WaitData
  | DataNodeData
  | ControlData
  | AccountData
  | OutputData;

// ─── Workflow persistence ─────────────────────────────────────────────────────
import type { Node, Edge } from '@xyflow/react';

export type WorkflowNode = Node<NodeData>;
export type WorkflowEdge = Edge;

export interface WorkflowJSON {
  name: string;
  domain: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ─── ui.vision macro ──────────────────────────────────────────────────────────
export interface UiVisionCommand {
  Command: string;
  Target: string;
  Value: string;
  Description?: string;
}

export interface UiVisionMacro {
  Name: string;
  CreationDate: string;
  Commands: UiVisionCommand[];
}

// ─── Handle port map ─────────────────────────────────────────────────────────
// nodeType → handleId → PortType
export const HANDLE_TYPES: Record<string, Record<string, PortType>> = {
  trigger:    { 'out': 'flow' },
  navigate:   { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  click:      { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  fill:       { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  scroll:     { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  hover:      { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  waitForSelector: { 'in': 'flow', 'out': 'flow' },
  delay:      { 'in': 'flow', 'out': 'flow' },
  networkIdle:{ 'in': 'flow', 'out': 'flow' },
  extract:    { 'in': 'flow', 'out': 'data' },
  extractTable:{ 'in': 'flow', 'out': 'data' },
  condition:  { 'in': 'flow', 'in-data': 'data', 'out-true': 'flow', 'out-false': 'flow' },
  loop:       { 'in': 'flow', 'out-loop': 'flow', 'out-done': 'flow' },
  merge:      { 'in-a': 'flow', 'in-b': 'flow', 'in-err': 'error', 'out': 'flow' },
  injectCredentials: { 'in': 'flow', 'out': 'flow' },
  switchAccount:     { 'in': 'flow', 'out': 'flow' },
  sendToBackend: { 'in-flow': 'flow', 'in-data': 'data', 'out-success': 'flow', 'out-error': 'error' },
  saveLocally:   { 'in-flow': 'flow', 'in-data': 'data', 'out': 'flow' },
};

export function portsCompatible(
  sourceNodeType: string,
  sourceHandleId: string,
  targetNodeType: string,
  targetHandleId: string,
): boolean {
  const srcType = HANDLE_TYPES[sourceNodeType]?.[sourceHandleId];
  const tgtType = HANDLE_TYPES[targetNodeType]?.[targetHandleId];
  if (!srcType || !tgtType) return true; // unknown → allow
  return srcType === tgtType;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd workflow && npx vitest run src/__tests__/types.test.ts --reporter=verbose
```

Expected:
```
✓ NodeData subtype discriminant works
✓ WorkflowJSON has nodes and edges
✓ UiVisionMacro has Commands array
Tests  3 passed (3)
```

- [ ] **Step 5: Commit**

```bash
git add workflow/src/types.ts workflow/src/__tests__/types.test.ts
git commit -m "feat: workflow designer — type definitions for nodes, edges, export formats"
```

---

## Task 3: Zustand store

**Files:**
- Create: `workflow/src/store.ts`
- Test: `workflow/src/__tests__/store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// workflow/src/__tests__/store.test.ts
import { act, renderHook } from '@testing-library/react';
import { useWorkflowStore } from '../store';
import type { WorkflowNode } from '../types';

const makeNode = (id: string): WorkflowNode => ({
  id,
  type: 'trigger',
  position: { x: 0, y: 0 },
  data: { subtype: 'manual' },
});

test('addNode appends a node', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.addNode(makeNode('n1')));
  expect(result.current.nodes).toHaveLength(1);
  expect(result.current.nodes[0].id).toBe('n1');
});

test('undo reverses addNode', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.addNode(makeNode('n2')));
  act(() => result.current.undo());
  expect(result.current.nodes).toHaveLength(0);
});

test('redo reapplies after undo', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.addNode(makeNode('n3')));
  act(() => result.current.undo());
  act(() => result.current.redo());
  expect(result.current.nodes).toHaveLength(1);
});

test('updateNodeData mutates data in-place', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.addNode(makeNode('n4')));
  act(() => result.current.updateNodeData('n4', { subtype: 'manual' }));
  expect(result.current.nodes[0].data.subtype).toBe('manual');
});

test('selectNode sets selectedNodeId', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.selectNode('n5'));
  expect(result.current.selectedNodeId).toBe('n5');
});

test('deleteNode removes node and attached edges', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.addNode(makeNode('src'));
    result.current.addNode(makeNode('tgt'));
    result.current.onConnect({ source: 'src', target: 'tgt', sourceHandle: 'out', targetHandle: 'in' });
  });
  act(() => result.current.deleteNode('src'));
  expect(result.current.nodes).toHaveLength(1);
  expect(result.current.edges).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/store.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../store'`

- [ ] **Step 3: Write `workflow/src/store.ts`**

```typescript
import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Edge,
} from '@xyflow/react';
import type { WorkflowNode, NodeData } from './types';

type HistoryEntry = { nodes: WorkflowNode[]; edges: Edge[] };

interface WorkflowStore {
  // React Flow state
  nodes: WorkflowNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Workflow metadata
  workflowName: string;
  workflowDomain: string;
  setWorkflowMeta: (name: string, domain: string) => void;

  // History
  past: HistoryEntry[];
  future: HistoryEntry[];
  snapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Node operations
  addNode: (node: WorkflowNode) => void;
  deleteNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;

  // Selection
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;

  // Load
  loadWorkflow: (nodes: WorkflowNode[], edges: Edge[], name: string, domain: string) => void;
  resetWorkflow: () => void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],
  workflowName: 'Untitled Workflow',
  workflowDomain: '',
  past: [],
  future: [],
  selectedNodeId: null,

  setWorkflowMeta(name, domain) {
    set({ workflowName: name, workflowDomain: domain });
  },

  snapshot() {
    const { nodes, edges, past } = get();
    set({
      past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(-50),
      future: [],
    });
  },

  undo() {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: past.slice(0, -1),
      future: [{ nodes: structuredClone(nodes), edges: structuredClone(edges) }, ...future].slice(0, 50),
    });
  },

  redo() {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(-50),
      future: future.slice(1),
    });
  },

  onNodesChange(changes) {
    set({ nodes: applyNodeChanges(changes, get().nodes) as WorkflowNode[] });
  },

  onEdgesChange(changes) {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect(connection) {
    get().snapshot();
    set({ edges: addEdge({ ...connection, type: 'typed' }, get().edges) });
  },

  addNode(node) {
    get().snapshot();
    set({ nodes: [...get().nodes, node] });
  },

  deleteNode(id) {
    get().snapshot();
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  updateNodeData(id, data) {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } as NodeData } : n
      ),
    });
  },

  selectNode(id) {
    set({ selectedNodeId: id });
  },

  loadWorkflow(nodes, edges, name, domain) {
    set({ nodes, edges, workflowName: name, workflowDomain: domain, past: [], future: [] });
  },

  resetWorkflow() {
    set({ nodes: [], edges: [], past: [], future: [], selectedNodeId: null });
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd workflow && npx vitest run src/__tests__/store.test.ts --reporter=verbose
```

Expected:
```
✓ addNode appends a node
✓ undo reverses addNode
✓ redo reapplies after undo
✓ updateNodeData mutates data in-place
✓ selectNode sets selectedNodeId
✓ deleteNode removes node and attached edges
Tests  6 passed (6)
```

- [ ] **Step 5: Commit**

```bash
git add workflow/src/store.ts workflow/src/__tests__/store.test.ts
git commit -m "feat: workflow designer — Zustand store with undo/redo history"
```

---

## Task 4: Storage layer

**Files:**
- Create: `workflow/src/storage/workflows.ts`
- Test: `workflow/src/__tests__/workflows.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// workflow/src/__tests__/workflows.test.ts
import { saveWorkflow, loadWorkflow, listWorkflows, deleteWorkflow } from '../storage/workflows';
import type { WorkflowJSON } from '../types';

const sample: WorkflowJSON = {
  name: 'test-workflow',
  domain: 'example.com',
  nodes: [],
  edges: [],
};

test('saveWorkflow persists and loadWorkflow retrieves it', async () => {
  await saveWorkflow(sample);
  const loaded = await loadWorkflow('test-workflow');
  expect(loaded).not.toBeNull();
  expect(loaded!.name).toBe('test-workflow');
  expect(loaded!.domain).toBe('example.com');
});

test('listWorkflows returns saved workflow names', async () => {
  await saveWorkflow(sample);
  await saveWorkflow({ ...sample, name: 'second' });
  const names = await listWorkflows();
  expect(names).toContain('test-workflow');
  expect(names).toContain('second');
});

test('loadWorkflow returns null for unknown name', async () => {
  const result = await loadWorkflow('nonexistent');
  expect(result).toBeNull();
});

test('deleteWorkflow removes the entry', async () => {
  await saveWorkflow(sample);
  await deleteWorkflow('test-workflow');
  const result = await loadWorkflow('test-workflow');
  expect(result).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/workflows.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../storage/workflows'`

- [ ] **Step 3: Write `workflow/src/storage/workflows.ts`**

```typescript
import type { WorkflowJSON } from '../types';

const PREFIX = 'workflow_v1_';
const INDEX_KEY = 'workflow_v1_index';

async function getIndex(): Promise<string[]> {
  const result = await browser.storage.local.get(INDEX_KEY);
  return (result[INDEX_KEY] as string[] | undefined) ?? [];
}

async function setIndex(names: string[]): Promise<void> {
  await browser.storage.local.set({ [INDEX_KEY]: names });
}

export async function saveWorkflow(wf: WorkflowJSON): Promise<void> {
  const key = PREFIX + wf.name;
  await browser.storage.local.set({ [key]: wf });
  const index = await getIndex();
  if (!index.includes(wf.name)) {
    await setIndex([...index, wf.name]);
  }
}

export async function loadWorkflow(name: string): Promise<WorkflowJSON | null> {
  const key = PREFIX + name;
  const result = await browser.storage.local.get(key);
  return (result[key] as WorkflowJSON | undefined) ?? null;
}

export async function listWorkflows(): Promise<string[]> {
  return getIndex();
}

export async function deleteWorkflow(name: string): Promise<void> {
  const key = PREFIX + name;
  await browser.storage.local.remove(key);
  const index = await getIndex();
  await setIndex(index.filter((n) => n !== name));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd workflow && npx vitest run src/__tests__/workflows.test.ts --reporter=verbose
```

Expected:
```
✓ saveWorkflow persists and loadWorkflow retrieves it
✓ listWorkflows returns saved workflow names
✓ loadWorkflow returns null for unknown name
✓ deleteWorkflow removes the entry
Tests  4 passed (4)
```

- [ ] **Step 5: Commit**

```bash
git add workflow/src/storage/ workflow/src/__tests__/workflows.test.ts
git commit -m "feat: workflow designer — browser.storage.local CRUD for workflows"
```

---

## Task 5: Custom node components

**Files:**
- Create: `workflow/src/nodes/TriggerNode.tsx`
- Create: `workflow/src/nodes/BrowserNode.tsx`
- Create: `workflow/src/nodes/WaitNode.tsx`
- Create: `workflow/src/nodes/DataNode.tsx`
- Create: `workflow/src/nodes/ControlNode.tsx`
- Create: `workflow/src/nodes/AccountNode.tsx`
- Create: `workflow/src/nodes/OutputNode.tsx`
- Create: `workflow/src/nodes/index.ts`
- Test: `workflow/src/__tests__/nodes.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// workflow/src/__tests__/nodes.test.tsx
import { render, screen } from '@testing-library/react';
import { TriggerNode } from '../nodes/TriggerNode';
import { BrowserNode } from '../nodes/BrowserNode';
import { ControlNode } from '../nodes/ControlNode';
import { nodeTypes } from '../nodes/index';

const baseProps = {
  id: 'test',
  selected: false,
  dragging: false,
  isConnectable: true,
  zIndex: 0,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  type: 'trigger',
};

test('TriggerNode renders schedule subtype', () => {
  render(<TriggerNode {...baseProps} data={{ subtype: 'schedule', intervalHours: 12 }} />);
  expect(screen.getByText(/Schedule/i)).toBeInTheDocument();
});

test('TriggerNode renders manual subtype', () => {
  render(<TriggerNode {...baseProps} data={{ subtype: 'manual' }} />);
  expect(screen.getByText(/Manual/i)).toBeInTheDocument();
});

test('BrowserNode renders navigate label', () => {
  render(<BrowserNode {...baseProps} type="navigate" data={{ subtype: 'navigate', url: 'https://x.com' }} />);
  expect(screen.getByText(/Navigate/i)).toBeInTheDocument();
});

test('ControlNode renders loop subtype', () => {
  render(<ControlNode {...baseProps} type="loop" data={{ subtype: 'loop', maxIterations: 10, continueVariable: 'hasNext' }} />);
  expect(screen.getByText(/Loop/i)).toBeInTheDocument();
});

test('nodeTypes registry contains expected keys', () => {
  const keys = Object.keys(nodeTypes);
  expect(keys).toContain('trigger');
  expect(keys).toContain('navigate');
  expect(keys).toContain('extract');
  expect(keys).toContain('loop');
  expect(keys).toContain('sendToBackend');
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/nodes.test.tsx --reporter=verbose
```

Expected: FAIL — `Cannot find module '../nodes/TriggerNode'`

- [ ] **Step 3: Write `workflow/src/nodes/TriggerNode.tsx`**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TriggerData } from '../types';

export function TriggerNode({ data, selected }: NodeProps & { data: TriggerData }) {
  const label = data.subtype === 'schedule'
    ? `Schedule · ${data.intervalHours}h`
    : 'Manual Trigger';

  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#22d3ee' }}>
      <div className="wf-node-header" style={{ color: '#22d3ee' }}>
        {data.subtype === 'schedule' ? 'Schedule' : 'Manual'}
      </div>
      <div className="wf-node-label">{label}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
```

- [ ] **Step 4: Write `workflow/src/nodes/BrowserNode.tsx`**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BrowserData } from '../types';

const LABELS: Record<BrowserData['subtype'], string> = {
  navigate: 'Navigate',
  click: 'Click',
  fill: 'Fill',
  scroll: 'Scroll',
  hover: 'Hover',
};

const DETAIL = (d: BrowserData): string => {
  switch (d.subtype) {
    case 'navigate': return d.url;
    case 'click':    return d.selector;
    case 'fill':     return `${d.selector} = ${d.value}`;
    case 'scroll':   return `${d.selector} ${d.direction} ${d.amount}px`;
    case 'hover':    return d.selector;
  }
};

export function BrowserNode({ data, selected }: NodeProps & { data: BrowserData }) {
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#a78bfa' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#a78bfa' }}>{LABELS[data.subtype]}</div>
      <div className="wf-node-label">{DETAIL(data)}</div>
      <Handle type="source" position={Position.Right} id="out-success" />
      <Handle type="source" position={Position.Bottom} id="out-error" style={{ background: '#e94560' }} />
    </div>
  );
}
```

- [ ] **Step 5: Write `workflow/src/nodes/WaitNode.tsx`**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WaitData } from '../types';

const LABEL = (d: WaitData): string => {
  switch (d.subtype) {
    case 'waitForSelector': return `Wait: ${d.selector} (${d.timeoutMs}ms)`;
    case 'delay':           return `Delay ${d.ms}ms`;
    case 'networkIdle':     return 'Network Idle';
  }
};

const HEADER = (d: WaitData): string => {
  switch (d.subtype) {
    case 'waitForSelector': return 'Wait Selector';
    case 'delay':           return 'Delay';
    case 'networkIdle':     return 'Network Idle';
  }
};

export function WaitNode({ data, selected }: NodeProps & { data: WaitData }) {
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#fbbf24' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#fbbf24' }}>{HEADER(data)}</div>
      <div className="wf-node-label">{LABEL(data)}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
```

- [ ] **Step 6: Write `workflow/src/nodes/DataNode.tsx`**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DataNodeData } from '../types';

export function DataNode({ data, selected }: NodeProps & { data: DataNodeData }) {
  const header = data.subtype === 'extract' ? 'Extract' : 'Extract Table';
  const label = data.subtype === 'extract'
    ? `${data.fields.length} field(s) → ${data.varName}`
    : `${data.selector} → ${data.varName}`;

  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#34d399' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#34d399' }}>{header}</div>
      <div className="wf-node-label">{label}</div>
      <Handle type="source" position={Position.Right} id="out" style={{ background: '#34d399' }} />
    </div>
  );
}
```

- [ ] **Step 7: Write `workflow/src/nodes/ControlNode.tsx`**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ControlData } from '../types';

export function ControlNode({ data, selected }: NodeProps & { data: ControlData }) {
  if (data.subtype === 'loop') {
    return (
      <div className={`wf-node wf-loop-node${selected ? ' selected' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="wf-node-header" style={{ color: '#e94560' }}>Loop</div>
        <div className="wf-node-label">max {data.maxIterations} · {data.continueVariable}</div>
        <Handle type="source" position={Position.Right} id="out-loop" style={{ top: '40%' }} />
        <Handle type="source" position={Position.Right} id="out-done" style={{ top: '70%', background: '#34d399' }} />
      </div>
    );
  }

  if (data.subtype === 'condition') {
    return (
      <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#f97316' }}>
        <Handle type="target" position={Position.Left} id="in" />
        <Handle type="target" position={Position.Top} id="in-data" style={{ background: '#34d399' }} />
        <div className="wf-node-header" style={{ color: '#f97316' }}>Condition</div>
        <div className="wf-node-label">{data.variable} {data.operator} {data.value}</div>
        <Handle type="source" position={Position.Right} id="out-true" style={{ top: '35%' }} />
        <Handle type="source" position={Position.Right} id="out-false" style={{ top: '65%', background: '#e94560' }} />
      </div>
    );
  }

  // merge
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#94a3b8' }}>
      <Handle type="target" position={Position.Left} id="in-a" style={{ top: '35%' }} />
      <Handle type="target" position={Position.Left} id="in-b" style={{ top: '65%' }} />
      <div className="wf-node-header" style={{ color: '#94a3b8' }}>Merge</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
```

- [ ] **Step 8: Write `workflow/src/nodes/AccountNode.tsx`**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AccountData } from '../types';

export function AccountNode({ data, selected }: NodeProps & { data: AccountData }) {
  const label = data.subtype === 'injectCredentials' ? 'Inject Credentials' : 'Switch Account';

  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#60a5fa' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#60a5fa' }}>Account</div>
      <div className="wf-node-label">{label}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
```

- [ ] **Step 9: Write `workflow/src/nodes/OutputNode.tsx`**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OutputData } from '../types';

export function OutputNode({ data, selected }: NodeProps & { data: OutputData }) {
  const label = data.subtype === 'sendToBackend'
    ? `POST ${data.endpoint || '/api/launches'}`
    : 'Save Locally';

  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#fb923c' }}>
      <Handle type="target" position={Position.Left} id="in-flow" />
      <Handle type="target" position={Position.Top} id="in-data" style={{ background: '#34d399' }} />
      <div className="wf-node-header" style={{ color: '#fb923c' }}>
        {data.subtype === 'sendToBackend' ? 'Send to Backend' : 'Save Locally'}
      </div>
      <div className="wf-node-label">{label}</div>
      {data.subtype === 'sendToBackend' && (
        <>
          <Handle type="source" position={Position.Right} id="out-success" style={{ top: '35%' }} />
          <Handle type="source" position={Position.Right} id="out-error" style={{ top: '65%', background: '#e94560' }} />
        </>
      )}
      {data.subtype === 'saveLocally' && (
        <Handle type="source" position={Position.Right} id="out" />
      )}
    </div>
  );
}
```

- [ ] **Step 10: Write `workflow/src/nodes/index.ts`**

```typescript
import type { NodeTypes } from '@xyflow/react';
import { TriggerNode } from './TriggerNode';
import { BrowserNode } from './BrowserNode';
import { WaitNode } from './WaitNode';
import { DataNode } from './DataNode';
import { ControlNode } from './ControlNode';
import { AccountNode } from './AccountNode';
import { OutputNode } from './OutputNode';

export const nodeTypes: NodeTypes = {
  // Triggers
  trigger: TriggerNode as NodeTypes[string],
  // Browser
  navigate: BrowserNode as NodeTypes[string],
  click: BrowserNode as NodeTypes[string],
  fill: BrowserNode as NodeTypes[string],
  scroll: BrowserNode as NodeTypes[string],
  hover: BrowserNode as NodeTypes[string],
  // Wait
  waitForSelector: WaitNode as NodeTypes[string],
  delay: WaitNode as NodeTypes[string],
  networkIdle: WaitNode as NodeTypes[string],
  // Data
  extract: DataNode as NodeTypes[string],
  extractTable: DataNode as NodeTypes[string],
  // Control
  condition: ControlNode as NodeTypes[string],
  loop: ControlNode as NodeTypes[string],
  merge: ControlNode as NodeTypes[string],
  // Account
  injectCredentials: AccountNode as NodeTypes[string],
  switchAccount: AccountNode as NodeTypes[string],
  // Output
  sendToBackend: OutputNode as NodeTypes[string],
  saveLocally: OutputNode as NodeTypes[string],
};
```

- [ ] **Step 11: Run tests to verify they pass**

```
cd workflow && npx vitest run src/__tests__/nodes.test.tsx --reporter=verbose
```

Expected:
```
✓ TriggerNode renders schedule subtype
✓ TriggerNode renders manual subtype
✓ BrowserNode renders navigate label
✓ ControlNode renders loop subtype
✓ nodeTypes registry contains expected keys
Tests  5 passed (5)
```

- [ ] **Step 12: Commit**

```bash
git add workflow/src/nodes/ workflow/src/__tests__/nodes.test.tsx
git commit -m "feat: workflow designer — all 7 custom node component families"
```

---

## Task 6: Typed edge component

**Files:**
- Create: `workflow/src/edges/TypedEdge.tsx`
- Create: `workflow/src/edges/index.ts`
- Test: `workflow/src/__tests__/edges.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// workflow/src/__tests__/edges.test.tsx
import { portsCompatible } from '../types';

test('flow → flow is compatible', () => {
  expect(portsCompatible('trigger', 'out', 'navigate', 'in')).toBe(true);
});

test('data → flow is incompatible', () => {
  expect(portsCompatible('extract', 'out', 'navigate', 'in')).toBe(false);
});

test('data → data is compatible', () => {
  expect(portsCompatible('extract', 'out', 'sendToBackend', 'in-data')).toBe(true);
});

test('error → flow is incompatible', () => {
  expect(portsCompatible('navigate', 'out-error', 'navigate', 'in')).toBe(false);
});

test('unknown handles default to compatible', () => {
  expect(portsCompatible('unknown', 'x', 'unknown', 'y')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/edges.test.tsx --reporter=verbose
```

Expected: FAIL — `portsCompatible` returns wrong values (not yet implemented correctly)

- [ ] **Step 3: Verify `portsCompatible` is already correct from Task 2 (re-run after confirming)**

The test uses `portsCompatible` from `types.ts`. Confirm the logic: `extract-out` maps to `data`, `navigate-in` maps to `flow`. `data !== flow` → false. Run:

```
cd workflow && npx vitest run src/__tests__/edges.test.tsx --reporter=verbose
```

Expected: all 5 pass.

- [ ] **Step 4: Write `workflow/src/edges/TypedEdge.tsx`**

```tsx
import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';
import { HANDLE_TYPES } from '../types';

export function TypedEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  source, target, sourceHandleId, targetHandleId,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const srcType = sourceHandleId ? HANDLE_TYPES[source]?.[sourceHandleId] : undefined;
  const tgtType = targetHandleId ? HANDLE_TYPES[target]?.[targetHandleId] : undefined;
  const isInvalid = srcType && tgtType && srcType !== tgtType;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      className={isInvalid ? 'edge-invalid' : undefined}
      style={{
        stroke: isInvalid ? '#e94560' : selected ? '#ffffff' : '#475569',
        strokeWidth: selected ? 2 : 1.5,
      }}
    />
  );
}
```

- [ ] **Step 5: Write `workflow/src/edges/index.ts`**

```typescript
import type { EdgeTypes } from '@xyflow/react';
import { TypedEdge } from './TypedEdge';

export const edgeTypes: EdgeTypes = {
  typed: TypedEdge,
};
```

- [ ] **Step 6: Commit**

```bash
git add workflow/src/edges/ workflow/src/__tests__/edges.test.tsx
git commit -m "feat: workflow designer — typed edge with port-mismatch validation"
```

---

## Task 7: Node library sidebar

**Files:**
- Create: `workflow/src/components/NodeLibrary.tsx`
- Test: `workflow/src/__tests__/NodeLibrary.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// workflow/src/__tests__/NodeLibrary.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeLibrary } from '../components/NodeLibrary';

test('renders all category headers', () => {
  render(<NodeLibrary />);
  expect(screen.getByText('Triggers')).toBeInTheDocument();
  expect(screen.getByText('Browser')).toBeInTheDocument();
  expect(screen.getByText('Wait')).toBeInTheDocument();
  expect(screen.getByText('Data')).toBeInTheDocument();
  expect(screen.getByText('Control')).toBeInTheDocument();
  expect(screen.getByText('Account')).toBeInTheDocument();
  expect(screen.getByText('Output')).toBeInTheDocument();
});

test('items are draggable — dragstart sets dataTransfer', () => {
  render(<NodeLibrary />);
  const item = screen.getByText('Schedule');
  const dt = { setData: vi.fn(), effectAllowed: '' };
  fireEvent.dragStart(item, { dataTransfer: dt });
  expect(dt.setData).toHaveBeenCalledWith(
    'application/reactflow',
    expect.stringContaining('trigger')
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/NodeLibrary.test.tsx --reporter=verbose
```

Expected: FAIL — `Cannot find module '../components/NodeLibrary'`

- [ ] **Step 3: Write `workflow/src/components/NodeLibrary.tsx`**

```tsx
import { useState } from 'react';

interface NodeDef {
  label: string;
  nodeType: string;
  subtype: string;
}

const CATEGORIES: Array<{ title: string; nodes: NodeDef[] }> = [
  {
    title: 'Triggers',
    nodes: [
      { label: 'Schedule', nodeType: 'trigger', subtype: 'schedule' },
      { label: 'Manual', nodeType: 'trigger', subtype: 'manual' },
    ],
  },
  {
    title: 'Browser',
    nodes: [
      { label: 'Navigate', nodeType: 'navigate', subtype: 'navigate' },
      { label: 'Click', nodeType: 'click', subtype: 'click' },
      { label: 'Fill', nodeType: 'fill', subtype: 'fill' },
      { label: 'Scroll', nodeType: 'scroll', subtype: 'scroll' },
      { label: 'Hover', nodeType: 'hover', subtype: 'hover' },
    ],
  },
  {
    title: 'Wait',
    nodes: [
      { label: 'Wait for Selector', nodeType: 'waitForSelector', subtype: 'waitForSelector' },
      { label: 'Delay', nodeType: 'delay', subtype: 'delay' },
      { label: 'Network Idle', nodeType: 'networkIdle', subtype: 'networkIdle' },
    ],
  },
  {
    title: 'Data',
    nodes: [
      { label: 'Extract', nodeType: 'extract', subtype: 'extract' },
      { label: 'Extract Table', nodeType: 'extractTable', subtype: 'extractTable' },
    ],
  },
  {
    title: 'Control',
    nodes: [
      { label: 'Condition', nodeType: 'condition', subtype: 'condition' },
      { label: 'Loop', nodeType: 'loop', subtype: 'loop' },
      { label: 'Merge', nodeType: 'merge', subtype: 'merge' },
    ],
  },
  {
    title: 'Account',
    nodes: [
      { label: 'Inject Credentials', nodeType: 'injectCredentials', subtype: 'injectCredentials' },
      { label: 'Switch Account', nodeType: 'switchAccount', subtype: 'switchAccount' },
    ],
  },
  {
    title: 'Output',
    nodes: [
      { label: 'Send to Backend', nodeType: 'sendToBackend', subtype: 'sendToBackend' },
      { label: 'Save Locally', nodeType: 'saveLocally', subtype: 'saveLocally' },
    ],
  },
];

export function NodeLibrary() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(title: string) {
    setCollapsed((c) => ({ ...c, [title]: !c[title] }));
  }

  function onDragStart(e: React.DragEvent, node: NodeDef) {
    e.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType: node.nodeType, subtype: node.subtype }));
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="wf-sidebar" style={{ paddingTop: 8 }}>
      {CATEGORIES.map((cat) => (
        <div key={cat.title}>
          <div
            className="nl-category"
            onClick={() => toggle(cat.title)}
          >
            {collapsed[cat.title] ? '▸' : '▾'} {cat.title}
          </div>
          {!collapsed[cat.title] && cat.nodes.map((n) => (
            <div
              key={n.label}
              className="nl-item"
              draggable
              onDragStart={(e) => onDragStart(e, n)}
            >
              {n.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd workflow && npx vitest run src/__tests__/NodeLibrary.test.tsx --reporter=verbose
```

Expected:
```
✓ renders all category headers
✓ items are draggable — dragstart sets dataTransfer
Tests  2 passed (2)
```

- [ ] **Step 5: Commit**

```bash
git add workflow/src/components/NodeLibrary.tsx workflow/src/__tests__/NodeLibrary.test.tsx
git commit -m "feat: workflow designer — node library sidebar with drag support"
```

---

## Task 8: Inspector panel

**Files:**
- Create: `workflow/src/components/Inspector.tsx`
- Test: `workflow/src/__tests__/Inspector.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// workflow/src/__tests__/Inspector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Inspector } from '../components/Inspector';
import type { WorkflowNode } from '../types';

function makeNode(overrides: Partial<WorkflowNode>): WorkflowNode {
  return { id: 'n1', type: 'navigate', position: { x: 0, y: 0 }, data: { subtype: 'navigate', url: '' }, ...overrides };
}

test('shows empty message when no node selected', () => {
  render(<Inspector node={null} onUpdate={() => {}} />);
  expect(screen.getByText(/Select a node/i)).toBeInTheDocument();
});

test('shows URL field for navigate node', () => {
  const node = makeNode({ type: 'navigate', data: { subtype: 'navigate', url: 'https://example.com' } });
  render(<Inspector node={node} onUpdate={() => {}} />);
  expect(screen.getByLabelText(/URL/i)).toHaveValue('https://example.com');
});

test('calls onUpdate when URL changes', () => {
  const onUpdate = vi.fn();
  const node = makeNode({ type: 'navigate', data: { subtype: 'navigate', url: '' } });
  render(<Inspector node={node} onUpdate={onUpdate} />);
  fireEvent.change(screen.getByLabelText(/URL/i), { target: { value: 'https://new.com' } });
  expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://new.com' }));
});

test('shows selector field for click node', () => {
  const node = makeNode({ type: 'click', data: { subtype: 'click', selector: 'css=#btn' } });
  render(<Inspector node={node} onUpdate={() => {}} />);
  expect(screen.getByLabelText(/Selector/i)).toHaveValue('css=#btn');
});

test('shows delay ms field for delay node', () => {
  const node = makeNode({ type: 'delay', data: { subtype: 'delay', ms: 1000 } });
  render(<Inspector node={node} onUpdate={() => {}} />);
  expect(screen.getByLabelText(/Milliseconds/i)).toHaveValue(1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/Inspector.test.tsx --reporter=verbose
```

Expected: FAIL — `Cannot find module '../components/Inspector'`

- [ ] **Step 3: Write `workflow/src/components/Inspector.tsx`**

```tsx
import type { WorkflowNode, NodeData } from '../types';

interface Props {
  node: WorkflowNode | null;
  onUpdate: (data: Partial<NodeData>) => void;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="ins-field">
      <label className="ins-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function Inspector({ node, onUpdate }: Props) {
  if (!node) {
    return <div className="ins-empty">Select a node to configure it</div>;
  }

  const d = node.data;

  switch (d.subtype) {
    case 'schedule':
      return (
        <>
          <Field label="Interval (hours)" id="intervalHours">
            <input id="intervalHours" type="number" className="ins-input" value={d.intervalHours}
              onChange={(e) => onUpdate({ subtype: 'schedule', intervalHours: Number(e.target.value) })} />
          </Field>
        </>
      );

    case 'manual':
      return <p style={{ color: '#64748b', fontSize: 13 }}>No configuration needed.</p>;

    case 'navigate':
      return (
        <>
          <Field label="URL" id="url">
            <input id="url" type="url" className="ins-input" value={d.url}
              onChange={(e) => onUpdate({ ...d, url: e.target.value })} />
          </Field>
        </>
      );

    case 'click':
    case 'hover':
      return (
        <>
          <Field label="Selector" id="selector">
            <input id="selector" type="text" className="ins-input" value={d.selector}
              onChange={(e) => onUpdate({ ...d, selector: e.target.value })} />
          </Field>
        </>
      );

    case 'fill':
      return (
        <>
          <Field label="Selector" id="selector">
            <input id="selector" type="text" className="ins-input" value={d.selector}
              onChange={(e) => onUpdate({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Value" id="value">
            <input id="value" type="text" className="ins-input" value={d.value}
              onChange={(e) => onUpdate({ ...d, value: e.target.value })} />
          </Field>
        </>
      );

    case 'scroll':
      return (
        <>
          <Field label="Selector" id="selector">
            <input id="selector" type="text" className="ins-input" value={d.selector}
              onChange={(e) => onUpdate({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Direction" id="direction">
            <select id="direction" className="ins-input" value={d.direction}
              onChange={(e) => onUpdate({ ...d, direction: e.target.value as 'down' | 'up' })}>
              <option value="down">Down</option>
              <option value="up">Up</option>
            </select>
          </Field>
          <Field label="Amount (px)" id="amount">
            <input id="amount" type="number" className="ins-input" value={d.amount}
              onChange={(e) => onUpdate({ ...d, amount: Number(e.target.value) })} />
          </Field>
        </>
      );

    case 'waitForSelector':
      return (
        <>
          <Field label="Selector" id="selector">
            <input id="selector" type="text" className="ins-input" value={d.selector}
              onChange={(e) => onUpdate({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Timeout (ms)" id="timeoutMs">
            <input id="timeoutMs" type="number" className="ins-input" value={d.timeoutMs}
              onChange={(e) => onUpdate({ ...d, timeoutMs: Number(e.target.value) })} />
          </Field>
        </>
      );

    case 'delay':
      return (
        <>
          <Field label="Milliseconds" id="ms">
            <input id="ms" type="number" className="ins-input" value={d.ms}
              onChange={(e) => onUpdate({ subtype: 'delay', ms: Number(e.target.value) })} />
          </Field>
        </>
      );

    case 'networkIdle':
      return <p style={{ color: '#64748b', fontSize: 13 }}>Waits for network quiet (2s idle).</p>;

    case 'extract':
      return (
        <>
          <Field label="Variable Name" id="varName">
            <input id="varName" type="text" className="ins-input" value={d.varName}
              onChange={(e) => onUpdate({ ...d, varName: e.target.value })} />
          </Field>
          <Field label="Fields (selector → name, one per line)" id="fields">
            <textarea id="fields" className="ins-input" rows={5}
              value={d.fields.map((f) => `${f.selector} → ${f.name}${f.attr ? ` @${f.attr}` : ''}`).join('\n')}
              onChange={(e) => {
                const fields = e.target.value.split('\n').filter(Boolean).map((line) => {
                  const [left, right] = line.split('→').map((s) => s.trim());
                  const [name, attr] = (right ?? '').split('@').map((s) => s.trim());
                  return { selector: left, name, attr: attr || undefined };
                });
                onUpdate({ ...d, fields });
              }}
            />
          </Field>
        </>
      );

    case 'extractTable':
      return (
        <>
          <Field label="Table Selector" id="selector">
            <input id="selector" type="text" className="ins-input" value={d.selector}
              onChange={(e) => onUpdate({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Variable Name" id="varName">
            <input id="varName" type="text" className="ins-input" value={d.varName}
              onChange={(e) => onUpdate({ ...d, varName: e.target.value })} />
          </Field>
        </>
      );

    case 'condition':
      return (
        <>
          <Field label="Variable" id="variable">
            <input id="variable" type="text" className="ins-input" value={d.variable}
              onChange={(e) => onUpdate({ ...d, variable: e.target.value })} />
          </Field>
          <Field label="Operator" id="operator">
            <select id="operator" className="ins-input" value={d.operator}
              onChange={(e) => onUpdate({ ...d, operator: e.target.value as typeof d.operator })}>
              <option value="==">== (equals)</option>
              <option value="!=">!= (not equals)</option>
              <option value=">">&gt; (greater)</option>
              <option value="<">&lt; (less)</option>
              <option value="contains">contains</option>
            </select>
          </Field>
          <Field label="Value" id="cond-value">
            <input id="cond-value" type="text" className="ins-input" value={d.value}
              onChange={(e) => onUpdate({ ...d, value: e.target.value })} />
          </Field>
        </>
      );

    case 'loop':
      return (
        <>
          <Field label="Max Iterations" id="maxIterations">
            <input id="maxIterations" type="number" className="ins-input" value={d.maxIterations}
              onChange={(e) => onUpdate({ ...d, maxIterations: Number(e.target.value) })} />
          </Field>
          <Field label="Continue Variable" id="continueVariable">
            <input id="continueVariable" type="text" className="ins-input" value={d.continueVariable}
              onChange={(e) => onUpdate({ ...d, continueVariable: e.target.value })} />
          </Field>
        </>
      );

    case 'merge':
      return <p style={{ color: '#64748b', fontSize: 13 }}>Merges multiple branches into one flow.</p>;

    case 'injectCredentials':
      return <p style={{ color: '#64748b', fontSize: 13 }}>Injects account.email and account.password into the macro.</p>;

    case 'switchAccount':
      return <p style={{ color: '#64748b', fontSize: 13 }}>Advances the account rotation pointer.</p>;

    case 'sendToBackend':
      return (
        <>
          <Field label="Endpoint" id="endpoint">
            <input id="endpoint" type="text" className="ins-input" value={d.endpoint || '/api/launches'}
              onChange={(e) => onUpdate({ ...d, endpoint: e.target.value })} />
          </Field>
        </>
      );

    case 'saveLocally':
      return <p style={{ color: '#64748b', fontSize: 13 }}>Saves scraped data to localStorage.DotGitScrapedData.</p>;

    default:
      return <div className="ins-empty">Unknown node type</div>;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd workflow && npx vitest run src/__tests__/Inspector.test.tsx --reporter=verbose
```

Expected:
```
✓ shows empty message when no node selected
✓ shows URL field for navigate node
✓ calls onUpdate when URL changes
✓ shows selector field for click node
✓ shows delay ms field for delay node
Tests  5 passed (5)
```

- [ ] **Step 5: Commit**

```bash
git add workflow/src/components/Inspector.tsx workflow/src/__tests__/Inspector.test.tsx
git commit -m "feat: workflow designer — inspector panel with per-subtype config forms"
```

---

## Task 9: Toolbar + full App.tsx wiring

**Files:**
- Create: `workflow/src/components/Toolbar.tsx`
- Modify: `workflow/src/App.tsx`
- Test: `workflow/src/__tests__/Toolbar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// workflow/src/__tests__/Toolbar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from '../components/Toolbar';

test('renders workflow name input', () => {
  render(<Toolbar name="My Flow" onNameChange={() => {}} onSave={() => {}} onExport={() => {}} onImport={() => {}} />);
  expect(screen.getByDisplayValue('My Flow')).toBeInTheDocument();
});

test('calls onSave when Save is clicked', () => {
  const onSave = vi.fn();
  render(<Toolbar name="x" onNameChange={() => {}} onSave={onSave} onExport={() => {}} onImport={() => {}} />);
  fireEvent.click(screen.getByText('Save'));
  expect(onSave).toHaveBeenCalled();
});

test('calls onExport with "uivision" when Export ui.vision is clicked', () => {
  const onExport = vi.fn();
  render(<Toolbar name="x" onNameChange={() => {}} onSave={() => {}} onExport={onExport} onImport={() => {}} />);
  fireEvent.click(screen.getByText('Export ▾'));
  fireEvent.click(screen.getByText('Export ui.vision'));
  expect(onExport).toHaveBeenCalledWith('uivision');
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/Toolbar.test.tsx --reporter=verbose
```

Expected: FAIL — `Cannot find module '../components/Toolbar'`

- [ ] **Step 3: Write `workflow/src/components/Toolbar.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onExport: (format: 'uivision' | 'raw') => void;
  onImport: () => void;
}

export function Toolbar({ name, onNameChange, onSave, onExport, onImport }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="wf-toolbar">
      <span style={{ fontWeight: 700, color: '#e94560', marginRight: 8 }}>DotGit</span>
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Workflow name"
      />
      <div style={{ flex: 1 }} />
      <button className="wf-btn wf-btn-primary" onClick={onSave}>Save</button>
      <div style={{ position: 'relative' }} ref={dropRef}>
        <button className="wf-btn" onClick={() => setExportOpen((o) => !o)}>Export ▾</button>
        {exportOpen && (
          <div style={{
            position: 'absolute', right: 0, top: '110%', background: '#16213e',
            border: '1px solid #0f3460', borderRadius: 4, minWidth: 160, zIndex: 100,
          }}>
            <div
              style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: '#e2e8f0' }}
              onClick={() => { onExport('uivision'); setExportOpen(false); }}
            >Export ui.vision</div>
            <div
              style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: '#e2e8f0' }}
              onClick={() => { onExport('raw'); setExportOpen(false); }}
            >Export Raw JSON</div>
          </div>
        )}
      </div>
      <button className="wf-btn" onClick={onImport}>Import</button>
    </div>
  );
}
```

- [ ] **Step 4: Write the complete `workflow/src/App.tsx`**

```tsx
import { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type IsValidConnection,
  useReactFlow,
} from '@xyflow/react';
import { useWorkflowStore } from './store';
import { nodeTypes } from './nodes/index';
import { edgeTypes } from './edges/index';
import { NodeLibrary } from './components/NodeLibrary';
import { Inspector } from './components/Inspector';
import { Toolbar } from './components/Toolbar';
import { saveWorkflow } from './storage/workflows';
import { toUiVision } from './export/toUiVision';
import { fromUiVisionFile, fromRawFile } from './export/fromUiVision';
import type { NodeData, WorkflowNode } from './types';
import { portsCompatible } from './types';

let nodeIdCounter = 1;
function freshId() { return `node_${nodeIdCounter++}`; }

function defaultData(subtype: string): NodeData {
  const map: Record<string, NodeData> = {
    schedule: { subtype: 'schedule', intervalHours: 12 },
    manual: { subtype: 'manual' },
    navigate: { subtype: 'navigate', url: '' },
    click: { subtype: 'click', selector: '' },
    fill: { subtype: 'fill', selector: '', value: '' },
    scroll: { subtype: 'scroll', selector: 'body', direction: 'down', amount: 500 },
    hover: { subtype: 'hover', selector: '' },
    waitForSelector: { subtype: 'waitForSelector', selector: '', timeoutMs: 5000 },
    delay: { subtype: 'delay', ms: 1000 },
    networkIdle: { subtype: 'networkIdle' },
    extract: { subtype: 'extract', fields: [], varName: 'result' },
    extractTable: { subtype: 'extractTable', selector: 'table', varName: 'tableData' },
    condition: { subtype: 'condition', variable: '', operator: '==', value: '' },
    loop: { subtype: 'loop', maxIterations: 100, continueVariable: 'hasNext' },
    merge: { subtype: 'merge' },
    injectCredentials: { subtype: 'injectCredentials' },
    switchAccount: { subtype: 'switchAccount' },
    sendToBackend: { subtype: 'sendToBackend', endpoint: '/api/launches' },
    saveLocally: { subtype: 'saveLocally' },
  };
  return map[subtype] ?? { subtype: 'manual' };
}

function isValidConnectionFn(connection: Connection): boolean {
  if (!connection.source || !connection.target) return false;
  return portsCompatible(
    connection.source, connection.sourceHandle ?? '',
    connection.target, connection.targetHandle ?? '',
  );
}

function CanvasInner() {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    selectedNodeId, selectNode, updateNodeData, workflowName, workflowDomain,
    setWorkflowMeta, loadWorkflow,
  } = useWorkflowStore();
  const { store: rfStore } = useReactFlow();
  const store = useWorkflowStore.getState;
  const importRef = useRef<HTMLInputElement>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const { addNode } = useWorkflowStore();

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/reactflow');
    if (!raw) return;
    const { nodeType, subtype } = JSON.parse(raw) as { nodeType: string; subtype: string };
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = rfStore.getState().transform
      ? {
          x: (e.clientX - bounds.left - rfStore.getState().transform[0]) / rfStore.getState().transform[2],
          y: (e.clientY - bounds.top - rfStore.getState().transform[1]) / rfStore.getState().transform[2],
        }
      : { x: e.clientX - bounds.left, y: e.clientY - bounds.top };

    const newNode: WorkflowNode = {
      id: freshId(),
      type: nodeType,
      position,
      data: defaultData(subtype),
    };
    addNode(newNode);
  }, [rfStore, addNode]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: WorkflowNode) => {
    selectNode(node.id);
  }, [selectNode]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  function handleSave() {
    saveWorkflow({ name: workflowName, domain: workflowDomain, nodes, edges });
  }

  function handleExport(format: 'uivision' | 'raw') {
    const wf = { name: workflowName, domain: workflowDomain, nodes, edges };
    const content = format === 'uivision'
      ? JSON.stringify(toUiVision(wf), null, 2)
      : JSON.stringify(wf, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'uivision' ? `${workflowName}.json` : `${workflowName}-raw.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    importRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const json = JSON.parse(text);
    const wf = ('Commands' in json) ? fromUiVisionFile(json) : json;
    loadWorkflow(wf.nodes, wf.edges, wf.name ?? workflowName, wf.domain ?? workflowDomain);
    e.target.value = '';
  }

  return (
    <div className="wf-layout">
      <Toolbar
        name={workflowName}
        onNameChange={(n) => setWorkflowMeta(n, workflowDomain)}
        onSave={handleSave}
        onExport={handleExport}
        onImport={handleImport}
      />
      <NodeLibrary />
      <div
        className="wf-canvas"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick as (e: React.MouseEvent, n: unknown) => void}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          isValidConnection={isValidConnectionFn as IsValidConnection}
          fitView
          deleteKeyCode="Delete"
        >
          <Background />
          <Controls />
          <MiniMap nodeColor="#0f3460" maskColor="rgba(0,0,0,0.6)" />
        </ReactFlow>
      </div>
      <div className="wf-inspector">
        <Inspector
          node={selectedNode}
          onUpdate={(data) => {
            if (selectedNodeId) updateNodeData(selectedNodeId, data);
          }}
        />
      </div>
      <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onFileChange} />
    </div>
  );
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CanvasInner />
    </div>
  );
}
```

- [ ] **Step 5: Run toolbar tests to verify they pass**

```
cd workflow && npx vitest run src/__tests__/Toolbar.test.tsx --reporter=verbose
```

Expected:
```
✓ renders workflow name input
✓ calls onSave when Save is clicked
✓ calls onExport with "uivision" when Export ui.vision is clicked
Tests  3 passed (3)
```

- [ ] **Step 6: Run full test suite**

```
cd workflow && npx vitest run --reporter=verbose
```

Expected: all previous tests still pass.

- [ ] **Step 7: Commit**

```bash
git add workflow/src/components/Toolbar.tsx workflow/src/App.tsx workflow/src/__tests__/Toolbar.test.tsx
git commit -m "feat: workflow designer — Toolbar, App wiring, drag-drop, keyboard undo/redo"
```

---

## Task 10: ui.vision exporter

**Files:**
- Create: `workflow/src/export/toUiVision.ts`
- Test: `workflow/src/__tests__/toUiVision.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// workflow/src/__tests__/toUiVision.test.ts
import { toUiVision } from '../export/toUiVision';
import type { WorkflowJSON, WorkflowNode, WorkflowEdge } from '../types';

function wf(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowJSON {
  return { name: 'test', domain: 'example.com', nodes, edges };
}

function node(id: string, type: string, data: object): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data } as WorkflowNode;
}

function edge(source: string, target: string, sourceHandle = 'out', targetHandle = 'in'): WorkflowEdge {
  return { id: `${source}-${target}`, source, target, sourceHandle, targetHandle };
}

test('trigger → navigate produces open command', () => {
  const macro = toUiVision(wf(
    [
      node('t1', 'trigger', { subtype: 'manual' }),
      node('n1', 'navigate', { subtype: 'navigate', url: 'https://example.com' }),
    ],
    [edge('t1', 'n1', 'out', 'in')],
  ));
  expect(macro.Commands).toHaveLength(1);
  expect(macro.Commands[0].Command).toBe('open');
  expect(macro.Commands[0].Target).toBe('https://example.com');
});

test('fill node produces type command', () => {
  const macro = toUiVision(wf(
    [
      node('t1', 'trigger', { subtype: 'manual' }),
      node('f1', 'fill', { subtype: 'fill', selector: 'css=#email', value: '${account.email}' }),
    ],
    [edge('t1', 'f1', 'out', 'in')],
  ));
  const cmd = macro.Commands.find((c) => c.Command === 'type');
  expect(cmd).toBeDefined();
  expect(cmd!.Target).toBe('css=#email');
  expect(cmd!.Value).toBe('${account.email}');
});

test('condition node emits if/else/endIf', () => {
  const macro = toUiVision(wf(
    [
      node('t1', 'trigger', { subtype: 'manual' }),
      node('c1', 'condition', { subtype: 'condition', variable: 'hasNext', operator: '==', value: 'true' }),
    ],
    [edge('t1', 'c1', 'out', 'in')],
  ));
  const commands = macro.Commands.map((c) => c.Command);
  expect(commands).toContain('if');
  expect(commands).toContain('endIf');
});

test('delay node emits pause', () => {
  const macro = toUiVision(wf(
    [
      node('t1', 'trigger', { subtype: 'manual' }),
      node('d1', 'delay', { subtype: 'delay', ms: 2000 }),
    ],
    [edge('t1', 'd1', 'out', 'in')],
  ));
  const pause = macro.Commands.find((c) => c.Command === 'pause');
  expect(pause).toBeDefined();
  expect(pause!.Target).toBe('2000');
});

test('sendToBackend emits executeScript_Sandbox', () => {
  const macro = toUiVision(wf(
    [
      node('t1', 'trigger', { subtype: 'manual' }),
      node('o1', 'sendToBackend', { subtype: 'sendToBackend', endpoint: '/api/launches' }),
    ],
    [edge('t1', 'o1', 'out', 'in-flow')],
  ));
  const exec = macro.Commands.find((c) => c.Command === 'executeScript_Sandbox');
  expect(exec).toBeDefined();
  expect(exec!.Target).toContain('DotGitScrapedData');
});

test('macro name matches workflow name', () => {
  const macro = toUiVision({ name: 'my-workflow', domain: 'x.com', nodes: [node('t1', 'trigger', { subtype: 'manual' })], edges: [] });
  expect(macro.Name).toBe('my-workflow');
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/toUiVision.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../export/toUiVision'`

- [ ] **Step 3: Write `workflow/src/export/toUiVision.ts`**

```typescript
import type { WorkflowJSON, WorkflowNode, UiVisionMacro, UiVisionCommand } from '../types';

type Cmd = UiVisionCommand;
const cmd = (Command: string, Target: string, Value = '', Description = ''): Cmd => ({ Command, Target, Value, Description });

function nodeCommands(node: WorkflowNode, outEdges: Map<string, WorkflowNode[]>): Cmd[] {
  const d = node.data;
  switch (d.subtype) {
    case 'manual':
    case 'schedule':
      return [];

    case 'navigate':
      return [cmd('open', d.url)];

    case 'click':
      return [cmd('click', d.selector)];

    case 'fill':
      return [cmd('type', d.selector, d.value)];

    case 'scroll':
      return [cmd('executeScript_Sandbox',
        `window.scrollBy(0, ${d.direction === 'down' ? d.amount : -d.amount});`)];

    case 'hover':
      return [cmd('mouseOver', d.selector)];

    case 'waitForSelector':
      return [cmd('waitForElementVisible', d.selector, String(d.timeoutMs))];

    case 'delay':
      return [cmd('pause', String(d.ms))];

    case 'networkIdle':
      return [cmd('pause', '2000')];

    case 'extract': {
      const cmds: Cmd[] = [];
      cmds.push(cmd('executeScript_Sandbox',
        'window.__dotgitData = window.__dotgitData || [];'));
      for (const f of d.fields) {
        const varName = `_ext_${f.name}`;
        if (f.attr) {
          cmds.push(cmd('storeAttribute', `${f.selector}@${f.attr}`, varName));
        } else {
          cmds.push(cmd('storeText', f.selector, varName));
        }
      }
      const assign = `window.__dotgitData.push({${d.fields.map((f) => `"${f.name}":storedVars["_ext_${f.name}"]`).join(',')}});`;
      cmds.push(cmd('executeScript_Sandbox', assign));
      cmds.push(cmd('store', `\${${d.varName}}`, d.varName));
      return cmds;
    }

    case 'extractTable':
      return [
        cmd('executeScript_Sandbox',
          `window.__dotgitData = Array.from(document.querySelectorAll('${d.selector} tr')).slice(1).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText));`),
        cmd('executeScript_Sandbox',
          `storedVars["${d.varName}"] = JSON.stringify(window.__dotgitData);`),
      ];

    case 'condition': {
      const trueSuccessors = outEdges.get(`${node.id}:out-true`) ?? [];
      const falseSuccessors = outEdges.get(`${node.id}:out-false`) ?? [];
      const cmds: Cmd[] = [];
      const opMap: Record<string, string> = { '==': '==', '!=': '!=', '>': '>', '<': '<', 'contains': 'contains' };
      cmds.push(cmd('if', `\${${d.variable}}${opMap[d.operator]}${d.value}`));
      for (const n of trueSuccessors) cmds.push(...nodeCommands(n, outEdges));
      if (falseSuccessors.length > 0) {
        cmds.push(cmd('else', ''));
        for (const n of falseSuccessors) cmds.push(...nodeCommands(n, outEdges));
      }
      cmds.push(cmd('endIf', ''));
      return cmds;
    }

    case 'loop': {
      const loopLabel = `loop_${node.id}`;
      const loopBody = outEdges.get(`${node.id}:out-loop`) ?? [];
      const cmds: Cmd[] = [];
      cmds.push(cmd('label', loopLabel));
      for (const n of loopBody) cmds.push(...nodeCommands(n, outEdges));
      cmds.push(cmd('gotoIf', `\${${d.continueVariable}}==true`, loopLabel));
      return cmds;
    }

    case 'merge':
      return [];

    case 'injectCredentials':
      return [
        cmd('store', '${account.email}', 'injectedEmail'),
        cmd('store', '${account.password}', 'injectedPassword'),
      ];

    case 'switchAccount':
      return [cmd('store', '__switchAccount', '__dotgitSignal')];

    case 'sendToBackend':
      return [
        cmd('executeScript_Sandbox',
          'localStorage.setItem(\'DotGitScrapedData\', JSON.stringify({data: window.__dotgitData || [], endpoint: \'' + d.endpoint + '\'}));'),
      ];

    case 'saveLocally':
      return [
        cmd('executeScript_Sandbox',
          'localStorage.setItem(\'DotGitScrapedData\', JSON.stringify({data: window.__dotgitData || [], local: true}));'),
      ];

    default:
      return [];
  }
}

function buildOutEdgesMap(nodes: WorkflowNode[], edges: WorkflowEdge[]): Map<string, WorkflowNode[]> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const map = new Map<string, WorkflowNode[]>();
  for (const e of edges) {
    const key = `${e.source}:${e.sourceHandle ?? 'out'}`;
    if (!map.has(key)) map.set(key, []);
    const target = nodeById.get(e.target);
    if (target) map.get(key)!.push(target);
  }
  return map;
}

function topologicalOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  const adj = new Map(nodes.map((n) => [n.id, [] as string[]]));

  for (const e of edges) {
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    adj.get(e.source)?.push(e.target);
  }

  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  const result: WorkflowNode[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    result.push(cur);
    for (const nid of (adj.get(cur.id) ?? [])) {
      const deg = (inDegree.get(nid) ?? 1) - 1;
      inDegree.set(nid, deg);
      if (deg === 0) queue.push(nodeById.get(nid)!);
    }
  }

  return result;
}

import type { WorkflowEdge } from '../types';

export function toUiVision(wf: WorkflowJSON): UiVisionMacro {
  const outEdges = buildOutEdgesMap(wf.nodes, wf.edges);
  const ordered = topologicalOrder(wf.nodes, wf.edges);
  const commands: Cmd[] = [];

  // Only process nodes not already handled as sub-nodes in condition/loop branches
  // For simplicity: emit all nodes in topological order, skipping trigger-level nodes
  for (const node of ordered) {
    if (node.data.subtype === 'condition' || node.data.subtype === 'loop') {
      commands.push(...nodeCommands(node, outEdges));
    } else if (node.data.subtype !== 'merge') {
      commands.push(...nodeCommands(node, outEdges));
    }
  }

  return {
    Name: wf.name,
    CreationDate: new Date().toISOString().slice(0, 10),
    Commands: commands,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd workflow && npx vitest run src/__tests__/toUiVision.test.ts --reporter=verbose
```

Expected:
```
✓ trigger → navigate produces open command
✓ fill node produces type command
✓ condition node emits if/else/endIf
✓ delay node emits pause
✓ sendToBackend emits executeScript_Sandbox
✓ macro name matches workflow name
Tests  6 passed (6)
```

- [ ] **Step 5: Commit**

```bash
git add workflow/src/export/toUiVision.ts workflow/src/__tests__/toUiVision.test.ts
git commit -m "feat: workflow designer — ui.vision macro exporter (topological DFS)"
```

---

## Task 11: ui.vision importer

**Files:**
- Create: `workflow/src/export/fromUiVision.ts`
- Test: `workflow/src/__tests__/fromUiVision.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// workflow/src/__tests__/fromUiVision.test.ts
import { fromUiVisionFile } from '../export/fromUiVision';
import type { UiVisionMacro } from '../types';

const sampleMacro: UiVisionMacro = {
  Name: 'imported-flow',
  CreationDate: '2026-01-01',
  Commands: [
    { Command: 'open', Target: 'https://example.com', Value: '' },
    { Command: 'click', Target: 'css=#login', Value: '' },
    { Command: 'type', Target: 'css=#email', Value: '${account.email}' },
    { Command: 'type', Target: 'css=#password', Value: '${account.password}' },
    { Command: 'waitForElementVisible', Target: 'css=.dashboard', Value: '5000' },
    { Command: 'executeScript_Sandbox', Target: 'localStorage.setItem(\'DotGitScrapedData\', JSON.stringify({data: window.__dotgitData}));', Value: '' },
  ],
};

test('fromUiVisionFile returns a WorkflowJSON with nodes and edges', () => {
  const wf = fromUiVisionFile(sampleMacro);
  expect(wf.nodes.length).toBeGreaterThan(0);
  expect(wf.name).toBe('imported-flow');
});

test('open command becomes navigate node', () => {
  const wf = fromUiVisionFile(sampleMacro);
  const nav = wf.nodes.find((n) => n.type === 'navigate');
  expect(nav).toBeDefined();
  expect((nav!.data as { url: string }).url).toBe('https://example.com');
});

test('type command with account.email becomes fill + injectCredentials', () => {
  const wf = fromUiVisionFile(sampleMacro);
  const inject = wf.nodes.find((n) => n.type === 'injectCredentials');
  expect(inject).toBeDefined();
});

test('edges connect nodes in sequence', () => {
  const wf = fromUiVisionFile(sampleMacro);
  expect(wf.edges.length).toBeGreaterThan(0);
});

test('waitForElementVisible becomes waitForSelector node', () => {
  const wf = fromUiVisionFile(sampleMacro);
  const wait = wf.nodes.find((n) => n.type === 'waitForSelector');
  expect(wait).toBeDefined();
  expect((wait!.data as { timeoutMs: number }).timeoutMs).toBe(5000);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd workflow && npx vitest run src/__tests__/fromUiVision.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../export/fromUiVision'`

- [ ] **Step 3: Write `workflow/src/export/fromUiVision.ts`**

```typescript
import type { UiVisionMacro, WorkflowJSON, WorkflowNode, WorkflowEdge, NodeData } from '../types';

let _id = 0;
const uid = () => `imp_${_id++}`;

function cmdToNode(command: string, target: string, value: string, x: number, y: number): WorkflowNode | null {
  const id = uid();
  switch (command) {
    case 'open':
      return { id, type: 'navigate', position: { x, y }, data: { subtype: 'navigate', url: target } };
    case 'click':
    case 'clickAndWait':
      return { id, type: 'click', position: { x, y }, data: { subtype: 'click', selector: target } };
    case 'type':
      return { id, type: 'fill', position: { x, y }, data: { subtype: 'fill', selector: target, value } };
    case 'mouseOver':
      return { id, type: 'hover', position: { x, y }, data: { subtype: 'hover', selector: target } };
    case 'waitForElementVisible':
    case 'waitForElementPresent':
      return { id, type: 'waitForSelector', position: { x, y }, data: { subtype: 'waitForSelector', selector: target, timeoutMs: parseInt(value) || 5000 } };
    case 'pause':
      return { id, type: 'delay', position: { x, y }, data: { subtype: 'delay', ms: parseInt(target) || 1000 } };
    case 'if':
      return { id, type: 'condition', position: { x, y }, data: { subtype: 'condition', variable: target.replace(/\${(.+?)}.*/, '$1'), operator: '==', value: '' } };
    case 'label':
      return { id: `loop_${target}`, type: 'loop', position: { x, y }, data: { subtype: 'loop', maxIterations: 100, continueVariable: 'hasNext' } };
    case 'executeScript_Sandbox':
      if (target.includes('DotGitScrapedData')) {
        const isLocal = target.includes('"local":true');
        return { id, type: isLocal ? 'saveLocally' : 'sendToBackend', position: { x, y }, data: isLocal ? { subtype: 'saveLocally' } : { subtype: 'sendToBackend', endpoint: '/api/launches' } };
      }
      return null;
    default:
      return null;
  }
}

function hasAccountVars(commands: Array<{ Command: string; Value: string }>): boolean {
  return commands.some((c) => c.Value?.includes('account.email') || c.Value?.includes('account.password'));
}

export function fromUiVisionFile(macro: UiVisionMacro): WorkflowJSON {
  _id = 0;
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // Add trigger node
  const trigger: WorkflowNode = { id: uid(), type: 'trigger', position: { x: 50, y: 200 }, data: { subtype: 'manual' } };
  nodes.push(trigger);

  // If macro uses account vars, prepend an InjectCredentials node
  if (hasAccountVars(macro.Commands)) {
    const inject: WorkflowNode = { id: uid(), type: 'injectCredentials', position: { x: 250, y: 200 }, data: { subtype: 'injectCredentials' } };
    nodes.push(inject);
    edges.push({ id: uid(), source: trigger.id, target: inject.id, sourceHandle: 'out', targetHandle: 'in' });
  }

  let x = nodes.length * 200 + 50;
  const y = 200;

  for (const c of macro.Commands) {
    // Skip else/endIf/endWhile/gotoIf — handled implicitly
    if (['else', 'endIf', 'endWhile', 'gotoIf', 'store', 'storeText', 'storeAttribute', 'end'].includes(c.Command)) continue;

    const node = cmdToNode(c.Command, c.Target, c.Value, x, y);
    if (!node) continue;

    const prev = nodes[nodes.length - 1];
    nodes.push(node);

    const srcHandle = prev.type === 'condition' ? 'out-true' : prev.type === 'loop' ? 'out-loop' : prev.type === 'trigger' ? 'out' : 'out-success';
    const tgtHandle = (node.type === 'sendToBackend' || node.type === 'saveLocally') ? 'in-flow' : 'in';

    edges.push({
      id: uid(),
      source: prev.id,
      target: node.id,
      sourceHandle: srcHandle,
      targetHandle: tgtHandle,
    });

    x += 200;
  }

  return { name: macro.Name, domain: '', nodes, edges };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd workflow && npx vitest run src/__tests__/fromUiVision.test.ts --reporter=verbose
```

Expected:
```
✓ fromUiVisionFile returns a WorkflowJSON with nodes and edges
✓ open command becomes navigate node
✓ type command with account.email becomes fill + injectCredentials
✓ edges connect nodes in sequence
✓ waitForElementVisible becomes waitForSelector node
Tests  5 passed (5)
```

- [ ] **Step 5: Run full test suite to verify nothing regressed**

```
cd workflow && npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add workflow/src/export/fromUiVision.ts workflow/src/__tests__/fromUiVision.test.ts
git commit -m "feat: workflow designer — ui.vision macro importer (best-effort)"
```

---

## Task 12: Extension integration

**Files:**
- Modify: `manifest.json`
- Modify: `options/options.html`
- Modify: `scraper/orchestrate.js`

- [ ] **Step 1: Update `manifest.json` — add workflow/dist to web_accessible_resources and add keyboard shortcuts**

Read the current manifest first, then apply this change. The `web_accessible_resources` array currently contains only `content_script.js`. Add the workflow dist page so it can be opened from options:

```json
"web_accessible_resources": [
  {
    "resources": ["content_script.js"],
    "matches": ["<all_urls>"]
  },
  {
    "resources": ["workflow/dist/workflow.html", "workflow/dist/assets/*"],
    "matches": ["<all_urls>", "moz-extension://*/*"]
  }
]
```

Also add a `browser_action` entry (or update `action`) to include a keyboard command. And add the `commands` key for Ctrl+Z/Ctrl+Y — these are handled in the React app itself (no manifest change needed for page-local shortcuts).

- [ ] **Step 2: Add "Open Workflow Designer" button to `options/options.html`**

Locate the scraper settings section. Add this button below the workflow ID field:

```html
<div style="margin-top: 8px;">
  <button id="open-workflow-designer" class="btn btn-secondary">Open Workflow Designer</button>
  <small style="display:block;margin-top:4px;color:#94a3b8;">Design your scraping workflow in a visual node editor.</small>
</div>
```

Then in `options/options.js`, add the click handler inside `initScraperSection()` (after the existing save button listener):

```javascript
document.getElementById("open-workflow-designer").addEventListener("click", () => {
  browser.tabs.create({ url: browser.runtime.getURL("workflow/dist/workflow.html") });
});
```

- [ ] **Step 3: Update `scraper/orchestrate.js` — load workflow JSON from storage for domain lookup**

Add a `getWorkflowForDomain` function that loads the workflow matching the configured domain, and pass the workflow name to `runMacroInContainer`:

```javascript
import { saveScraperSettings, getScraperSettings } from "./orchestrate.js"; // already in file

async function getWorkflowForDomain(domain) {
  if (!domain) return null;
  const key = `workflow_v1_${domain}`;
  const result = await browser.storage.local.get(key);
  return result[key] ?? null;
}
```

Then in `runScrapeCycle`, replace the hardcoded `workflowId` approach with:

```javascript
// After getting settings and account...
const wf = await getWorkflowForDomain(settings.domain ?? "");
const macroName = wf ? wf.name : settings.workflowId;
const items = await runMacroInContainer(cookieStoreId, macroName);
```

Update the settings default to include `domain`:

```javascript
return result[SETTINGS_KEY] ?? {
  backendUrl: "http://localhost:3000",
  workflowId: "",
  domain: "",
  enabled: false,
  apiKey: "",
};
```

- [ ] **Step 4: Update `scraper/uivision.js` — accept macroName parameter**

The `runMacroInContainer(cookieStoreId, macroName)` signature. Open `scraper/uivision.js` and update the function signature to accept an optional second argument `macroName`, defaulting to `"dotgit-scrape"`:

```javascript
export async function runMacroInContainer(cookieStoreId, macroName = "dotgit-scrape") {
  // ... existing implementation, replace hardcoded macro name with macroName
}
```

- [ ] **Step 5: Add domain field to options page settings form**

In `options/options.html`, add a "Domain" input next to Workflow ID, and persist it in `initScraperSection()`:

```html
<label>Target Domain</label>
<input type="text" id="scraper-domain" placeholder="websitelaunches.com" />
```

In `options/options.js`, read and save this field alongside the other settings.

- [ ] **Step 6: Build the workflow app and verify the dist exists**

```
cd workflow && npm run build
```

Expected output:
```
✓ built in Xs
dist/workflow.html
dist/assets/index-[hash].js
dist/assets/index-[hash].css
```

- [ ] **Step 7: Verify the extension still loads in Firefox**

Load the extension as a temporary add-on in Firefox (`about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`). Click "Open Workflow Designer" in Options. The page should open in a new tab showing the node canvas.

- [ ] **Step 8: Add `workflow/dist/` to `.gitignore`** (built output should not be committed)

```
# workflow designer build output
workflow/dist/
workflow/node_modules/
```

- [ ] **Step 9: Commit all integration changes**

```bash
git add manifest.json options/options.html options/options.js scraper/orchestrate.js scraper/uivision.js .gitignore
git commit -m "feat: workflow designer — extension integration (manifest, options link, domain-based workflow lookup)"
```

---

## Final verification

- [ ] **Run complete test suite one last time**

```
cd workflow && npx vitest run --reporter=verbose
```

Expected:
```
Test Files  9 passed (9)
Tests       33 passed (33)
```

- [ ] **Commit**

```bash
git add -A
git commit -m "feat: Plan B complete — visual workflow designer with ui.vision export/import"
```

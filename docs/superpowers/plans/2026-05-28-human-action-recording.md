# Human Action Recording — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the workflow node library from 19 to 46 types and add human action recording — users click Record, interact in a real browser tab, and captured actions auto-populate as an editable node chain.

**Architecture:** Three browser contexts connected by persistent ports: recorder.js content script → background (dotgit.js) buffer/relay → designer tab (App.tsx) live sidebar. On Stop, a filter checklist lets users prune noise before importing.

**Tech Stack:** TypeScript, React 18, Zustand 5, @xyflow/react v12, WebExtension MV3 (Firefox/Chrome), Vite 6, Vitest 2

---

## File Map

| File | Action |
|------|--------|
| `workflow/src/types.ts` | Modify — 27 new subtypes, HANDLE_TYPES, RecordedEvent |
| `workflow/src/nodes/BrowserNode.tsx` | Modify — 8 new browser subtypes |
| `workflow/src/nodes/WaitNode.tsx` | Modify — waitForUrl, waitForVisible |
| `workflow/src/nodes/DataNode.tsx` | Modify — getCurrentUrl, getValue, screenshot, countElements |
| `workflow/src/nodes/ControlNode.tsx` | Modify — forEach, tryCatch |
| `workflow/src/nodes/PageNode.tsx` | **Create** — 7 page/tab subtypes |
| `workflow/src/nodes/VariableNode.tsx` | **Create** — setVariable, setArray, setObject |
| `workflow/src/nodes/HumanNode.tsx` | **Create** — notifyUser |
| `workflow/src/nodes/index.ts` | Modify — register 3 new components |
| `workflow/src/components/Inspector.tsx` | Modify — 27 new form cases |
| `workflow/src/components/NodeLibrary.tsx` | Modify — new palette entries + 3 categories |
| `workflow/src/components/Toolbar.tsx` | Modify — Record/Stop button + recording state |
| `workflow/src/components/RecordingPanel.tsx` | **Create** — live log + filter/import dialog |
| `workflow/src/export/toUiVision.ts` | Modify — 27 new nodeToCommand mappings |
| `workflow/src/store.ts` | Modify — recording state + 5 new actions |
| `workflow/src/recording/eventsToNodes.ts` | **Create** — RecordedEvent[] → {nodes, edges} |
| `workflow/src/recorder.ts` | **Create** — content script event capture |
| `workflow/src/App.tsx` | Modify — RecordingPanel + getDefaultData for 27 subtypes |
| `workflow/src/__tests__/types.test.ts` | Modify — new HANDLE_TYPES keys |
| `workflow/src/__tests__/toUiVision.test.ts` | **Create** — 27 new subtype commands |
| `workflow/src/__tests__/eventsToNodes.test.ts` | **Create** — all 15 recordable event types |
| `workflow/src/__tests__/store.recording.test.ts` | **Create** — recording store actions |
| `workflow/src/test-setup.ts` | Modify — add chrome.runtime mock |
| `workflow/vite.recorder.config.ts` | **Create** — standalone IIFE build for recorder |
| `workflow/package.json` | Modify — add build:recorder script |
| `dotgit.js` | Modify — onConnect handler + RECORDING_START/STOP |
| `manifest.json` | Modify — add recorder.js content script |

---

## Task 1: Extend `workflow/src/types.ts`

**Files:**
- Modify: `workflow/src/types.ts`
- Modify: `workflow/src/__tests__/types.test.ts`

- [ ] **Step 1: Replace types.ts with the extended version**

```typescript
import type { Node, Edge } from '@xyflow/react';

export type PortType = 'flow' | 'data' | 'error';

export type TriggerData =
  | { subtype: 'schedule'; intervalHours: number }
  | { subtype: 'manual' };

export type BrowserData =
  | { subtype: 'navigate'; url: string }
  | { subtype: 'click'; selector: string }
  | { subtype: 'fill'; selector: string; value: string }
  | { subtype: 'scroll'; selector: string; direction: 'down' | 'up'; amount: number }
  | { subtype: 'hover'; selector: string }
  | { subtype: 'doubleClick'; selector: string }
  | { subtype: 'rightClick'; selector: string }
  | { subtype: 'selectOption'; selector: string; value: string }
  | { subtype: 'check'; selector: string; checked: boolean }
  | { subtype: 'pressKey'; key: string }
  | { subtype: 'dragDrop'; sourceSelector: string; targetSelector: string }
  | { subtype: 'uploadFile'; selector: string; fileName: string }
  | { subtype: 'paste'; selector: string; text: string };

export type WaitData =
  | { subtype: 'waitForSelector'; selector: string; timeoutMs: number }
  | { subtype: 'delay'; ms: number }
  | { subtype: 'networkIdle' }
  | { subtype: 'waitForUrl'; pattern: string; timeoutMs: number }
  | { subtype: 'waitForVisible'; selector: string; visible: boolean; timeoutMs: number };

export type DataNodeData =
  | { subtype: 'extract'; fields: Array<{ selector: string; name: string; attr?: string }>; varName: string }
  | { subtype: 'extractTable'; selector: string; varName: string }
  | { subtype: 'getCurrentUrl'; varName: string }
  | { subtype: 'getValue'; selector: string; varName: string }
  | { subtype: 'screenshot'; varName: string }
  | { subtype: 'countElements'; selector: string; varName: string };

export type ControlData =
  | { subtype: 'condition'; variable: string; operator: '==' | '!=' | '>' | '<' | 'contains'; value: string }
  | { subtype: 'loop'; maxIterations: number; continueVariable: string }
  | { subtype: 'merge' }
  | { subtype: 'forEach'; listVar: string; itemVar: string }
  | { subtype: 'tryCatch' };

export type AccountData =
  | { subtype: 'injectCredentials' }
  | { subtype: 'switchAccount' };

export type OutputData =
  | { subtype: 'sendToBackend'; endpoint?: string }
  | { subtype: 'saveLocally' };

export type VariableData =
  | { subtype: 'setVariable'; varName: string; value: string }
  | { subtype: 'setArray'; varName: string; items: string[] }
  | { subtype: 'setObject'; varName: string; pairs: Array<{ key: string; value: string }> };

export type PageData =
  | { subtype: 'goBack' }
  | { subtype: 'goForward' }
  | { subtype: 'reload' }
  | { subtype: 'openTab'; url: string }
  | { subtype: 'closeTab' }
  | { subtype: 'switchTab'; urlPattern: string }
  | { subtype: 'runScript'; script: string; varName?: string };

export type HumanData =
  | { subtype: 'notifyUser'; title: string; message: string; waitForDismiss: boolean };

export type NodeData =
  | TriggerData
  | BrowserData
  | WaitData
  | DataNodeData
  | ControlData
  | AccountData
  | OutputData
  | VariableData
  | PageData
  | HumanData;

export type WorkflowNode = Node<NodeData>;
export type WorkflowEdge = Edge;

export interface WorkflowJSON {
  name: string;
  domain: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

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

export type RecordedEvent = {
  type: 'navigate' | 'click' | 'dblclick' | 'rightClick' | 'fill' | 'selectOption' |
        'check' | 'scroll' | 'hover' | 'pressKey' | 'dragDrop' | 'uploadFile' | 'paste' |
        'goBack' | 'goForward' | 'reload';
  selector: string;
  selectorStrategy: 'id' | 'aria' | 'name' | 'css' | 'xpath';
  value?: string;
  checked?: boolean;
  key?: string;
  targetSelector?: string;
  position?: { x: number; y: number };
  timestamp: number;
  url: string;
  frameId: number;
};

export const HANDLE_TYPES: Record<string, Record<string, PortType>> = {
  // Triggers
  trigger:    { 'out': 'flow' },
  schedule:   { 'out': 'flow' },
  manual:     { 'out': 'flow' },
  // Browser (existing)
  navigate:   { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  click:      { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  fill:       { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  scroll:     { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  hover:      { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  // Browser (new)
  doubleClick:  { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  rightClick:   { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  selectOption: { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  check:        { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  pressKey:     { 'in': 'flow', 'out': 'flow' },
  dragDrop:     { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  uploadFile:   { 'in': 'flow', 'out-success': 'flow', 'out-error': 'error' },
  paste:        { 'in': 'flow', 'out': 'flow' },
  // Wait (existing)
  waitForSelector: { 'in': 'flow', 'out': 'flow' },
  delay:           { 'in': 'flow', 'out': 'flow' },
  networkIdle:     { 'in': 'flow', 'out': 'flow' },
  // Wait (new)
  waitForUrl:     { 'in': 'flow', 'out': 'flow' },
  waitForVisible: { 'in': 'flow', 'out': 'flow' },
  // Data (existing)
  extract:      { 'in': 'flow', 'out': 'data' },
  extractTable: { 'in': 'flow', 'out': 'data' },
  // Data (new)
  getCurrentUrl: { 'in': 'flow', 'out': 'data' },
  getValue:      { 'in': 'flow', 'out': 'data' },
  screenshot:    { 'in': 'flow', 'out': 'data' },
  countElements: { 'in': 'flow', 'out': 'data' },
  // Control (existing)
  condition: { 'in': 'flow', 'in-data': 'data', 'out-true': 'flow', 'out-false': 'flow' },
  loop:      { 'in': 'flow', 'out-loop': 'flow', 'out-done': 'flow' },
  merge:     { 'in-a': 'flow', 'in-b': 'flow', 'in-err': 'error', 'out': 'flow' },
  // Control (new)
  forEach:  { 'in': 'flow', 'out-loop': 'flow', 'out-done': 'flow' },
  tryCatch: { 'in': 'flow', 'out-try': 'flow', 'out-catch': 'flow' },
  // Account + Output (existing)
  injectCredentials: { 'in': 'flow', 'out': 'flow' },
  switchAccount:     { 'in': 'flow', 'out': 'flow' },
  sendToBackend: { 'in-flow': 'flow', 'in-data': 'data', 'out-success': 'flow', 'out-error': 'error' },
  saveLocally:   { 'in-flow': 'flow', 'in-data': 'data', 'out': 'flow' },
  // Variable (new)
  setVariable: { 'in': 'flow', 'out': 'flow' },
  setArray:    { 'in': 'flow', 'out': 'data' },
  setObject:   { 'in': 'flow', 'out': 'data' },
  // Page/Tab (new)
  goBack:    { 'in': 'flow', 'out': 'flow' },
  goForward: { 'in': 'flow', 'out': 'flow' },
  reload:    { 'in': 'flow', 'out': 'flow' },
  openTab:   { 'in': 'flow', 'out': 'flow' },
  closeTab:  { 'in': 'flow', 'out': 'flow' },
  switchTab: { 'in': 'flow', 'out': 'flow' },
  runScript: { 'in': 'flow', 'out': 'data' },
  // Human (new)
  notifyUser: { 'in': 'flow', 'out': 'flow' },
};

export function portsCompatible(
  sourceNodeType: string,
  sourceHandleId: string,
  targetNodeType: string,
  targetHandleId: string,
): boolean {
  const srcType = HANDLE_TYPES[sourceNodeType]?.[sourceHandleId];
  const tgtType = HANDLE_TYPES[targetNodeType]?.[targetHandleId];
  if (!srcType || !tgtType) return true;
  return srcType === tgtType;
}
```

- [ ] **Step 2: Update the HANDLE_TYPES coverage test in `workflow/src/__tests__/types.test.ts`**

Replace the `'HANDLE_TYPES covers all node types'` test:

```typescript
test('HANDLE_TYPES covers all node types', () => {
  const expectedKeys = [
    'trigger', 'schedule', 'manual',
    'navigate', 'click', 'fill', 'scroll', 'hover',
    'doubleClick', 'rightClick', 'selectOption', 'check', 'pressKey', 'dragDrop', 'uploadFile', 'paste',
    'waitForSelector', 'delay', 'networkIdle', 'waitForUrl', 'waitForVisible',
    'extract', 'extractTable', 'getCurrentUrl', 'getValue', 'screenshot', 'countElements',
    'condition', 'loop', 'merge', 'forEach', 'tryCatch',
    'injectCredentials', 'switchAccount',
    'sendToBackend', 'saveLocally',
    'setVariable', 'setArray', 'setObject',
    'goBack', 'goForward', 'reload', 'openTab', 'closeTab', 'switchTab', 'runScript',
    'notifyUser',
  ];
  expect(Object.keys(HANDLE_TYPES).sort()).toEqual(expectedKeys.sort());
});
```

- [ ] **Step 3: Run tests — expect pass**

```
cd workflow && npm test -- --reporter=verbose src/__tests__/types.test.ts
```

Expected: `6 tests passed`

- [ ] **Step 4: Commit**

```
git add workflow/src/types.ts workflow/src/__tests__/types.test.ts
git commit -m "feat: extend NodeData with 27 new subtypes, HANDLE_TYPES, RecordedEvent"
```

---

## Task 2: Create New Node Components

**Files:**
- Create: `workflow/src/nodes/PageNode.tsx`
- Create: `workflow/src/nodes/VariableNode.tsx`
- Create: `workflow/src/nodes/HumanNode.tsx`

- [ ] **Step 1: Create `workflow/src/nodes/PageNode.tsx`**

```typescript
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PageData } from '../types';

const HEADER: Record<PageData['subtype'], string> = {
  goBack:    'Go Back',
  goForward: 'Go Forward',
  reload:    'Reload',
  openTab:   'Open Tab',
  closeTab:  'Close Tab',
  switchTab: 'Switch Tab',
  runScript: 'Run Script',
};

const LABEL = (d: PageData): string => {
  switch (d.subtype) {
    case 'openTab':   return d.url || '(url)';
    case 'switchTab': return d.urlPattern || '(pattern)';
    case 'runScript': return d.varName ? `→ ${d.varName}` : '(script)';
    default:          return '';
  }
};

export function PageNode({ data, selected }: NodeProps & { data: PageData }) {
  const hasDataOut = data.subtype === 'runScript';
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#ec4899' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#ec4899' }}>{HEADER[data.subtype]}</div>
      <div className="wf-node-label">{LABEL(data)}</div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={hasDataOut ? { background: '#34d399' } : undefined}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `workflow/src/nodes/VariableNode.tsx`**

```typescript
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VariableData } from '../types';

const HEADER: Record<VariableData['subtype'], string> = {
  setVariable: 'Set Variable',
  setArray:    'Set Array',
  setObject:   'Set Object',
};

const LABEL = (d: VariableData): string => {
  switch (d.subtype) {
    case 'setVariable': return `${d.varName} = ${d.value || '…'}`;
    case 'setArray':    return `${d.varName} [${d.items.length} items]`;
    case 'setObject':   return `${d.varName} {${d.pairs.length} keys}`;
  }
};

export function VariableNode({ data, selected }: NodeProps & { data: VariableData }) {
  const isData = data.subtype === 'setArray' || data.subtype === 'setObject';
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#06b6d4' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#06b6d4' }}>{HEADER[data.subtype]}</div>
      <div className="wf-node-label">{LABEL(data)}</div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={isData ? { background: '#34d399' } : undefined}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `workflow/src/nodes/HumanNode.tsx`**

```typescript
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { HumanData } from '../types';

export function HumanNode({ data, selected }: NodeProps & { data: HumanData }) {
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#f97316' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#f97316' }}>Notify User</div>
      <div className="wf-node-label">
        {data.title || '(title)'}
        {data.waitForDismiss && ' ⏸'}
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```
git add workflow/src/nodes/PageNode.tsx workflow/src/nodes/VariableNode.tsx workflow/src/nodes/HumanNode.tsx
git commit -m "feat: add PageNode, VariableNode, HumanNode components"
```

---

## Task 3: Extend Existing Node Components

**Files:**
- Modify: `workflow/src/nodes/BrowserNode.tsx`
- Modify: `workflow/src/nodes/WaitNode.tsx`
- Modify: `workflow/src/nodes/DataNode.tsx`
- Modify: `workflow/src/nodes/ControlNode.tsx`

- [ ] **Step 1: Replace `workflow/src/nodes/BrowserNode.tsx`**

```typescript
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BrowserData } from '../types';

const LABELS: Record<BrowserData['subtype'], string> = {
  navigate:     'Navigate',
  click:        'Click',
  fill:         'Fill',
  scroll:       'Scroll',
  hover:        'Hover',
  doubleClick:  'Double Click',
  rightClick:   'Right Click',
  selectOption: 'Select Option',
  check:        'Check',
  pressKey:     'Press Key',
  dragDrop:     'Drag & Drop',
  uploadFile:   'Upload File',
  paste:        'Paste',
};

const DETAIL = (d: BrowserData): string => {
  switch (d.subtype) {
    case 'navigate':     return d.url || '(url)';
    case 'click':        return d.selector || '(selector)';
    case 'fill':         return `${d.selector || '(selector)'} → ${d.value || '…'}`;
    case 'scroll':       return `${d.selector || '(selector)'} ${d.direction} ${d.amount}px`;
    case 'hover':        return d.selector || '(selector)';
    case 'doubleClick':  return d.selector || '(selector)';
    case 'rightClick':   return d.selector || '(selector)';
    case 'selectOption': return `${d.selector || '(selector)'} = ${d.value || '…'}`;
    case 'check':        return `${d.selector || '(selector)'} ${d.checked ? '☑' : '☐'}`;
    case 'pressKey':     return d.key || '(key)';
    case 'dragDrop':     return `${d.sourceSelector || '(src)'} → ${d.targetSelector || '(tgt)'}`;
    case 'uploadFile':   return `${d.selector || '(selector)'} — ${d.fileName || '(file)'}`;
    case 'paste':        return `${d.selector || '(selector)'} ← clipboard`;
  }
};

const NO_ERR = new Set<BrowserData['subtype']>(['pressKey', 'paste']);

export function BrowserNode({ data, selected }: NodeProps & { data: BrowserData }) {
  const hasError = !NO_ERR.has(data.subtype);
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#3b82f6' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#3b82f6' }}>{LABELS[data.subtype]}</div>
      <div className="wf-node-label">{DETAIL(data)}</div>
      {hasError ? (
        <>
          <Handle type="source" position={Position.Right} id="out-success" style={{ top: '40%' }} />
          <Handle type="source" position={Position.Right} id="out-error" style={{ top: '70%', background: '#e94560' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="out" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `workflow/src/nodes/WaitNode.tsx`**

```typescript
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WaitData } from '../types';

const HEADER = (d: WaitData): string => {
  switch (d.subtype) {
    case 'waitForSelector': return 'Wait Selector';
    case 'delay':           return 'Delay';
    case 'networkIdle':     return 'Network Idle';
    case 'waitForUrl':      return 'Wait for URL';
    case 'waitForVisible':  return 'Wait Visible';
  }
};

const LABEL = (d: WaitData): string => {
  switch (d.subtype) {
    case 'waitForSelector': return `${d.selector} (${d.timeoutMs}ms)`;
    case 'delay':           return `${d.ms}ms`;
    case 'networkIdle':     return 'Network Idle';
    case 'waitForUrl':      return `${d.pattern} (${d.timeoutMs}ms)`;
    case 'waitForVisible':  return `${d.selector} ${d.visible ? 'visible' : 'hidden'}`;
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

- [ ] **Step 3: Replace `workflow/src/nodes/DataNode.tsx`**

```typescript
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DataNodeData } from '../types';

const HEADER = (d: DataNodeData): string => {
  switch (d.subtype) {
    case 'extract':       return 'Extract';
    case 'extractTable':  return 'Extract Table';
    case 'getCurrentUrl': return 'Get URL';
    case 'getValue':      return 'Get Value';
    case 'screenshot':    return 'Screenshot';
    case 'countElements': return 'Count Elements';
  }
};

const LABEL = (d: DataNodeData): string => {
  switch (d.subtype) {
    case 'extract':       return `${d.fields.length} field(s) → ${d.varName}`;
    case 'extractTable':  return `${d.selector} → ${d.varName}`;
    case 'getCurrentUrl': return `→ ${d.varName}`;
    case 'getValue':      return `${d.selector} → ${d.varName}`;
    case 'screenshot':    return `→ ${d.varName}`;
    case 'countElements': return `${d.selector} → ${d.varName}`;
  }
};

export function DataNode({ data, selected }: NodeProps & { data: DataNodeData }) {
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#34d399' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#34d399' }}>{HEADER(data)}</div>
      <div className="wf-node-label">{LABEL(data)}</div>
      <Handle type="source" position={Position.Right} id="out" style={{ background: '#34d399' }} />
    </div>
  );
}
```

- [ ] **Step 4: Add `forEach` and `tryCatch` to `workflow/src/nodes/ControlNode.tsx`**

In `ControlNode.tsx`, before the final `// merge` return block, add:

```typescript
  if (data.subtype === 'forEach') {
    return (
      <div className={`wf-node wf-loop-node${selected ? ' selected' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="wf-node-header" style={{ color: '#e94560' }}>For Each</div>
        <div className="wf-node-label">{data.listVar} → {data.itemVar}</div>
        <Handle type="source" position={Position.Right} id="out-loop" style={{ top: '40%' }} />
        <Handle type="source" position={Position.Right} id="out-done" style={{ top: '70%', background: '#34d399' }} />
      </div>
    );
  }

  if (data.subtype === 'tryCatch') {
    return (
      <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#f97316' }}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="wf-node-header" style={{ color: '#f97316' }}>Try / Catch</div>
        <Handle type="source" position={Position.Right} id="out-try" style={{ top: '40%' }} />
        <Handle type="source" position={Position.Right} id="out-catch" style={{ top: '70%', background: '#e94560' }} />
      </div>
    );
  }
```

- [ ] **Step 5: Commit**

```
git add workflow/src/nodes/
git commit -m "feat: extend BrowserNode, WaitNode, DataNode, ControlNode with new subtypes"
```

---

## Task 4: Update `workflow/src/nodes/index.ts`

**Files:**
- Modify: `workflow/src/nodes/index.ts`

- [ ] **Step 1: Replace index.ts**

```typescript
import type { NodeTypes, NodeProps } from '@xyflow/react';
import type { ComponentType } from 'react';
import { TriggerNode } from './TriggerNode';
import { BrowserNode } from './BrowserNode';
import { WaitNode } from './WaitNode';
import { DataNode } from './DataNode';
import { ControlNode } from './ControlNode';
import { AccountNode } from './AccountNode';
import { OutputNode } from './OutputNode';
import { PageNode } from './PageNode';
import { VariableNode } from './VariableNode';
import { HumanNode } from './HumanNode';
import type {
  TriggerData, BrowserData, WaitData, DataNodeData,
  ControlData, AccountData, OutputData, PageData, VariableData, HumanData,
} from '../types';

function asNodeType<T>(c: ComponentType<NodeProps & { data: T }>): NodeTypes[string] {
  return c as NodeTypes[string];
}

export const nodeTypes: NodeTypes = {
  trigger: asNodeType<TriggerData>(TriggerNode),
  schedule: asNodeType<TriggerData>(TriggerNode),
  manual: asNodeType<TriggerData>(TriggerNode),
  navigate: asNodeType<BrowserData>(BrowserNode),
  click: asNodeType<BrowserData>(BrowserNode),
  fill: asNodeType<BrowserData>(BrowserNode),
  scroll: asNodeType<BrowserData>(BrowserNode),
  hover: asNodeType<BrowserData>(BrowserNode),
  doubleClick: asNodeType<BrowserData>(BrowserNode),
  rightClick: asNodeType<BrowserData>(BrowserNode),
  selectOption: asNodeType<BrowserData>(BrowserNode),
  check: asNodeType<BrowserData>(BrowserNode),
  pressKey: asNodeType<BrowserData>(BrowserNode),
  dragDrop: asNodeType<BrowserData>(BrowserNode),
  uploadFile: asNodeType<BrowserData>(BrowserNode),
  paste: asNodeType<BrowserData>(BrowserNode),
  waitForSelector: asNodeType<WaitData>(WaitNode),
  delay: asNodeType<WaitData>(WaitNode),
  networkIdle: asNodeType<WaitData>(WaitNode),
  waitForUrl: asNodeType<WaitData>(WaitNode),
  waitForVisible: asNodeType<WaitData>(WaitNode),
  extract: asNodeType<DataNodeData>(DataNode),
  extractTable: asNodeType<DataNodeData>(DataNode),
  getCurrentUrl: asNodeType<DataNodeData>(DataNode),
  getValue: asNodeType<DataNodeData>(DataNode),
  screenshot: asNodeType<DataNodeData>(DataNode),
  countElements: asNodeType<DataNodeData>(DataNode),
  condition: asNodeType<ControlData>(ControlNode),
  loop: asNodeType<ControlData>(ControlNode),
  merge: asNodeType<ControlData>(ControlNode),
  forEach: asNodeType<ControlData>(ControlNode),
  tryCatch: asNodeType<ControlData>(ControlNode),
  injectCredentials: asNodeType<AccountData>(AccountNode),
  switchAccount: asNodeType<AccountData>(AccountNode),
  sendToBackend: asNodeType<OutputData>(OutputNode),
  saveLocally: asNodeType<OutputData>(OutputNode),
  setVariable: asNodeType<VariableData>(VariableNode),
  setArray: asNodeType<VariableData>(VariableNode),
  setObject: asNodeType<VariableData>(VariableNode),
  goBack: asNodeType<PageData>(PageNode),
  goForward: asNodeType<PageData>(PageNode),
  reload: asNodeType<PageData>(PageNode),
  openTab: asNodeType<PageData>(PageNode),
  closeTab: asNodeType<PageData>(PageNode),
  switchTab: asNodeType<PageData>(PageNode),
  runScript: asNodeType<PageData>(PageNode),
  notifyUser: asNodeType<HumanData>(HumanNode),
};
```

- [ ] **Step 2: Commit**

```
git add workflow/src/nodes/index.ts
git commit -m "feat: register 27 new node types in nodeTypes map"
```

---

## Task 5: Extend `workflow/src/components/Inspector.tsx`

**Files:**
- Modify: `workflow/src/components/Inspector.tsx`

- [ ] **Step 1: Add the 27 new cases to the `NodeForm` switch**

In `Inspector.tsx`, after the `case 'hover':` block and before the `// ── Wait` comment, add:

```typescript
    case 'doubleClick':
      return (
        <Field label="Selector">
          <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
            onChange={(e) => onChange({ ...d, selector: e.target.value })} />
        </Field>
      );
    case 'rightClick':
      return (
        <Field label="Selector">
          <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
            onChange={(e) => onChange({ ...d, selector: e.target.value })} />
        </Field>
      );
    case 'selectOption':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Value">
            <input type="text" data-testid="value" style={inputStyle} value={d.value}
              onChange={(e) => onChange({ ...d, value: e.target.value })} />
          </Field>
        </>
      );
    case 'check':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Checked">
            <select data-testid="checked" style={inputStyle} value={String(d.checked)}
              onChange={(e) => onChange({ ...d, checked: e.target.value === 'true' })}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </Field>
        </>
      );
    case 'pressKey':
      return (
        <Field label="Key (e.g. Enter, Control+a)">
          <input type="text" data-testid="key" style={inputStyle} value={d.key}
            onChange={(e) => onChange({ ...d, key: e.target.value })} />
        </Field>
      );
    case 'dragDrop':
      return (
        <>
          <Field label="Source selector">
            <input type="text" data-testid="sourceSelector" style={inputStyle} value={d.sourceSelector}
              onChange={(e) => onChange({ ...d, sourceSelector: e.target.value })} />
          </Field>
          <Field label="Target selector">
            <input type="text" data-testid="targetSelector" style={inputStyle} value={d.targetSelector}
              onChange={(e) => onChange({ ...d, targetSelector: e.target.value })} />
          </Field>
        </>
      );
    case 'uploadFile':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="File name">
            <input type="text" data-testid="fileName" style={inputStyle} value={d.fileName}
              onChange={(e) => onChange({ ...d, fileName: e.target.value })} />
          </Field>
        </>
      );
    case 'paste':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Text">
            <input type="text" data-testid="text" style={inputStyle} value={d.text}
              onChange={(e) => onChange({ ...d, text: e.target.value })} />
          </Field>
        </>
      );
```

After `case 'networkIdle':` and before `// ── Data`, add:

```typescript
    case 'waitForUrl':
      return (
        <>
          <Field label="URL pattern">
            <input type="text" data-testid="pattern" style={inputStyle} value={d.pattern}
              onChange={(e) => onChange({ ...d, pattern: e.target.value })} />
          </Field>
          <Field label="Timeout (ms)">
            <input type="number" data-testid="timeoutMs" style={inputStyle} value={d.timeoutMs}
              onChange={(e) => onChange({ ...d, timeoutMs: Number(e.target.value) })} />
          </Field>
        </>
      );
    case 'waitForVisible':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Visible">
            <select data-testid="visible" style={inputStyle} value={String(d.visible)}
              onChange={(e) => onChange({ ...d, visible: e.target.value === 'true' })}>
              <option value="true">visible</option>
              <option value="false">hidden</option>
            </select>
          </Field>
          <Field label="Timeout (ms)">
            <input type="number" data-testid="timeoutMs" style={inputStyle} value={d.timeoutMs}
              onChange={(e) => onChange({ ...d, timeoutMs: Number(e.target.value) })} />
          </Field>
        </>
      );
```

After `case 'extractTable':` and before `// ── Control`, add:

```typescript
    case 'getCurrentUrl':
      return (
        <Field label="Variable name">
          <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
            onChange={(e) => onChange({ ...d, varName: e.target.value })} />
        </Field>
      );
    case 'getValue':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
          </Field>
        </>
      );
    case 'screenshot':
      return (
        <Field label="Variable name">
          <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
            onChange={(e) => onChange({ ...d, varName: e.target.value })} />
        </Field>
      );
    case 'countElements':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
          </Field>
        </>
      );
```

After `case 'merge':` and before `// ── Account`, add:

```typescript
    case 'forEach':
      return (
        <>
          <Field label="List variable">
            <input type="text" data-testid="listVar" style={inputStyle} value={d.listVar}
              onChange={(e) => onChange({ ...d, listVar: e.target.value })} />
          </Field>
          <Field label="Item variable">
            <input type="text" data-testid="itemVar" style={inputStyle} value={d.itemVar}
              onChange={(e) => onChange({ ...d, itemVar: e.target.value })} />
          </Field>
        </>
      );
    case 'tryCatch':
      return <div style={{ color: '#64748b', fontSize: 13 }}>(no configuration)</div>;
```

After `case 'saveLocally':` and before `default:`, add:

```typescript
    // ── Variable ─────────────────────────────────────────────────────────────
    case 'setVariable':
      return (
        <>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
          </Field>
          <Field label="Value (supports ${varName})">
            <input type="text" data-testid="value" style={inputStyle} value={d.value}
              onChange={(e) => onChange({ ...d, value: e.target.value })} />
          </Field>
        </>
      );
    case 'setArray':
      return (
        <>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
          </Field>
          <Field label="Items (one per line)">
            <textarea
              data-testid="items"
              style={{ ...inputStyle, height: 80, resize: 'vertical' }}
              value={d.items.join('\n')}
              onChange={(e) => onChange({ ...d, items: e.target.value.split('\n') })}
            />
          </Field>
        </>
      );
    case 'setObject':
      return (
        <>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
          </Field>
          <Field label="Key-value pairs">
            {d.pairs.map((pair, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="key"
                  value={pair.key}
                  onChange={(e) => {
                    const pairs = d.pairs.map((p, j) => j === i ? { ...p, key: e.target.value } : p);
                    onChange({ ...d, pairs });
                  }}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="value"
                  value={pair.value}
                  onChange={(e) => {
                    const pairs = d.pairs.map((p, j) => j === i ? { ...p, value: e.target.value } : p);
                    onChange({ ...d, pairs });
                  }}
                />
              </div>
            ))}
            <button
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 3, padding: '2px 8px', fontSize: 12, cursor: 'pointer', marginTop: 2 }}
              onClick={() => onChange({ ...d, pairs: [...d.pairs, { key: '', value: '' }] })}
            >
              + Add pair
            </button>
          </Field>
        </>
      );
    // ── Page / Tab ────────────────────────────────────────────────────────────
    case 'goBack':
    case 'goForward':
    case 'reload':
    case 'closeTab':
      return <div style={{ color: '#64748b', fontSize: 13 }}>(no configuration)</div>;
    case 'openTab':
      return (
        <Field label="URL">
          <input type="text" data-testid="url" style={inputStyle} value={d.url}
            onChange={(e) => onChange({ ...d, url: e.target.value })} />
        </Field>
      );
    case 'switchTab':
      return (
        <Field label="URL pattern">
          <input type="text" data-testid="urlPattern" style={inputStyle} value={d.urlPattern}
            onChange={(e) => onChange({ ...d, urlPattern: e.target.value })} />
        </Field>
      );
    case 'runScript':
      return (
        <>
          <Field label="Script (JS)">
            <textarea
              data-testid="script"
              style={{ ...inputStyle, height: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
              value={d.script}
              onChange={(e) => onChange({ ...d, script: e.target.value })}
            />
          </Field>
          <Field label="Store result in variable (optional)">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName ?? ''}
              onChange={(e) => onChange({ ...d, varName: e.target.value || undefined })} />
          </Field>
        </>
      );
    // ── Human ─────────────────────────────────────────────────────────────────
    case 'notifyUser':
      return (
        <>
          <Field label="Title">
            <input type="text" data-testid="title" style={inputStyle} value={d.title}
              onChange={(e) => onChange({ ...d, title: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea data-testid="message" style={{ ...inputStyle, height: 60, resize: 'vertical' }}
              value={d.message} onChange={(e) => onChange({ ...d, message: e.target.value })} />
          </Field>
          <Field label="Wait for dismiss">
            <select data-testid="waitForDismiss" style={inputStyle} value={String(d.waitForDismiss)}
              onChange={(e) => onChange({ ...d, waitForDismiss: e.target.value === 'true' })}>
              <option value="true">Yes — pause execution</option>
              <option value="false">No — continue immediately</option>
            </select>
          </Field>
        </>
      );
```

- [ ] **Step 2: Commit**

```
git add workflow/src/components/Inspector.tsx
git commit -m "feat: add Inspector form fields for all 27 new node subtypes"
```

---

## Task 6: Extend `NodeLibrary.tsx` and `App.tsx`

**Files:**
- Modify: `workflow/src/components/NodeLibrary.tsx`
- Modify: `workflow/src/App.tsx`

- [ ] **Step 1: Add new entries to `NODE_TYPES` in `NodeLibrary.tsx`**

After the `{ type: 'hover', ... }` entry, add:

```typescript
  { type: 'doubleClick',  label: 'Double click',   category: 'Browser',   color: '#3b82f6' },
  { type: 'rightClick',   label: 'Right click',    category: 'Browser',   color: '#3b82f6' },
  { type: 'selectOption', label: 'Select option',  category: 'Browser',   color: '#3b82f6' },
  { type: 'check',        label: 'Check',          category: 'Browser',   color: '#3b82f6' },
  { type: 'pressKey',     label: 'Press key',      category: 'Browser',   color: '#3b82f6' },
  { type: 'dragDrop',     label: 'Drag & drop',    category: 'Browser',   color: '#3b82f6' },
  { type: 'uploadFile',   label: 'Upload file',    category: 'Browser',   color: '#3b82f6' },
  { type: 'paste',        label: 'Paste',          category: 'Browser',   color: '#3b82f6' },
```

After `{ type: 'networkIdle', ... }`, add:

```typescript
  { type: 'waitForUrl',     label: 'Wait for URL',     category: 'Wait', color: '#f59e0b' },
  { type: 'waitForVisible', label: 'Wait visible',     category: 'Wait', color: '#f59e0b' },
```

After `{ type: 'extractTable', ... }`, add:

```typescript
  { type: 'getCurrentUrl', label: 'Get current URL',  category: 'Data', color: '#8b5cf6' },
  { type: 'getValue',      label: 'Get value',        category: 'Data', color: '#8b5cf6' },
  { type: 'screenshot',    label: 'Screenshot',       category: 'Data', color: '#8b5cf6' },
  { type: 'countElements', label: 'Count elements',   category: 'Data', color: '#8b5cf6' },
```

After `{ type: 'merge', ... }`, add:

```typescript
  { type: 'forEach',  label: 'For each', category: 'Control', color: '#94a3b8' },
  { type: 'tryCatch', label: 'Try/Catch', category: 'Control', color: '#94a3b8' },
```

After `{ type: 'saveLocally', ... }`, add:

```typescript
  { type: 'setVariable', label: 'Set variable', category: 'Variables', color: '#06b6d4' },
  { type: 'setArray',    label: 'Set array',    category: 'Variables', color: '#06b6d4' },
  { type: 'setObject',   label: 'Set object',   category: 'Variables', color: '#06b6d4' },
  { type: 'goBack',      label: 'Go back',      category: 'Page',      color: '#ec4899' },
  { type: 'goForward',   label: 'Go forward',   category: 'Page',      color: '#ec4899' },
  { type: 'reload',      label: 'Reload',       category: 'Page',      color: '#ec4899' },
  { type: 'openTab',     label: 'Open tab',     category: 'Page',      color: '#ec4899' },
  { type: 'closeTab',    label: 'Close tab',    category: 'Page',      color: '#ec4899' },
  { type: 'switchTab',   label: 'Switch tab',   category: 'Page',      color: '#ec4899' },
  { type: 'runScript',   label: 'Run script',   category: 'Page',      color: '#ec4899' },
  { type: 'notifyUser',  label: 'Notify user',  category: 'Human',     color: '#f97316' },
```

- [ ] **Step 2: Extend `getDefaultData` in `workflow/src/App.tsx`**

After the `case 'saveLocally':` line in `getDefaultData`, add before `default:`:

```typescript
    case 'doubleClick':   return { subtype: 'doubleClick', selector: '' };
    case 'rightClick':    return { subtype: 'rightClick', selector: '' };
    case 'selectOption':  return { subtype: 'selectOption', selector: '', value: '' };
    case 'check':         return { subtype: 'check', selector: '', checked: true };
    case 'pressKey':      return { subtype: 'pressKey', key: 'Enter' };
    case 'dragDrop':      return { subtype: 'dragDrop', sourceSelector: '', targetSelector: '' };
    case 'uploadFile':    return { subtype: 'uploadFile', selector: '', fileName: '' };
    case 'paste':         return { subtype: 'paste', selector: '', text: '' };
    case 'waitForUrl':    return { subtype: 'waitForUrl', pattern: '', timeoutMs: 5000 };
    case 'waitForVisible': return { subtype: 'waitForVisible', selector: '', visible: true, timeoutMs: 5000 };
    case 'getCurrentUrl': return { subtype: 'getCurrentUrl', varName: '' };
    case 'getValue':      return { subtype: 'getValue', selector: '', varName: '' };
    case 'screenshot':    return { subtype: 'screenshot', varName: '' };
    case 'countElements': return { subtype: 'countElements', selector: '', varName: '' };
    case 'forEach':       return { subtype: 'forEach', listVar: '', itemVar: 'item' };
    case 'tryCatch':      return { subtype: 'tryCatch' };
    case 'setVariable':   return { subtype: 'setVariable', varName: '', value: '' };
    case 'setArray':      return { subtype: 'setArray', varName: '', items: [] };
    case 'setObject':     return { subtype: 'setObject', varName: '', pairs: [] };
    case 'goBack':        return { subtype: 'goBack' };
    case 'goForward':     return { subtype: 'goForward' };
    case 'reload':        return { subtype: 'reload' };
    case 'openTab':       return { subtype: 'openTab', url: '' };
    case 'closeTab':      return { subtype: 'closeTab' };
    case 'switchTab':     return { subtype: 'switchTab', urlPattern: '' };
    case 'runScript':     return { subtype: 'runScript', script: '' };
    case 'notifyUser':    return { subtype: 'notifyUser', title: '', message: '', waitForDismiss: false };
```

- [ ] **Step 3: Commit**

```
git add workflow/src/components/NodeLibrary.tsx workflow/src/App.tsx
git commit -m "feat: add 27 new node types to palette and drag-drop defaults"
```

---

## Task 7: Extend `workflow/src/export/toUiVision.ts`

**Files:**
- Modify: `workflow/src/export/toUiVision.ts`
- Create: `workflow/src/__tests__/toUiVision.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `workflow/src/__tests__/toUiVision.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toUiVision } from '../export/toUiVision';
import type { WorkflowNode } from '../types';

function node(type: string, data: Record<string, unknown>): WorkflowNode {
  return { id: '1', type, position: { x: 0, y: 0 }, data: { subtype: type, ...data } } as WorkflowNode;
}

function cmd(type: string, data: Record<string, unknown>) {
  return toUiVision('t', [node(type, data)], []).Commands[0];
}

describe('toUiVision new browser subtypes', () => {
  it('doubleClick', () => {
    const c = cmd('doubleClick', { selector: '#btn' });
    expect(c.Command).toBe('doubleClick');
    expect(c.Target).toBe('#btn');
  });
  it('rightClick', () => {
    expect(cmd('rightClick', { selector: '#el' }).Command).toBe('rightClickAt');
  });
  it('selectOption', () => {
    const c = cmd('selectOption', { selector: 'select', value: 'opt1' });
    expect(c.Command).toBe('select');
    expect(c.Value).toBe('opt1');
  });
  it('check (checked=true)', () => {
    expect(cmd('check', { selector: '#cb', checked: true }).Command).toBe('check');
  });
  it('check (checked=false)', () => {
    expect(cmd('check', { selector: '#cb', checked: false }).Command).toBe('uncheck');
  });
  it('pressKey', () => {
    const c = cmd('pressKey', { key: 'Enter' });
    expect(c.Command).toBe('sendKeys');
    expect(c.Value).toBe('Enter');
  });
  it('dragDrop', () => {
    const c = cmd('dragDrop', { sourceSelector: '#src', targetSelector: '#tgt' });
    expect(c.Command).toBe('dragAndDropToObject');
    expect(c.Value).toBe('#tgt');
  });
  it('uploadFile', () => {
    const c = cmd('uploadFile', { selector: 'input[type=file]', fileName: 'test.pdf' });
    expect(c.Command).toBe('type');
    expect(c.Value).toBe('test.pdf');
  });
  it('paste', () => {
    const c = cmd('paste', { selector: '#el', text: 'hello' });
    expect(c.Command).toBe('type');
    expect(c.Value).toBe('hello');
  });
});

describe('toUiVision wait subtypes', () => {
  it('waitForUrl', () => {
    const c = cmd('waitForUrl', { pattern: '*/dashboard', timeoutMs: 5000 });
    expect(c.Command).toBe('waitForCondition');
    expect(c.Target).toBe('*/dashboard');
    expect(c.Value).toBe('5000');
  });
  it('waitForVisible (visible)', () => {
    expect(cmd('waitForVisible', { selector: '#el', visible: true, timeoutMs: 3000 }).Command)
      .toBe('waitForElementVisible');
  });
  it('waitForVisible (hidden)', () => {
    expect(cmd('waitForVisible', { selector: '#el', visible: false, timeoutMs: 3000 }).Command)
      .toBe('waitForElementNotPresent');
  });
});

describe('toUiVision data subtypes', () => {
  it('getCurrentUrl', () => {
    expect(cmd('getCurrentUrl', { varName: 'myUrl' }).Command).toBe('storeLocation');
  });
  it('getValue', () => {
    const c = cmd('getValue', { selector: '#inp', varName: 'v' });
    expect(c.Command).toBe('storeValue');
    expect(c.Target).toBe('#inp');
  });
  it('screenshot', () => {
    expect(cmd('screenshot', { varName: 'img' }).Command).toBe('captureScreenshot');
  });
  it('countElements', () => {
    const c = cmd('countElements', { selector: '.item', varName: 'n' });
    expect(c.Command).toBe('storeXpathCount');
  });
});

describe('toUiVision control subtypes', () => {
  it('forEach', () => {
    const c = cmd('forEach', { listVar: 'items', itemVar: 'item' });
    expect(c.Command).toBe('forEach');
    expect(c.Target).toBe('items');
    expect(c.Value).toBe('item');
  });
  it('tryCatch', () => {
    expect(cmd('tryCatch', {}).Command).toBe('comment');
  });
});

describe('toUiVision variable subtypes', () => {
  it('setVariable', () => {
    const c = cmd('setVariable', { varName: 'x', value: 'hello' });
    expect(c.Command).toBe('store');
    expect(c.Value).toBe('x');
  });
  it('setArray serialises to JSON', () => {
    const c = cmd('setArray', { varName: 'arr', items: ['a', 'b'] });
    expect(c.Command).toBe('store');
    expect(c.Target).toBe(JSON.stringify(['a', 'b']));
  });
  it('setObject serialises to JSON', () => {
    const c = cmd('setObject', { varName: 'obj', pairs: [{ key: 'k', value: 'v' }] });
    expect(c.Command).toBe('store');
    expect(JSON.parse(c.Target)).toEqual({ k: 'v' });
  });
});

describe('toUiVision page subtypes', () => {
  it('goBack',    () => expect(cmd('goBack', {}).Command).toBe('goBack'));
  it('goForward', () => expect(cmd('goForward', {}).Command).toBe('goForward'));
  it('reload',    () => expect(cmd('reload', {}).Command).toBe('refresh'));
  it('openTab',   () => expect(cmd('openTab', { url: 'https://x.com' }).Command).toBe('open'));
  it('closeTab',  () => expect(cmd('closeTab', {}).Command).toBe('closeWindow'));
  it('switchTab', () => expect(cmd('switchTab', { urlPattern: '*/admin' }).Command).toBe('selectWindow'));
  it('runScript', () => {
    const c = cmd('runScript', { script: 'return 1', varName: 'r' });
    expect(c.Command).toBe('executeScript');
  });
});

describe('toUiVision human subtypes', () => {
  it('notifyUser', () => {
    const c = cmd('notifyUser', { title: 'T', message: 'M', waitForDismiss: false });
    expect(c.Command).toBe('comment');
    expect(c.Target).toContain('T');
  });
});
```

- [ ] **Step 2: Run — expect failures**

```
cd workflow && npm test -- src/__tests__/toUiVision.test.ts
```

Expected: 27 tests failed — `nodeToCommand` returns `null` for unknown subtypes.

- [ ] **Step 3: Extend `nodeToCommand` in `toUiVision.ts`**

In the `nodeToCommand` switch, after the `case 'saveLocally':` block and before `default:`, add:

```typescript
    // New browser actions
    case 'doubleClick':
      return { Command: 'doubleClick', Target: data.selector, Value: '', Description: id };
    case 'rightClick':
      return { Command: 'rightClickAt', Target: data.selector, Value: '', Description: id };
    case 'selectOption':
      return { Command: 'select', Target: data.selector, Value: data.value, Description: id };
    case 'check':
      return { Command: data.checked ? 'check' : 'uncheck', Target: data.selector, Value: '', Description: id };
    case 'pressKey':
      return { Command: 'sendKeys', Target: '', Value: data.key, Description: id };
    case 'dragDrop':
      return { Command: 'dragAndDropToObject', Target: data.sourceSelector, Value: data.targetSelector, Description: id };
    case 'uploadFile':
      return { Command: 'type', Target: data.selector, Value: data.fileName, Description: id };
    case 'paste':
      return { Command: 'type', Target: data.selector, Value: data.text, Description: id };

    // New wait
    case 'waitForUrl':
      return { Command: 'waitForCondition', Target: data.pattern, Value: `${data.timeoutMs}`, Description: id };
    case 'waitForVisible':
      return {
        Command: data.visible ? 'waitForElementVisible' : 'waitForElementNotPresent',
        Target: data.selector,
        Value: `${data.timeoutMs}`,
        Description: id,
      };

    // New data
    case 'getCurrentUrl':
      return { Command: 'storeLocation', Target: '', Value: data.varName, Description: id };
    case 'getValue':
      return { Command: 'storeValue', Target: data.selector, Value: data.varName, Description: id };
    case 'screenshot':
      return { Command: 'captureScreenshot', Target: '', Value: data.varName, Description: id };
    case 'countElements':
      return { Command: 'storeXpathCount', Target: data.selector, Value: data.varName, Description: id };

    // New control
    case 'forEach':
      return { Command: 'forEach', Target: data.listVar, Value: data.itemVar, Description: id };
    case 'tryCatch':
      return { Command: 'comment', Target: 'tryCatch', Value: '', Description: id };

    // New variables
    case 'setVariable':
      return { Command: 'store', Target: data.value, Value: data.varName, Description: id };
    case 'setArray':
      return { Command: 'store', Target: JSON.stringify(data.items), Value: data.varName, Description: id };
    case 'setObject': {
      const obj = Object.fromEntries(data.pairs.map((p) => [p.key, p.value]));
      return { Command: 'store', Target: JSON.stringify(obj), Value: data.varName, Description: id };
    }

    // New page/tab
    case 'goBack':
      return { Command: 'goBack', Target: '', Value: '', Description: id };
    case 'goForward':
      return { Command: 'goForward', Target: '', Value: '', Description: id };
    case 'reload':
      return { Command: 'refresh', Target: '', Value: '', Description: id };
    case 'openTab':
      return { Command: 'open', Target: data.url, Value: '', Description: id };
    case 'closeTab':
      return { Command: 'closeWindow', Target: '', Value: '', Description: id };
    case 'switchTab':
      return { Command: 'selectWindow', Target: data.urlPattern, Value: '', Description: id };
    case 'runScript':
      return { Command: 'executeScript', Target: data.script, Value: data.varName ?? '', Description: id };

    // Human
    case 'notifyUser':
      return { Command: 'comment', Target: `notify: ${data.title}`, Value: data.message, Description: id };
```

- [ ] **Step 4: Run — expect all pass**

```
cd workflow && npm test -- src/__tests__/toUiVision.test.ts
```

Expected: `27 tests passed`

- [ ] **Step 5: Commit**

```
git add workflow/src/export/toUiVision.ts workflow/src/__tests__/toUiVision.test.ts
git commit -m "feat: extend toUiVision with all 27 new node subtype mappings"
```

---

## Task 8: Extend `workflow/src/store.ts`

**Files:**
- Modify: `workflow/src/store.ts`
- Modify: `workflow/src/test-setup.ts`
- Create: `workflow/src/__tests__/store.recording.test.ts`

- [ ] **Step 1: Extend `test-setup.ts` with chrome.runtime mock**

Add after the existing `browser` mock:

```typescript
const mockPort = {
  postMessage: vi.fn(),
  onMessage: { addListener: vi.fn() },
  onDisconnect: { addListener: vi.fn() },
  disconnect: vi.fn(),
};

(globalThis as Record<string, unknown>).chrome = {
  runtime: {
    connect: vi.fn(() => mockPort),
    sendMessage: vi.fn(),
    getURL: (path: string) => `chrome-extension://test-id/${path}`,
  },
};
```

Add `import { vi } from 'vitest';` at the top of `test-setup.ts`.

- [ ] **Step 2: Write the failing tests**

Create `workflow/src/__tests__/store.recording.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react';
import { useWorkflowStore } from '../store';
import type { RecordedEvent } from '../types';

const makeEvent = (overrides: Partial<RecordedEvent> = {}): RecordedEvent => ({
  type: 'click',
  selector: '#btn',
  selectorStrategy: 'css',
  timestamp: Date.now(),
  url: 'https://example.com',
  frameId: 0,
  ...overrides,
});

beforeEach(() => {
  useWorkflowStore.setState({
    recordingState: 'idle',
    capturedEvents: [],
    nodes: [],
    edges: [],
    past: [],
    future: [],
  });
});

test('initial recordingState is idle', () => {
  const { result } = renderHook(() => useWorkflowStore());
  expect(result.current.recordingState).toBe('idle');
});

test('appendEvent adds event to capturedEvents', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.appendEvent(makeEvent()));
  expect(result.current.capturedEvents).toHaveLength(1);
});

test('importRecording converts events to nodes on canvas', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.importRecording([makeEvent({ type: 'click', selector: '#a' })]));
  expect(result.current.nodes).toHaveLength(1);
  expect(result.current.nodes[0].type).toBe('click');
  expect(result.current.recordingState).toBe('idle');
});

test('importRecording wires edges between nodes', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.importRecording([
    makeEvent({ type: 'click', selector: '#a' }),
    makeEvent({ type: 'fill', selector: '#b', value: 'x' }),
  ]));
  expect(result.current.edges).toHaveLength(1);
});

test('discardRecording clears events and resets state', () => {
  useWorkflowStore.setState({ capturedEvents: [makeEvent()], recordingState: 'reviewing' });
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.discardRecording());
  expect(result.current.capturedEvents).toHaveLength(0);
  expect(result.current.recordingState).toBe('idle');
});
```

- [ ] **Step 3: Run — expect failures**

```
cd workflow && npm test -- src/__tests__/store.recording.test.ts
```

Expected: 4 failures — `recordingState`, `appendEvent`, `importRecording`, `discardRecording` don't exist yet.

- [ ] **Step 4: Extend `store.ts` with recording state and actions**

Add to the `WorkflowStore` interface, after `resetWorkflow`:

```typescript
  // Recording
  recordingState: 'idle' | 'recording' | 'reviewing' | 'error';
  capturedEvents: RecordedEvent[];
  startRecording(): void;
  stopRecording(): void;
  importRecording(selected: RecordedEvent[]): void;
  discardRecording(): void;
  appendEvent(event: RecordedEvent): void;
  setRecordingState(state: 'idle' | 'recording' | 'reviewing' | 'error'): void;
```

Add to the imports at the top of store.ts:

```typescript
import type { WorkflowNode, NodeData, RecordedEvent } from './types';
import { eventsToNodes } from './recording/eventsToNodes';
```

Add initial state values in `create<WorkflowStore>((set, get) => ({`:

```typescript
  recordingState: 'idle' as const,
  capturedEvents: [],
```

Add the action implementations before `resetWorkflow`:

```typescript
  setRecordingState(state) {
    set({ recordingState: state });
  },

  appendEvent(event: RecordedEvent) {
    set((s) => ({ capturedEvents: [...s.capturedEvents, event] }));
  },

  startRecording() {
    const { workflowDomain } = get();
    set({ recordingState: 'recording', capturedEvents: [] });
    const port = chrome.runtime.connect({ name: 'designer-relay' });
    port.onMessage.addListener((msg: { type: string; event?: RecordedEvent; events?: RecordedEvent[]; reason?: string }) => {
      if (msg.type === 'LIVE_EVENT' && msg.event) {
        get().appendEvent(msg.event);
      }
      if (msg.type === 'RECORDING_COMPLETE' && msg.events) {
        set({ capturedEvents: msg.events, recordingState: 'reviewing' });
      }
      if (msg.type === 'RECORDING_ERROR') {
        set({ recordingState: 'error' });
      }
    });
    port.postMessage({ type: 'RECORDING_START', domain: workflowDomain || 'about:blank' });
    // Store port reference for stopRecording
    (get() as WorkflowStore & { _recordingPort?: typeof port })._recordingPort = port;
  },

  stopRecording() {
    const store = get() as WorkflowStore & { _recordingPort?: { postMessage: (m: unknown) => void } };
    store._recordingPort?.postMessage({ type: 'RECORDING_STOP' });
  },

  importRecording(selected: RecordedEvent[]) {
    const { nodes: existingNodes, edges: existingEdges, past } = get();
    const { nodes: newNodes, edges: newEdges } = eventsToNodes(selected);
    set({
      past: [...past, { nodes: structuredClone(existingNodes), edges: structuredClone(existingEdges) }].slice(-50),
      future: [],
      nodes: [...existingNodes, ...newNodes],
      edges: [...existingEdges, ...newEdges],
      capturedEvents: [],
      recordingState: 'idle',
    });
  },

  discardRecording() {
    set({ capturedEvents: [], recordingState: 'idle' });
  },
```

- [ ] **Step 5: Run — expect pass**

```
cd workflow && npm test -- src/__tests__/store.recording.test.ts
```

Expected: `5 tests passed`

- [ ] **Step 6: Commit**

```
git add workflow/src/store.ts workflow/src/test-setup.ts workflow/src/__tests__/store.recording.test.ts
git commit -m "feat: add recording state and actions to workflow store"
```

---

## Task 9: Create `workflow/src/recording/eventsToNodes.ts`

**Files:**
- Create: `workflow/src/recording/eventsToNodes.ts`
- Create: `workflow/src/__tests__/eventsToNodes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `workflow/src/__tests__/eventsToNodes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { eventsToNodes } from '../recording/eventsToNodes';
import type { RecordedEvent } from '../types';

function ev(overrides: Partial<RecordedEvent>): RecordedEvent {
  return {
    type: 'click', selector: '#btn', selectorStrategy: 'css',
    timestamp: Date.now(), url: 'https://example.com', frameId: 0,
    ...overrides,
  };
}

describe('eventsToNodes event → node mapping', () => {
  it('navigate', () => {
    const { nodes } = eventsToNodes([ev({ type: 'navigate', selector: '', url: 'https://x.com' })]);
    expect(nodes[0].type).toBe('navigate');
    expect((nodes[0].data as { url: string }).url).toBe('https://x.com');
  });
  it('click', () => {
    const { nodes } = eventsToNodes([ev({ type: 'click', selector: '#btn' })]);
    expect(nodes[0].type).toBe('click');
  });
  it('dblclick → doubleClick', () => {
    const { nodes } = eventsToNodes([ev({ type: 'dblclick', selector: '#el' })]);
    expect(nodes[0].type).toBe('doubleClick');
  });
  it('rightClick', () => {
    const { nodes } = eventsToNodes([ev({ type: 'rightClick', selector: '#el' })]);
    expect(nodes[0].type).toBe('rightClick');
  });
  it('fill', () => {
    const { nodes } = eventsToNodes([ev({ type: 'fill', selector: '#inp', value: 'hi' })]);
    expect(nodes[0].type).toBe('fill');
    expect((nodes[0].data as { value: string }).value).toBe('hi');
  });
  it('selectOption', () => {
    const { nodes } = eventsToNodes([ev({ type: 'selectOption', selector: 'select', value: 'opt' })]);
    expect(nodes[0].type).toBe('selectOption');
  });
  it('check', () => {
    const { nodes } = eventsToNodes([ev({ type: 'check', selector: '#cb', checked: true })]);
    expect(nodes[0].type).toBe('check');
    expect((nodes[0].data as { checked: boolean }).checked).toBe(true);
  });
  it('scroll', () => {
    const { nodes } = eventsToNodes([ev({ type: 'scroll', selector: '#el' })]);
    expect(nodes[0].type).toBe('scroll');
  });
  it('hover', () => {
    const { nodes } = eventsToNodes([ev({ type: 'hover', selector: '#el' })]);
    expect(nodes[0].type).toBe('hover');
  });
  it('pressKey', () => {
    const { nodes } = eventsToNodes([ev({ type: 'pressKey', selector: '', key: 'Enter' })]);
    expect(nodes[0].type).toBe('pressKey');
    expect((nodes[0].data as { key: string }).key).toBe('Enter');
  });
  it('dragDrop', () => {
    const { nodes } = eventsToNodes([ev({ type: 'dragDrop', selector: '#src', targetSelector: '#tgt' })]);
    expect(nodes[0].type).toBe('dragDrop');
  });
  it('uploadFile', () => {
    const { nodes } = eventsToNodes([ev({ type: 'uploadFile', selector: '#inp', value: 'f.pdf' })]);
    expect(nodes[0].type).toBe('uploadFile');
    expect((nodes[0].data as { fileName: string }).fileName).toBe('f.pdf');
  });
  it('paste', () => {
    const { nodes } = eventsToNodes([ev({ type: 'paste', selector: '#el', value: 'txt' })]);
    expect(nodes[0].type).toBe('paste');
  });
  it('goBack', () => {
    const { nodes } = eventsToNodes([ev({ type: 'goBack', selector: '' })]);
    expect(nodes[0].type).toBe('goBack');
  });
  it('goForward', () => {
    const { nodes } = eventsToNodes([ev({ type: 'goForward', selector: '' })]);
    expect(nodes[0].type).toBe('goForward');
  });
  it('reload', () => {
    const { nodes } = eventsToNodes([ev({ type: 'reload', selector: '' })]);
    expect(nodes[0].type).toBe('reload');
  });
});

describe('eventsToNodes layout and wiring', () => {
  it('places nodes in horizontal chain at y=300', () => {
    const { nodes } = eventsToNodes([ev({}), ev({})]);
    expect(nodes[0].position.y).toBe(300);
    expect(nodes[1].position.x).toBeGreaterThan(nodes[0].position.x);
  });

  it('wires edges between consecutive nodes', () => {
    const { nodes, edges } = eventsToNodes([ev({}), ev({})]);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(nodes[0].id);
    expect(edges[0].target).toBe(nodes[1].id);
  });

  it('returns empty arrays for empty input', () => {
    const { nodes, edges } = eventsToNodes([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it('each node gets unique id', () => {
    const { nodes } = eventsToNodes([ev({}), ev({}), ev({})]);
    const ids = nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(3);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```
cd workflow && npm test -- src/__tests__/eventsToNodes.test.ts
```

Expected: All tests fail — module not found.

- [ ] **Step 3: Create `workflow/src/recording/eventsToNodes.ts`**

```typescript
import type { RecordedEvent, WorkflowNode, WorkflowEdge, NodeData } from '../types';

function eventToNode(event: RecordedEvent, x: number): WorkflowNode {
  const id = crypto.randomUUID();
  const position = { x, y: 300 };

  switch (event.type) {
    case 'navigate':
      return { id, type: 'navigate', position, data: { subtype: 'navigate', url: event.url } };
    case 'click':
      return { id, type: 'click', position, data: { subtype: 'click', selector: event.selector } };
    case 'dblclick':
      return { id, type: 'doubleClick', position, data: { subtype: 'doubleClick', selector: event.selector } };
    case 'rightClick':
      return { id, type: 'rightClick', position, data: { subtype: 'rightClick', selector: event.selector } };
    case 'fill':
      return { id, type: 'fill', position, data: { subtype: 'fill', selector: event.selector, value: event.value ?? '' } };
    case 'selectOption':
      return { id, type: 'selectOption', position, data: { subtype: 'selectOption', selector: event.selector, value: event.value ?? '' } };
    case 'check':
      return { id, type: 'check', position, data: { subtype: 'check', selector: event.selector, checked: event.checked ?? true } };
    case 'scroll':
      return { id, type: 'scroll', position, data: { subtype: 'scroll', selector: event.selector, direction: 'down', amount: 300 } };
    case 'hover':
      return { id, type: 'hover', position, data: { subtype: 'hover', selector: event.selector } };
    case 'pressKey':
      return { id, type: 'pressKey', position, data: { subtype: 'pressKey', key: event.key ?? '' } };
    case 'dragDrop':
      return { id, type: 'dragDrop', position, data: { subtype: 'dragDrop', sourceSelector: event.selector, targetSelector: event.targetSelector ?? '' } };
    case 'uploadFile':
      return { id, type: 'uploadFile', position, data: { subtype: 'uploadFile', selector: event.selector, fileName: event.value ?? '' } };
    case 'paste':
      return { id, type: 'paste', position, data: { subtype: 'paste', selector: event.selector, text: event.value ?? '' } };
    case 'goBack':
      return { id, type: 'goBack', position, data: { subtype: 'goBack' } };
    case 'goForward':
      return { id, type: 'goForward', position, data: { subtype: 'goForward' } };
    case 'reload':
      return { id, type: 'reload', position, data: { subtype: 'reload' } };
  }
}

function sourceHandle(nodeType: string): string {
  const withSuccess = new Set(['navigate', 'click', 'fill', 'scroll', 'hover', 'doubleClick', 'rightClick', 'selectOption', 'check', 'dragDrop', 'uploadFile']);
  return withSuccess.has(nodeType) ? 'out-success' : 'out';
}

export function eventsToNodes(events: RecordedEvent[]): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  if (events.length === 0) return { nodes: [], edges: [] };

  const nodes: WorkflowNode[] = events.map((ev, i) => eventToNode(ev, i * 220));
  const edges: WorkflowEdge[] = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: crypto.randomUUID(),
      source: nodes[i].id,
      target: nodes[i + 1].id,
      sourceHandle: sourceHandle(nodes[i].type ?? ''),
      targetHandle: 'in',
      type: 'typed',
    });
  }

  return { nodes, edges };
}
```

- [ ] **Step 4: Run — expect pass**

```
cd workflow && npm test -- src/__tests__/eventsToNodes.test.ts
```

Expected: `20 tests passed`

- [ ] **Step 5: Commit**

```
git add workflow/src/recording/ workflow/src/__tests__/eventsToNodes.test.ts
git commit -m "feat: add eventsToNodes — converts RecordedEvent[] to node chain with edges"
```

---

## Task 10: Create `workflow/src/components/RecordingPanel.tsx`

**Files:**
- Create: `workflow/src/components/RecordingPanel.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '../store';
import type { RecordedEvent } from '../types';

const ACTION_ICON: Partial<Record<RecordedEvent['type'], string>> = {
  navigate: '→', click: '↙', dblclick: '↙↙', rightClick: '⋮',
  fill: 'T', selectOption: '▾', check: '☑', scroll: '↕',
  hover: '◎', pressKey: '⌨', dragDrop: '↔', uploadFile: '📎',
  paste: '⎘', goBack: '◁', goForward: '▷', reload: '↺',
};

const ACTION_COLOR: Partial<Record<RecordedEvent['type'], string>> = {
  navigate: '#22d3ee', click: '#3b82f6', dblclick: '#3b82f6', rightClick: '#3b82f6',
  fill: '#8b5cf6', selectOption: '#8b5cf6', check: '#8b5cf6', scroll: '#64748b',
  hover: '#64748b', pressKey: '#f59e0b', dragDrop: '#3b82f6', uploadFile: '#3b82f6',
  paste: '#8b5cf6', goBack: '#ec4899', goForward: '#ec4899', reload: '#ec4899',
};

interface EventRowProps {
  event: RecordedEvent;
  checked?: boolean;
  onToggle?: () => void;
  reviewMode?: boolean;
}

function EventRow({ event, checked, onToggle, reviewMode }: EventRowProps) {
  const color = ACTION_COLOR[event.type] ?? '#94a3b8';
  const icon = ACTION_ICON[event.type] ?? '•';
  const selector = event.selector ? (event.selector.length > 20 ? event.selector.slice(0, 18) + '…' : event.selector) : event.url;
  const isXpath = event.selectorStrategy === 'xpath';

  return (
    <div
      style={{
        background: '#0f172a',
        border: isXpath ? '1px solid #1e3a5f' : 'none',
        borderRadius: 3,
        padding: '4px 6px',
        fontSize: 12,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        opacity: reviewMode && !checked ? 0.45 : 1,
      }}
    >
      {reviewMode && (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          style={{ accentColor: color, flexShrink: 0 }}
        />
      )}
      <span style={{ color, fontWeight: 700, minWidth: 14 }}>{icon}</span>
      <span style={{ color: '#94a3b8' }}>{event.type}</span>
      <span style={{ color: '#475569', marginLeft: 'auto', fontSize: 11 }}>
        {selector}{isXpath && ' ⚠'}
      </span>
    </div>
  );
}

export function RecordingPanel() {
  const { recordingState, capturedEvents, importRecording, discardRecording } = useWorkflowStore();
  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    if (recordingState === 'reviewing') {
      setChecked(capturedEvents.map(() => true));
    }
  }, [recordingState, capturedEvents]);

  if (recordingState === 'idle') return null;

  const selectedEvents = capturedEvents.filter((_, i) => checked[i] ?? true);
  const selectedCount = recordingState === 'reviewing' ? selectedEvents.length : capturedEvents.length;

  return (
    <div
      data-testid="recording-panel"
      style={{
        width: 220,
        minWidth: 220,
        background: '#0a1628',
        borderLeft: '1px solid #1e3a5f',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
          {recordingState === 'reviewing' ? 'REVIEW ACTIONS' : 'CAPTURED ACTIONS'}
        </span>
        <span style={{ color: '#475569', fontSize: 11 }}>{selectedCount}</span>
      </div>

      {/* Error banner */}
      {recordingState === 'error' && (
        <div style={{ background: '#450a0a', borderBottom: '1px solid #7f1d1d', padding: '6px 10px', fontSize: 11, color: '#f87171' }}>
          Recording ended — tab was closed.
        </div>
      )}

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {capturedEvents.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 16 }}>
            {recordingState === 'recording' ? 'Interact in the opened tab…' : 'Nothing was captured.'}
          </div>
        ) : (
          capturedEvents.map((ev, i) => (
            <EventRow
              key={i}
              event={ev}
              checked={checked[i] ?? true}
              onToggle={() => setChecked((prev) => prev.map((v, j) => j === i ? !v : v))}
              reviewMode={recordingState === 'reviewing'}
            />
          ))
        )}
      </div>

      {/* Import / Discard buttons — reviewing mode only */}
      {(recordingState === 'reviewing' || recordingState === 'error') && (
        <div style={{ padding: 8, borderTop: '1px solid #1e3a5f', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            data-testid="btn-import"
            disabled={selectedCount === 0}
            onClick={() => importRecording(selectedEvents)}
            style={{
              background: selectedCount === 0 ? '#1e293b' : '#22d3ee',
              color: selectedCount === 0 ? '#475569' : '#0f172a',
              border: 'none',
              borderRadius: 4,
              padding: '6px 0',
              fontSize: 12,
              fontWeight: 700,
              cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Import {selectedCount} node{selectedCount !== 1 ? 's' : ''} to canvas
          </button>
          <button
            data-testid="btn-discard"
            onClick={discardRecording}
            style={{ background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 4, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add workflow/src/components/RecordingPanel.tsx
git commit -m "feat: add RecordingPanel component — live log, review checklist, import/discard"
```

---

## Task 11: Extend `workflow/src/components/Toolbar.tsx` and wire `RecordingPanel` into `App.tsx`

**Files:**
- Modify: `workflow/src/components/Toolbar.tsx`
- Modify: `workflow/src/App.tsx`

- [ ] **Step 1: Replace `Toolbar.tsx`**

```typescript
import { useWorkflowStore } from '../store';

export function Toolbar() {
  const {
    workflowName,
    workflowDomain,
    setWorkflowName,
    setWorkflowDomain,
    past,
    future,
    undo,
    redo,
    saveCurrentWorkflow,
    resetWorkflow,
    recordingState,
    capturedEvents,
    startRecording,
    stopRecording,
  } = useWorkflowStore();

  const isRecording = recordingState === 'recording';
  const isReviewing = recordingState === 'reviewing' || recordingState === 'error';

  return (
    <div
      data-testid="toolbar"
      className="wf-toolbar"
      style={isRecording ? { borderBottom: '2px solid #e94560' } : undefined}
    >
      <input
        data-testid="workflow-name"
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        placeholder="Workflow name"
      />
      <input
        data-testid="workflow-domain"
        value={workflowDomain}
        onChange={(e) => setWorkflowDomain(e.target.value)}
        placeholder="Domain (e.g. producthunt.com)"
      />
      <button data-testid="btn-undo" onClick={undo} disabled={past.length === 0}>
        Undo
      </button>
      <button data-testid="btn-redo" onClick={redo} disabled={future.length === 0}>
        Redo
      </button>

      {/* Recording state display */}
      {isRecording && (
        <span
          data-testid="recording-indicator"
          style={{ color: '#e94560', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span
            style={{
              width: 8, height: 8, background: '#e94560', borderRadius: '50%',
              boxShadow: '0 0 0 3px rgba(233,69,96,0.25)',
              display: 'inline-block',
              animation: 'pulse 1.2s infinite',
            }}
          />
          RECORDING — {workflowDomain || 'new tab'} — {capturedEvents.length} actions
        </span>
      )}

      {/* Record / Stop button */}
      {!isRecording && !isReviewing && (
        <button
          data-testid="btn-record"
          onClick={startRecording}
          style={{ marginLeft: 'auto', background: '#e94560', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ width: 7, height: 7, background: '#fff', borderRadius: '50%', display: 'inline-block' }} />
          Record
        </button>
      )}
      {isRecording && (
        <button
          data-testid="btn-stop"
          onClick={stopRecording}
          style={{ marginLeft: 'auto', background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
        >
          ■ Stop
        </button>
      )}

      <button
        data-testid="btn-save"
        onClick={() => saveCurrentWorkflow()}
        style={isRecording ? { opacity: 0.5 } : undefined}
      >
        Save
      </button>
      <button data-testid="btn-new" onClick={() => resetWorkflow()}>
        New
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add `RecordingPanel` import and placement in `App.tsx`**

At the top of `App.tsx`, add the import:

```typescript
import { RecordingPanel } from './components/RecordingPanel';
```

In the JSX, change the `wf-main` div to include `RecordingPanel` after `Inspector`:

```tsx
<div className="wf-main">
  <NodeLibrary />
  <div className="wf-canvas" ref={reactFlowWrapper}>
    {/* ... existing ReactFlow ... */}
  </div>
  <Inspector />
  <RecordingPanel />
</div>
```

- [ ] **Step 3: Add pulse animation to `workflow/src/index.css`**

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

- [ ] **Step 4: Commit**

```
git add workflow/src/components/Toolbar.tsx workflow/src/App.tsx workflow/src/index.css
git commit -m "feat: add Record/Stop button to Toolbar, wire RecordingPanel into App layout"
```

---

## Task 12: Create the Recorder Content Script

**Files:**
- Create: `workflow/src/recorder.ts`
- Create: `workflow/vite.recorder.config.ts`
- Modify: `workflow/package.json`

- [ ] **Step 1: Create `workflow/vite.recorder.config.ts`**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '..',
    emptyOutDir: false,
    lib: {
      entry: 'src/recorder.ts',
      name: 'dotgitRecorder',
      formats: ['iife'],
      fileName: () => 'recorder.js',
    },
  },
});
```

- [ ] **Step 2: Add build script to `workflow/package.json`**

In the `scripts` section, add:

```json
"build:recorder": "vite build -c vite.recorder.config.ts"
```

- [ ] **Step 3: Create `workflow/src/recorder.ts`**

```typescript
// Content script: captures DOM interactions, relays to background via port.
// Compiled as IIFE to ../recorder.js via vite.recorder.config.ts.
// Activated by RECORDER_ACTIVATE message from background.

declare const chrome: typeof import('webextension-polyfill').default & {
  runtime: { connect: (opts: { name: string }) => chrome.runtime.Port };
};

type SelectorStrategy = 'id' | 'aria' | 'name' | 'css' | 'xpath';

interface RecordedEvent {
  type: string;
  selector: string;
  selectorStrategy: SelectorStrategy;
  value?: string;
  checked?: boolean;
  key?: string;
  targetSelector?: string;
  position?: { x: number; y: number };
  timestamp: number;
  url: string;
  frameId: number;
}

// ─── Selector generation ──────────────────────────────────────────────────────

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}/i;
const NUMERIC_ONLY = /^\d+$/;

function getSelector(el: Element): { selector: string; strategy: SelectorStrategy } {
  if (el.id && !UUID_PATTERN.test(el.id) && !NUMERIC_ONLY.test(el.id)) {
    return { selector: `#${CSS.escape(el.id)}`, strategy: 'id' };
  }
  for (const attr of ['data-testid', 'data-cy', 'data-qa']) {
    const val = el.getAttribute(attr);
    if (val) return { selector: `[${attr}="${CSS.escape(val)}"]`, strategy: 'css' };
  }
  const aria = el.getAttribute('aria-label');
  if (aria) return { selector: `[aria-label="${CSS.escape(aria)}"]`, strategy: 'aria' };
  const name = el.getAttribute('name');
  if (name) return { selector: `[name="${CSS.escape(name)}"]`, strategy: 'name' };
  const css = buildCssPath(el, 3);
  if (css) return { selector: css, strategy: 'css' };
  return { selector: buildXPath(el), strategy: 'xpath' };
}

function buildCssPath(el: Element, maxHops: number): string | null {
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let i = 0; i < maxHops && cur && cur !== document.documentElement; i++) {
    const tag = cur.tagName.toLowerCase();
    const cls = Array.from(cur.classList)
      .filter((c) => !UUID_PATTERN.test(c)).slice(0, 2)
      .map((c) => `.${CSS.escape(c)}`).join('');
    const type = cur.getAttribute('type');
    parts.unshift(`${tag}${cls}${type ? `[type="${type}"]` : ''}`);
    const candidate = parts.join(' > ');
    if (document.querySelectorAll(candidate).length === 1) return candidate;
    cur = cur.parentElement;
  }
  return null;
}

function buildXPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement) {
    const tag = cur.tagName.toLowerCase();
    const parent = cur.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      const idx = siblings.indexOf(cur) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}[${idx}]` : tag);
    } else {
      parts.unshift(tag);
    }
    cur = cur.parentElement;
  }
  return `//${parts.join('/')}`;
}

// ─── Port and state ───────────────────────────────────────────────────────────

let port: ReturnType<typeof chrome.runtime.connect> | null = null;
let active = false;

function send(event: RecordedEvent) {
  port?.postMessage({ type: 'RECORDED_EVENT', event });
}

function base(el: Element): Omit<RecordedEvent, 'type'> {
  const { selector, strategy } = getSelector(el);
  return { selector, selectorStrategy: strategy, timestamp: Date.now(), url: location.href, frameId: 0 };
}

// ─── Debounce helpers ─────────────────────────────────────────────────────────

const fillTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let hoverEl: Element | null = null;
let dragSrc: Element | null = null;

// ─── DOM handlers ─────────────────────────────────────────────────────────────

function onClick(e: MouseEvent) {
  if (!active || e.detail === 2) return;
  send({ ...base(e.target as Element), type: 'click' });
}

function onDblclick(e: MouseEvent) {
  if (!active) return;
  send({ ...base(e.target as Element), type: 'dblclick' });
}

function onContextmenu(e: MouseEvent) {
  if (!active) return;
  send({ ...base(e.target as Element), type: 'rightClick' });
}

function onInput(e: Event) {
  if (!active) return;
  const el = e.target as HTMLInputElement;
  if (!('value' in el)) return;
  const t = fillTimers.get(el);
  if (t) clearTimeout(t);
  fillTimers.set(el, setTimeout(() => {
    fillTimers.delete(el);
    send({ ...base(el), type: 'fill', value: el.value });
  }, 800));
}

function onChange(e: Event) {
  if (!active) return;
  const el = e.target as HTMLSelectElement | HTMLInputElement;
  if (el.tagName === 'SELECT') {
    send({ ...base(el), type: 'selectOption', value: (el as HTMLSelectElement).value });
  } else if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    send({ ...base(el), type: 'check', checked: el.checked });
  }
}

function onScroll(e: Event) {
  if (!active) return;
  const el = e.target as Element;
  if (!el || (el as Node) === document) return;
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    scrollTimer = null;
    send({ ...base(el), type: 'scroll' });
  }, 300);
}

function onMouseover(e: Event) {
  if (!active) return;
  const el = e.target as Element;
  if (el === hoverEl) return;
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverEl = el;
  hoverTimer = setTimeout(() => {
    send({ ...base(el), type: 'hover' });
    hoverEl = null;
    hoverTimer = null;
  }, 500);
}

function onMouseout() {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  hoverEl = null;
}

const SPECIAL_KEYS = new Set([
  'Enter', 'Tab', 'Escape', 'Backspace', 'Delete',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]);

function onKeydown(e: KeyboardEvent) {
  if (!active) return;
  const modified = e.ctrlKey || e.altKey || e.metaKey;
  if (!modified && !SPECIAL_KEYS.has(e.key)) return;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Alt');
  if (e.metaKey) parts.push('Meta');
  if (e.shiftKey && modified) parts.push('Shift');
  parts.push(e.key);
  send({ ...base(e.target as Element), type: 'pressKey', key: parts.join('+') });
}

function onDragstart(e: DragEvent) {
  if (!active) return;
  dragSrc = e.target as Element;
}

function onDragend(e: DragEvent) {
  if (!active || !dragSrc) return;
  const tgt = document.elementFromPoint(e.clientX, e.clientY);
  if (tgt && tgt !== dragSrc) {
    const { selector: tgtSel } = getSelector(tgt);
    send({ ...base(dragSrc), type: 'dragDrop', targetSelector: tgtSel, position: { x: e.clientX, y: e.clientY } });
  }
  dragSrc = null;
}

function onPaste(e: ClipboardEvent) {
  if (!active) return;
  send({ ...base(e.target as Element), type: 'paste', value: e.clipboardData?.getData('text') ?? '' });
}

// ─── Activation ───────────────────────────────────────────────────────────────

function startCapture() {
  active = true;
  port = chrome.runtime.connect({ name: 'recorder' });
  port.onDisconnect.addListener(() => { port = null; active = false; });

  const o = { capture: true };
  document.addEventListener('click', onClick, o);
  document.addEventListener('dblclick', onDblclick, o);
  document.addEventListener('contextmenu', onContextmenu, o);
  document.addEventListener('input', onInput, o);
  document.addEventListener('change', onChange, o);
  document.addEventListener('scroll', onScroll, { ...o, passive: true });
  document.addEventListener('mouseover', onMouseover, o);
  document.addEventListener('mouseout', onMouseout, o);
  document.addEventListener('keydown', onKeydown, o);
  document.addEventListener('dragstart', onDragstart, o);
  document.addEventListener('dragend', onDragend, o);
  document.addEventListener('paste', onPaste, o);

  // Announce current page
  send({ type: 'navigate', selector: '', selectorStrategy: 'css', timestamp: Date.now(), url: location.href, frameId: 0 });
}

chrome.runtime.onMessage.addListener((msg: { type: string }) => {
  if (msg.type === 'RECORDER_ACTIVATE' && !active) {
    startCapture();
  }
});
```

- [ ] **Step 4: Build the recorder**

```
cd workflow && npm run build:recorder
```

Expected output: `../recorder.js` created at the extension root.

- [ ] **Step 5: Commit**

```
git add workflow/src/recorder.ts workflow/vite.recorder.config.ts workflow/package.json recorder.js
git commit -m "feat: add recorder content script with smart selector generation and debounced capture"
```

---

## Task 13: Extend `dotgit.js` and Update `manifest.json`

**Files:**
- Modify: `dotgit.js`
- Modify: `manifest.json`

- [ ] **Step 1: Add recording state variables to `dotgit.js`**

After the `let blacklist = [];` block, add:

```javascript
// ─── Recording state ──────────────────────────────────────────────────────────
const recording = {
  active: false,
  tabId: null,
  events: [],
  recorderPort: null,
  designerPort: null,
};
```

- [ ] **Step 2: Add `chrome.runtime.onConnect` handler to `dotgit.js`**

After the `chrome.runtime.onSuspend` listener block, add:

```javascript
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'recorder') {
    recording.recorderPort = port;
    port.onMessage.addListener((msg) => {
      if (msg.type === 'RECORDED_EVENT') {
        recording.events.push(msg.event);
        recording.designerPort?.postMessage({ type: 'LIVE_EVENT', event: msg.event });
      }
    });
    port.onDisconnect.addListener(() => {
      recording.recorderPort = null;
      if (recording.active) {
        recording.designerPort?.postMessage({ type: 'RECORDING_ERROR', reason: 'tab_closed' });
        recording.active = false;
      }
    });
  }

  if (port.name === 'designer-relay') {
    recording.designerPort = port;
    port.onMessage.addListener((msg) => {
      if (msg.type === 'RECORDING_START') {
        recording.active = true;
        recording.events = [];
        const domain = msg.domain || 'about:blank';
        const url = domain.startsWith('http') ? domain : `https://${domain}`;
        chrome.tabs.create({ url }, (tab) => {
          recording.tabId = tab.id;
          // Wait for tab to finish loading before activating recorder
          const listener = (tabId, info) => {
            if (tabId === recording.tabId && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              chrome.tabs.sendMessage(recording.tabId, { type: 'RECORDER_ACTIVATE' }).catch(() => {});
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }

      if (msg.type === 'RECORDING_STOP') {
        recording.active = false;
        recording.designerPort?.postMessage({ type: 'RECORDING_COMPLETE', events: recording.events });
        if (recording.tabId !== null) {
          chrome.tabs.remove(recording.tabId).catch(() => {});
          recording.tabId = null;
        }
        recording.events = [];
      }
    });

    port.onDisconnect.addListener(() => {
      recording.designerPort = null;
      if (recording.active && recording.tabId !== null) {
        chrome.tabs.remove(recording.tabId).catch(() => {});
      }
      recording.active = false;
      recording.tabId = null;
      recording.events = [];
    });
  }
});
```

- [ ] **Step 3: Update `manifest.json` to add recorder.js content script**

In the `content_scripts` array, add a second entry after the existing one:

```json
{
  "matches": ["<all_urls>"],
  "js": ["recorder.js"],
  "run_at": "document_idle",
  "all_frames": false
}
```

Also add `"recorder.js"` to `web_accessible_resources[0].resources`:

```json
"resources": ["content_script.js", "recorder.js"]
```

- [ ] **Step 4: Verify manifest is valid JSON**

```
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 5: Run all tests**

```
cd workflow && npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```
git add dotgit.js manifest.json
git commit -m "feat: add recording port management to background, add recorder.js content script to manifest"
```

---

## Task 14: Full Test Suite Pass

- [ ] **Step 1: Run all tests**

```
cd workflow && npm test
```

Expected output:

```
✓ src/__tests__/types.test.ts (6)
✓ src/__tests__/toUiVision.test.ts (27)
✓ src/__tests__/eventsToNodes.test.ts (20)
✓ src/__tests__/store.recording.test.ts (5)
✓ src/__tests__/store.test.ts
✓ src/__tests__/App.test.tsx
✓ src/__tests__/nodes.test.tsx
✓ src/__tests__/edges.test.ts
✓ src/__tests__/workflows.test.ts
```

- [ ] **Step 2: Build the full workflow bundle**

```
cd workflow && npm run build
```

Expected: `dist/` updated, no type errors.

- [ ] **Step 3: Build recorder**

```
cd workflow && npm run build:recorder
```

Expected: `../recorder.js` updated.

- [ ] **Step 4: Final commit**

```
git add -A
git commit -m "feat: complete human action recording — 27 new node types, recorder content script, recording UI"
```

---

## Manual Smoke Test Checklist

After loading the extension in Firefox:

1. Open the workflow designer (`workflow/dist/workflow.html` or via extension popup)
2. Set domain to a test site (e.g. `example.com`)
3. Click **Record** — a new tab opens at example.com
4. Click around, fill a form field, press Enter
5. Watch the **Recording Panel** on the right populate live
6. Click **■ Stop** — panel switches to review checklist
7. Uncheck one event, click **Import N nodes to canvas**
8. Verify nodes appear, connected, selectable in Inspector
9. Drag a new `forEach` node from the palette — verify it renders with two handles
10. Select `notifyUser` node, set `waitForDismiss: true` — verify Inspector shows the correct field

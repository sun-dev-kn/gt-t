import type { Node, Edge } from '@xyflow/react';

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
  | { subtype: 'sendToBackend'; endpoint?: string }
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
  schedule:   { 'out': 'flow' },
  manual:     { 'out': 'flow' },
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

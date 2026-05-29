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
  selector?: string;
  selectorStrategy?: 'id' | 'aria' | 'name' | 'css' | 'xpath';
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

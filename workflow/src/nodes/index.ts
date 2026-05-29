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

// React Flow's nodeTypes requires ComponentType<NodeProps>. Our components accept
// narrower data shapes matched by WorkflowNode's generic. The cast is safe because
// React Flow narrows data at the call site via Node<TData>.
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

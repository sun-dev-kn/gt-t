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

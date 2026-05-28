import type { WorkflowNode, WorkflowEdge, UiVisionCommand, UiVisionMacro, NodeData } from '../types';

// ─── Topological sort ─────────────────────────────────────────────────────────

function topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  // Build adjacency map: sourceId → [targetId, ...]
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    const targets = adj.get(edge.source);
    if (targets !== undefined) {
      targets.push(edge.target);
    }
    const deg = inDegree.get(edge.target);
    if (deg !== undefined) {
      inDegree.set(edge.target, deg + 1);
    }
  }

  // Collect roots: nodes with no incoming edges
  const roots = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);

  // DFS-based topological sort from roots
  const visited = new Set<string>();
  const postOrder: WorkflowNode[] = [];
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

  function dfs(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const children = adj.get(nodeId) ?? [];
    for (const childId of children) {
      dfs(childId);
    }
    const node = nodeById.get(nodeId);
    if (node) postOrder.push(node);
  }

  for (const root of roots) {
    dfs(root.id);
  }

  // Post-order reversed gives topological order
  const result = postOrder.reverse();
  // Append any nodes not reached by root-driven DFS (cycles, disconnected subgraphs)
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      result.push(node);
    }
  }
  return result;
}

// ─── Node → UiVisionCommand ───────────────────────────────────────────────────

function nodeToCommand(node: WorkflowNode): UiVisionCommand | null {
  const data: NodeData = node.data;
  const id = node.id;

  switch (data.subtype) {
    // Triggers
    case 'schedule':
      return { Command: 'comment', Target: `Scheduled every ${data.intervalHours}h`, Value: '', Description: id };
    case 'manual':
      return { Command: 'comment', Target: 'Manual trigger', Value: '', Description: id };

    // Browser actions
    case 'navigate':
      return { Command: 'open', Target: data.url, Value: '', Description: id };
    case 'click':
      return { Command: 'click', Target: data.selector, Value: '', Description: id };
    case 'fill':
      return { Command: 'type', Target: data.selector, Value: data.value, Description: id };
    case 'scroll':
      return {
        Command: 'scrollTo',
        Target: data.selector,
        Value: `${data.direction},${data.amount}`,
        Description: id,
      };
    case 'hover':
      return { Command: 'mouseOver', Target: data.selector, Value: '', Description: id };

    // Wait actions
    case 'waitForSelector':
      return {
        Command: 'waitForElementPresent',
        Target: data.selector,
        Value: `${data.timeoutMs}`,
        Description: id,
      };
    case 'delay':
      return { Command: 'pause', Target: `${data.ms}`, Value: '', Description: id };
    case 'networkIdle':
      return { Command: 'waitForPageToLoad', Target: '', Value: '', Description: id };

    // Data nodes
    case 'extract':
      return {
        Command: 'storeText',
        Target: data.fields[0]?.selector ?? '',
        Value: data.varName,
        Description: id,
      };
    case 'extractTable':
      return { Command: 'storeText', Target: data.selector, Value: data.varName, Description: id };

    // Control flow
    case 'condition':
      return {
        Command: 'if_v2',
        Target: `${data.variable}|${data.operator}|${data.value}`,
        Value: '',
        Description: id,
      };
    case 'loop':
      return {
        Command: 'times',
        Target: `${data.maxIterations}`,
        Value: data.continueVariable,
        Description: id,
      };
    case 'merge':
      return { Command: 'comment', Target: 'merge', Value: '', Description: id };

    // Account actions
    case 'injectCredentials':
      return { Command: 'comment', Target: 'injectCredentials', Value: '', Description: id };
    case 'switchAccount':
      return { Command: 'comment', Target: 'switchAccount', Value: '', Description: id };

    // Output actions
    case 'sendToBackend':
      return { Command: 'comment', Target: 'sendToBackend', Value: '', Description: id };
    case 'saveLocally':
      return { Command: 'comment', Target: 'saveLocally', Value: '', Description: id };

    default:
      return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function toUiVision(
  name: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): UiVisionMacro {
  const sorted = topoSort(nodes, edges);
  const commands: UiVisionCommand[] = sorted
    .map((node) => nodeToCommand(node))
    .filter(Boolean) as UiVisionCommand[];

  return {
    Name: name,
    CreationDate: new Date().toISOString(),
    Commands: commands,
  };
}

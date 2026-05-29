import type { RecordedEvent, WorkflowNode, WorkflowEdge } from '../types';

function eventToNode(event: RecordedEvent, x: number): WorkflowNode {
  const id = crypto.randomUUID();
  const position = { x, y: 300 };

  switch (event.type) {
    case 'navigate':
      return { id, type: 'navigate', position, data: { subtype: 'navigate', url: event.url } };
    case 'click':
      return { id, type: 'click', position, data: { subtype: 'click', selector: event.selector ?? '' } };
    case 'dblclick':
      return { id, type: 'doubleClick', position, data: { subtype: 'doubleClick', selector: event.selector ?? '' } };
    case 'rightClick':
      return { id, type: 'rightClick', position, data: { subtype: 'rightClick', selector: event.selector ?? '' } };
    case 'fill':
      return { id, type: 'fill', position, data: { subtype: 'fill', selector: event.selector ?? '', value: event.value ?? '' } };
    case 'selectOption':
      return { id, type: 'selectOption', position, data: { subtype: 'selectOption', selector: event.selector ?? '', value: event.value ?? '' } };
    case 'check':
      return { id, type: 'check', position, data: { subtype: 'check', selector: event.selector ?? '', checked: event.checked ?? true } };
    case 'scroll':
      return { id, type: 'scroll', position, data: { subtype: 'scroll', selector: event.selector ?? '', direction: 'down', amount: 300 } };
    case 'hover':
      return { id, type: 'hover', position, data: { subtype: 'hover', selector: event.selector ?? '' } };
    case 'pressKey':
      return { id, type: 'pressKey', position, data: { subtype: 'pressKey', key: event.key ?? '' } };
    case 'dragDrop':
      return { id, type: 'dragDrop', position, data: { subtype: 'dragDrop', sourceSelector: event.selector ?? '', targetSelector: event.targetSelector ?? '' } };
    case 'uploadFile':
      return { id, type: 'uploadFile', position, data: { subtype: 'uploadFile', selector: event.selector ?? '', fileName: event.value ?? '' } };
    case 'paste':
      return { id, type: 'paste', position, data: { subtype: 'paste', selector: event.selector ?? '', text: event.value ?? '' } };
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

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

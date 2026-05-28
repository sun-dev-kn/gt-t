import { act, renderHook } from '@testing-library/react';
import { useWorkflowStore } from '../store';
import type { WorkflowNode } from '../types';

beforeEach(() => useWorkflowStore.getState().resetWorkflow());

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

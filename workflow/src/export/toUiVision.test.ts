import type { WorkflowNode, WorkflowEdge } from '../types';
import { toUiVision } from './toUiVision';

// ─── Test 1: empty graph ─────────────────────────────────────────────────────

test('empty graph produces macro with no commands', () => {
  const macro = toUiVision('test', [], []);
  expect(macro.Name).toBe('test');
  expect(macro.Commands).toHaveLength(0);
});

// ─── Test 2: single navigate node ───────────────────────────────────────────

test('single navigate node produces open command', () => {
  const nodes: WorkflowNode[] = [
    {
      id: 'n1',
      type: 'navigate',
      position: { x: 0, y: 0 },
      data: { subtype: 'navigate', url: 'https://example.com' },
    },
  ];
  const macro = toUiVision('w', nodes, []);
  expect(macro.Commands).toHaveLength(1);
  expect(macro.Commands[0]).toMatchObject({
    Command: 'open',
    Target: 'https://example.com',
    Value: '',
  });
});

// ─── Test 3: trigger → navigate → click chain ────────────────────────────────

test('trigger → navigate → click chain respects topological order', () => {
  const nodes: WorkflowNode[] = [
    {
      id: 't1',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: { subtype: 'manual' },
    },
    {
      id: 'n1',
      type: 'navigate',
      position: { x: 0, y: 0 },
      data: { subtype: 'navigate', url: 'https://ph.com' },
    },
    {
      id: 'c1',
      type: 'click',
      position: { x: 0, y: 0 },
      data: { subtype: 'click', selector: '.upvote' },
    },
  ];
  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 't1', target: 'n1' },
    { id: 'e2', source: 'n1', target: 'c1' },
  ];
  const macro = toUiVision('w', nodes, edges);
  expect(macro.Commands).toHaveLength(3);
  // trigger first
  expect(macro.Commands[0]).toMatchObject({ Command: 'comment', Target: 'Manual trigger' });
  // navigate second
  expect(macro.Commands[1]).toMatchObject({ Command: 'open', Target: 'https://ph.com' });
  // click third
  expect(macro.Commands[2]).toMatchObject({ Command: 'click', Target: '.upvote' });
});

// ─── Test 4: fill produces type command with value ───────────────────────────

test('fill node produces type command with value', () => {
  const nodes: WorkflowNode[] = [
    {
      id: 'f1',
      type: 'fill',
      position: { x: 0, y: 0 },
      data: { subtype: 'fill', selector: '#email', value: 'user@example.com' },
    },
  ];
  const macro = toUiVision('w', nodes, []);
  expect(macro.Commands[0]).toMatchObject({
    Command: 'type',
    Target: '#email',
    Value: 'user@example.com',
  });
});

// ─── Test 5: delay produces pause ───────────────────────────────────────────

test('delay node produces pause command', () => {
  const nodes: WorkflowNode[] = [
    {
      id: 'd1',
      type: 'delay',
      position: { x: 0, y: 0 },
      data: { subtype: 'delay', ms: 2000 },
    },
  ];
  const macro = toUiVision('w', nodes, []);
  expect(macro.Commands[0]).toMatchObject({ Command: 'pause', Target: '2000', Value: '' });
});

// ─── Test 6: scroll produces scrollTo with direction+amount ─────────────────

test('scroll node produces scrollTo command with direction and amount', () => {
  const nodes: WorkflowNode[] = [
    {
      id: 's1',
      type: 'scroll',
      position: { x: 0, y: 0 },
      data: { subtype: 'scroll', selector: 'body', direction: 'down', amount: 500 },
    },
  ];
  const macro = toUiVision('w', nodes, []);
  expect(macro.Commands[0]).toMatchObject({
    Command: 'scrollTo',
    Target: 'body',
    Value: 'down,500',
  });
});

// ─── Test 7: condition produces if_v2 ───────────────────────────────────────

test('condition node produces if_v2 command', () => {
  const nodes: WorkflowNode[] = [
    {
      id: 'cond',
      type: 'condition',
      position: { x: 0, y: 0 },
      data: { subtype: 'condition', variable: 'score', operator: '>', value: '100' },
    },
  ];
  const macro = toUiVision('w', nodes, []);
  expect(macro.Commands[0]).toMatchObject({ Command: 'if_v2', Target: 'score|>|100' });
});

// ─── Test 8: Description field is node.id ───────────────────────────────────

test('every command has Description set to node.id', () => {
  const nodes: WorkflowNode[] = [
    {
      id: 'myNodeId',
      type: 'navigate',
      position: { x: 0, y: 0 },
      data: { subtype: 'navigate', url: 'https://test.com' },
    },
  ];
  const macro = toUiVision('w', nodes, []);
  expect(macro.Commands[0].Description).toBe('myNodeId');
});

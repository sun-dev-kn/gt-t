import type { WorkflowNode, WorkflowEdge } from '../types';
import { fromUiVision } from './fromUiVision';
import { toUiVision } from './toUiVision';

// ─── Test 1: empty macro ─────────────────────────────────────────────────────

test('empty macro produces no nodes and no edges', () => {
  const result = fromUiVision({ Name: 'test', CreationDate: '', Commands: [] });
  expect(result.nodes).toHaveLength(0);
  expect(result.edges).toHaveLength(0);
});

// ─── Test 2: single open command → navigate node ─────────────────────────────

test('single open command produces a navigate node', () => {
  const result = fromUiVision({
    Name: 'test',
    CreationDate: '',
    Commands: [{ Command: 'open', Target: 'https://example.com', Value: '', Description: 'myId' }],
  });
  expect(result.nodes).toHaveLength(1);
  expect(result.nodes[0]).toMatchObject({
    id: 'myId',
    type: 'navigate',
    data: { subtype: 'navigate', url: 'https://example.com' },
  });
  expect(result.edges).toHaveLength(0);
});

// ─── Test 3: two commands → one edge ─────────────────────────────────────────

test('two commands produce one linear edge', () => {
  const result = fromUiVision({
    Name: 'test',
    CreationDate: '',
    Commands: [
      { Command: 'open', Target: 'https://ph.com', Value: '', Description: 'n1' },
      { Command: 'click', Target: '.upvote', Value: '', Description: 'n2' },
    ],
  });
  expect(result.nodes).toHaveLength(2);
  expect(result.edges).toHaveLength(1);
  expect(result.edges[0]).toMatchObject({ source: 'n1', target: 'n2', type: 'typed' });
});

// ─── Test 4: type command → fill node ────────────────────────────────────────

test('type command produces a fill node', () => {
  const result = fromUiVision({
    Name: 'test',
    CreationDate: '',
    Commands: [{ Command: 'type', Target: '#email', Value: 'user@example.com', Description: 'f1' }],
  });
  expect(result.nodes[0].data).toMatchObject({
    subtype: 'fill',
    selector: '#email',
    value: 'user@example.com',
  });
});

// ─── Test 5: scroll command → scroll node ────────────────────────────────────

test('scrollTo command produces a scroll node with direction and amount', () => {
  const result = fromUiVision({
    Name: 'test',
    CreationDate: '',
    Commands: [{ Command: 'scrollTo', Target: 'body', Value: 'down,500', Description: 'sc1' }],
  });
  expect(result.nodes[0].data).toMatchObject({
    subtype: 'scroll',
    selector: 'body',
    direction: 'down',
    amount: 500,
  });
});

// ─── Test 6: if_v2 → condition node ──────────────────────────────────────────

test('if_v2 command produces a condition node', () => {
  const result = fromUiVision({
    Name: 'test',
    CreationDate: '',
    Commands: [{ Command: 'if_v2', Target: 'score|>|100', Value: '', Description: 'cond1' }],
  });
  expect(result.nodes[0].data).toMatchObject({
    subtype: 'condition',
    variable: 'score',
    operator: '>',
    value: '100',
  });
});

// ─── Test 7: comment Manual trigger → manual trigger node ────────────────────

test('comment "Manual trigger" produces a manual trigger node', () => {
  const result = fromUiVision({
    Name: 'test',
    CreationDate: '',
    Commands: [{ Command: 'comment', Target: 'Manual trigger', Value: '', Description: 't1' }],
  });
  expect(result.nodes[0].data).toMatchObject({ subtype: 'manual' });
  expect(result.nodes[0].type).toBe('trigger');
});

// ─── Test 8: unrecognized command is skipped ─────────────────────────────────

test('unrecognized command is skipped', () => {
  const result = fromUiVision({
    Name: 'test',
    CreationDate: '',
    Commands: [
      { Command: 'unknownCmd', Target: '', Value: '' },
      { Command: 'open', Target: 'https://test.com', Value: '', Description: 'n1' },
    ],
  });
  expect(result.nodes).toHaveLength(1);
  expect(result.nodes[0].data).toMatchObject({ subtype: 'navigate' });
});

// ─── Test 9 (I2): malformed if_v2 with fewer than 3 parts is skipped ─────────

test('if_v2 with fewer than 3 pipe-separated parts is skipped', () => {
  const result = fromUiVision({
    Name: 'test',
    CreationDate: '',
    Commands: [
      { Command: 'if_v2', Target: 'score|>', Value: '', Description: 'bad-cond' }, // only 2 parts
      { Command: 'open', Target: 'https://example.com', Value: '', Description: 'nav1' },
    ],
  });
  // malformed if_v2 must be dropped; only the navigate node survives
  expect(result.nodes).toHaveLength(1);
  expect(result.nodes[0].data).toMatchObject({ subtype: 'navigate' });
});

// ─── Test 10: roundtrip — toUiVision then fromUiVision restores structure ────

test('roundtrip: toUiVision → fromUiVision restores nodes and edges', () => {
  const originalNodes: WorkflowNode[] = [
    {
      id: 'n1',
      type: 'navigate',
      position: { x: 0, y: 0 },
      data: { subtype: 'navigate', url: 'https://ph.com' },
    },
    {
      id: 'n2',
      type: 'click',
      position: { x: 0, y: 120 },
      data: { subtype: 'click', selector: '.upvote' },
    },
  ];
  const originalEdges: WorkflowEdge[] = [{ id: 'e1', source: 'n1', target: 'n2', type: 'typed' }];

  const macro = toUiVision('roundtrip', originalNodes, originalEdges);
  const result = fromUiVision(macro);

  expect(result.nodes).toHaveLength(2);
  expect(result.nodes[0].id).toBe('n1'); // Description preserved
  expect(result.nodes[0].data).toMatchObject({ subtype: 'navigate', url: 'https://ph.com' });
  expect(result.nodes[1].data).toMatchObject({ subtype: 'click', selector: '.upvote' });
  expect(result.edges).toHaveLength(1);
  expect(result.edges[0]).toMatchObject({ source: 'n1', target: 'n2' });
});

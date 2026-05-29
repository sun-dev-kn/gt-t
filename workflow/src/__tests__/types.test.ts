import { portsCompatible, HANDLE_TYPES } from '../types';
import type { WorkflowJSON, UiVisionMacro } from '../types';

// ─── portsCompatible ─────────────────────────────────────────────────────────

test('flow → flow is compatible', () => {
  expect(portsCompatible('trigger', 'out', 'navigate', 'in')).toBe(true);
});

test('data → flow is incompatible', () => {
  expect(portsCompatible('extract', 'out', 'navigate', 'in')).toBe(false);
});

test('data → data is compatible', () => {
  expect(portsCompatible('extract', 'out', 'sendToBackend', 'in-data')).toBe(true);
});

test('error → flow is incompatible', () => {
  expect(portsCompatible('navigate', 'out-error', 'navigate', 'in')).toBe(false);
});

test('unknown source handle defaults to compatible', () => {
  expect(portsCompatible('unknown', 'x', 'navigate', 'in')).toBe(true);
});

test('unknown target handle defaults to compatible', () => {
  expect(portsCompatible('extract', 'out', 'unknown', 'anything')).toBe(true);
});

test('HANDLE_TYPES covers all node types', () => {
  const expectedKeys = [
    'trigger', 'schedule', 'manual',
    'navigate', 'click', 'fill', 'scroll', 'hover',
    'waitForSelector', 'delay', 'networkIdle', 'extract', 'extractTable',
    'condition', 'loop', 'merge', 'injectCredentials', 'switchAccount',
    'sendToBackend', 'saveLocally',
  ];
  expect(Object.keys(HANDLE_TYPES).sort()).toEqual(expectedKeys.sort());
});

// ─── Type structure sanity checks ────────────────────────────────────────────

test('WorkflowJSON has nodes and edges', () => {
  const wf: WorkflowJSON = { name: 'test', domain: '', nodes: [], edges: [] };
  expect(wf.nodes).toHaveLength(0);
});

test('UiVisionMacro has Commands array', () => {
  const m: UiVisionMacro = { Name: 'x', CreationDate: '2026-01-01', Commands: [] };
  expect(m.Commands).toHaveLength(0);
});

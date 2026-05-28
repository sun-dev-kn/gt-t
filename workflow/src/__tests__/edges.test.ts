import { edgeTypes } from '../edges/index';
import { portsCompatible } from '../types';

test('edgeTypes exports a "typed" key', () => {
  expect(edgeTypes).toHaveProperty('typed');
  expect(typeof edgeTypes.typed).toBe('function');
});

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

test('unknown handles default to compatible', () => {
  expect(portsCompatible('unknown', 'x', 'unknown', 'y')).toBe(true);
});

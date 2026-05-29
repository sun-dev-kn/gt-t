import { describe, it, expect } from 'vitest';
import { eventsToNodes } from '../recording/eventsToNodes';
import type { RecordedEvent } from '../types';

function ev(overrides: Partial<RecordedEvent>): RecordedEvent {
  return {
    type: 'click', selector: '#btn', selectorStrategy: 'css',
    timestamp: Date.now(), url: 'https://example.com', frameId: 0,
    ...overrides,
  };
}

describe('eventsToNodes event → node mapping', () => {
  it('navigate', () => {
    const { nodes } = eventsToNodes([ev({ type: 'navigate', selector: '', url: 'https://x.com' })]);
    expect(nodes[0].type).toBe('navigate');
    expect((nodes[0].data as { url: string }).url).toBe('https://x.com');
  });
  it('click', () => {
    const { nodes } = eventsToNodes([ev({ type: 'click', selector: '#btn' })]);
    expect(nodes[0].type).toBe('click');
  });
  it('dblclick → doubleClick', () => {
    const { nodes } = eventsToNodes([ev({ type: 'dblclick', selector: '#el' })]);
    expect(nodes[0].type).toBe('doubleClick');
  });
  it('rightClick', () => {
    const { nodes } = eventsToNodes([ev({ type: 'rightClick', selector: '#el' })]);
    expect(nodes[0].type).toBe('rightClick');
  });
  it('fill', () => {
    const { nodes } = eventsToNodes([ev({ type: 'fill', selector: '#inp', value: 'hi' })]);
    expect(nodes[0].type).toBe('fill');
    expect((nodes[0].data as { value: string }).value).toBe('hi');
  });
  it('selectOption', () => {
    const { nodes } = eventsToNodes([ev({ type: 'selectOption', selector: 'select', value: 'opt' })]);
    expect(nodes[0].type).toBe('selectOption');
  });
  it('check', () => {
    const { nodes } = eventsToNodes([ev({ type: 'check', selector: '#cb', checked: true })]);
    expect(nodes[0].type).toBe('check');
    expect((nodes[0].data as { checked: boolean }).checked).toBe(true);
  });
  it('scroll', () => {
    const { nodes } = eventsToNodes([ev({ type: 'scroll', selector: '#el' })]);
    expect(nodes[0].type).toBe('scroll');
    expect((nodes[0].data as { direction: string; amount: number }).direction).toBe('down');
    expect((nodes[0].data as { amount: number }).amount).toBe(300);
  });
  it('hover', () => {
    const { nodes } = eventsToNodes([ev({ type: 'hover', selector: '#el' })]);
    expect(nodes[0].type).toBe('hover');
  });
  it('pressKey', () => {
    const { nodes } = eventsToNodes([ev({ type: 'pressKey', selector: '', key: 'Enter' })]);
    expect(nodes[0].type).toBe('pressKey');
    expect((nodes[0].data as { key: string }).key).toBe('Enter');
  });
  it('dragDrop', () => {
    const { nodes } = eventsToNodes([ev({ type: 'dragDrop', selector: '#src', targetSelector: '#tgt' })]);
    expect(nodes[0].type).toBe('dragDrop');
    expect((nodes[0].data as { targetSelector: string }).targetSelector).toBe('#tgt');
  });
  it('uploadFile', () => {
    const { nodes } = eventsToNodes([ev({ type: 'uploadFile', selector: '#inp', value: 'f.pdf' })]);
    expect(nodes[0].type).toBe('uploadFile');
    expect((nodes[0].data as { fileName: string }).fileName).toBe('f.pdf');
  });
  it('paste', () => {
    const { nodes } = eventsToNodes([ev({ type: 'paste', selector: '#el', value: 'txt' })]);
    expect(nodes[0].type).toBe('paste');
    expect((nodes[0].data as { text: string }).text).toBe('txt');
  });
  it('goBack', () => {
    const { nodes } = eventsToNodes([ev({ type: 'goBack', selector: '' })]);
    expect(nodes[0].type).toBe('goBack');
  });
  it('goForward', () => {
    const { nodes } = eventsToNodes([ev({ type: 'goForward', selector: '' })]);
    expect(nodes[0].type).toBe('goForward');
  });
  it('reload', () => {
    const { nodes } = eventsToNodes([ev({ type: 'reload', selector: '' })]);
    expect(nodes[0].type).toBe('reload');
  });
});

describe('eventsToNodes layout and wiring', () => {
  it('places nodes in horizontal chain at y=300', () => {
    const { nodes } = eventsToNodes([ev({}), ev({})]);
    expect(nodes[0].position.y).toBe(300);
    expect(nodes[1].position.x).toBeGreaterThan(nodes[0].position.x);
  });

  it('wires edges between consecutive nodes', () => {
    const { nodes, edges } = eventsToNodes([ev({}), ev({})]);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(nodes[0].id);
    expect(edges[0].target).toBe(nodes[1].id);
  });

  it('returns empty arrays for empty input', () => {
    const { nodes, edges } = eventsToNodes([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it('each node gets unique id', () => {
    const { nodes } = eventsToNodes([ev({}), ev({}), ev({})]);
    const ids = nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(3);
  });
});

import { act, renderHook } from '@testing-library/react';
import { useWorkflowStore } from '../store';
import type { RecordedEvent } from '../types';

const makeEvent = (overrides: Partial<RecordedEvent> = {}): RecordedEvent => ({
  type: 'click',
  selector: '#btn',
  selectorStrategy: 'css',
  timestamp: Date.now(),
  url: 'https://example.com',
  frameId: 0,
  ...overrides,
});

beforeEach(() => {
  useWorkflowStore.setState({
    recordingState: 'idle',
    capturedEvents: [],
    nodes: [],
    edges: [],
    past: [],
    future: [],
  });
});

test('initial recordingState is idle', () => {
  const { result } = renderHook(() => useWorkflowStore());
  expect(result.current.recordingState).toBe('idle');
});

test('appendEvent adds event to capturedEvents', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.appendEvent(makeEvent()));
  expect(result.current.capturedEvents).toHaveLength(1);
});

test('importRecording converts events to nodes on canvas', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.importRecording([makeEvent({ type: 'click', selector: '#a' })]));
  expect(result.current.nodes).toHaveLength(1);
  expect(result.current.nodes[0].type).toBe('click');
  expect(result.current.recordingState).toBe('idle');
});

test('importRecording wires edges between nodes', () => {
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.importRecording([
    makeEvent({ type: 'click', selector: '#a' }),
    makeEvent({ type: 'fill', selector: '#b', value: 'x' }),
  ]));
  expect(result.current.edges).toHaveLength(1);
});

test('discardRecording clears events and resets state', () => {
  useWorkflowStore.setState({ capturedEvents: [makeEvent()], recordingState: 'reviewing' });
  const { result } = renderHook(() => useWorkflowStore());
  act(() => result.current.discardRecording());
  expect(result.current.capturedEvents).toHaveLength(0);
  expect(result.current.recordingState).toBe('idle');
});

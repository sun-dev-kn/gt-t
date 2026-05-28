import { render, screen } from '@testing-library/react';
import { TriggerNode } from '../nodes/TriggerNode';
import { BrowserNode } from '../nodes/BrowserNode';
import { ControlNode } from '../nodes/ControlNode';
import { nodeTypes } from '../nodes/index';

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    Handle: ({ id }: { id: string }) => <div data-testid={`handle-${id}`} />,
  };
});

const baseProps = {
  id: 'test',
  selected: false,
  dragging: false,
  isConnectable: true,
  zIndex: 0,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  type: 'trigger',
};

test('TriggerNode renders schedule subtype', () => {
  render(<TriggerNode {...baseProps} data={{ subtype: 'schedule', intervalHours: 12 }} />);
  expect(screen.getAllByText(/Schedule/i).length).toBeGreaterThan(0);
});

test('TriggerNode renders manual subtype', () => {
  render(<TriggerNode {...baseProps} data={{ subtype: 'manual' }} />);
  expect(screen.getAllByText(/Manual/i).length).toBeGreaterThan(0);
});

test('BrowserNode renders navigate label', () => {
  render(<BrowserNode {...baseProps} type="navigate" data={{ subtype: 'navigate', url: 'https://x.com' }} />);
  expect(screen.getByText(/Navigate/i)).toBeInTheDocument();
});

test('ControlNode renders loop subtype', () => {
  render(<ControlNode {...baseProps} type="loop" data={{ subtype: 'loop', maxIterations: 10, continueVariable: 'hasNext' }} />);
  expect(screen.getByText(/Loop/i)).toBeInTheDocument();
});

test('nodeTypes registry contains expected keys', () => {
  const keys = Object.keys(nodeTypes);
  expect(keys).toContain('trigger');
  expect(keys).toContain('navigate');
  expect(keys).toContain('extract');
  expect(keys).toContain('loop');
  expect(keys).toContain('sendToBackend');
});

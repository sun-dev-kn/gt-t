import { render, screen } from '@testing-library/react';
import { TriggerNode } from '../nodes/TriggerNode';
import { BrowserNode } from '../nodes/BrowserNode';
import { ControlNode } from '../nodes/ControlNode';
import { WaitNode } from '../nodes/WaitNode';
import { DataNode } from '../nodes/DataNode';
import { AccountNode } from '../nodes/AccountNode';
import { OutputNode } from '../nodes/OutputNode';
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
  draggable: true,
  selectable: true,
  deletable: true,
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

test('WaitNode renders delay subtype', () => {
  render(<WaitNode {...baseProps} type="delay" data={{ subtype: 'delay', ms: 2000 }} />);
  const items = screen.getAllByText(/Delay/i);
  expect(items.length).toBeGreaterThan(0);
});

test('DataNode renders extract subtype', () => {
  render(<DataNode {...baseProps} type="extract" data={{ subtype: 'extract', fields: [], varName: 'result' }} />);
  const items = screen.getAllByText(/Extract/i);
  expect(items.length).toBeGreaterThan(0);
});

test('AccountNode renders injectCredentials subtype', () => {
  render(<AccountNode {...baseProps} type="injectCredentials" data={{ subtype: 'injectCredentials' }} />);
  expect(screen.getByText(/Inject Credentials/i)).toBeInTheDocument();
});

test('OutputNode renders sendToBackend subtype', () => {
  render(<OutputNode {...baseProps} type="sendToBackend" data={{ subtype: 'sendToBackend' }} />);
  expect(screen.getByText(/Send to Backend/i)).toBeInTheDocument();
});

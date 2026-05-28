import { render, screen, fireEvent } from '@testing-library/react';
import { Inspector } from './Inspector';
import { useWorkflowStore } from '../store';

vi.mock('../store', () => ({
  useWorkflowStore: vi.fn(),
}));

function mockStore(overrides: object) {
  (useWorkflowStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    nodes: [],
    selectedNodeId: null,
    updateNodeData: vi.fn(),
    ...overrides,
  });
}

test('shows empty state when nothing selected', () => {
  mockStore({ nodes: [], selectedNodeId: null });
  render(<Inspector />);
  const el = screen.getByTestId('inspector-empty');
  expect(el).toBeInTheDocument();
  expect(el).toHaveTextContent('Select a node to inspect');
});

test('shows navigate form', () => {
  const node = { id: 'n1', type: 'navigate', data: { subtype: 'navigate', url: 'https://example.com' } };
  mockStore({ nodes: [node], selectedNodeId: 'n1' });
  render(<Inspector />);
  const input = screen.getByTestId('url') as HTMLInputElement;
  expect(input).toBeInTheDocument();
  expect(input.value).toBe('https://example.com');
});

test('calls updateNodeData when url changes', () => {
  const updateNodeData = vi.fn();
  const node = { id: 'n1', type: 'navigate', data: { subtype: 'navigate', url: 'https://example.com' } };
  mockStore({ nodes: [node], selectedNodeId: 'n1', updateNodeData });
  render(<Inspector />);
  const input = screen.getByTestId('url');
  fireEvent.change(input, { target: { value: 'https://new.com' } });
  expect(updateNodeData).toHaveBeenCalledWith('n1', { subtype: 'navigate', url: 'https://new.com' });
});

test('shows schedule form with intervalHours', () => {
  const node = { id: 'n2', type: 'trigger', data: { subtype: 'schedule', intervalHours: 12 } };
  mockStore({ nodes: [node], selectedNodeId: 'n2' });
  render(<Inspector />);
  const input = screen.getByTestId('intervalHours') as HTMLInputElement;
  expect(input).toBeInTheDocument();
  expect(input.value).toBe('12');
});

test('shows empty state message for manual trigger', () => {
  const node = { id: 'n3', type: 'trigger', data: { subtype: 'manual' } };
  mockStore({ nodes: [node], selectedNodeId: 'n3' });
  render(<Inspector />);
  expect(screen.getByText('(no configuration)')).toBeInTheDocument();
});

test('shows condition form', () => {
  const node = {
    id: 'n4',
    type: 'condition',
    data: { subtype: 'condition', variable: 'myVar', operator: '==', value: '5' },
  };
  mockStore({ nodes: [node], selectedNodeId: 'n4' });
  render(<Inspector />);
  const varInput = screen.getByTestId('variable') as HTMLInputElement;
  expect(varInput).toBeInTheDocument();
  expect(varInput.value).toBe('myVar');
  const opSelect = screen.getByTestId('operator') as HTMLSelectElement;
  expect(opSelect).toBeInTheDocument();
  expect(opSelect.value).toBe('==');
});

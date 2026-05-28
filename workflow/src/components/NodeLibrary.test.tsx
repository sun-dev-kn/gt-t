import { render, screen, fireEvent } from '@testing-library/react';
import { NodeLibrary } from './NodeLibrary';

test('renders all categories', () => {
  render(<NodeLibrary />);
  expect(screen.getByText('Trigger')).toBeInTheDocument();
  expect(screen.getByText('Browser')).toBeInTheDocument();
  expect(screen.getByText('Wait')).toBeInTheDocument();
  expect(screen.getByText('Data')).toBeInTheDocument();
  expect(screen.getByText('Control')).toBeInTheDocument();
  expect(screen.getByText('Account')).toBeInTheDocument();
  expect(screen.getByText('Output')).toBeInTheDocument();
});

test('renders all node type labels', () => {
  render(<NodeLibrary />);
  expect(screen.getByText('Schedule')).toBeInTheDocument();
  expect(screen.getByText('Manual')).toBeInTheDocument();
  expect(screen.getByText('Navigate')).toBeInTheDocument();
  expect(screen.getByText('Click')).toBeInTheDocument();
  expect(screen.getByText('Fill')).toBeInTheDocument();
  expect(screen.getByText('Scroll')).toBeInTheDocument();
  expect(screen.getByText('Hover')).toBeInTheDocument();
  expect(screen.getByText('Wait for selector')).toBeInTheDocument();
  expect(screen.getByText('Delay')).toBeInTheDocument();
  expect(screen.getByText('Network idle')).toBeInTheDocument();
  expect(screen.getByText('Extract')).toBeInTheDocument();
  expect(screen.getByText('Extract table')).toBeInTheDocument();
  expect(screen.getByText('Condition')).toBeInTheDocument();
  expect(screen.getByText('Loop')).toBeInTheDocument();
  expect(screen.getByText('Merge')).toBeInTheDocument();
  expect(screen.getByText('Inject credentials')).toBeInTheDocument();
  expect(screen.getByText('Switch account')).toBeInTheDocument();
  expect(screen.getByText('Send to backend')).toBeInTheDocument();
  expect(screen.getByText('Save locally')).toBeInTheDocument();
});

test('drag sets correct dataTransfer type', () => {
  render(<NodeLibrary />);
  const el = screen.getByTestId('node-type-navigate');
  const dt = { setData: vi.fn(), effectAllowed: '' };
  fireEvent.dragStart(el, { dataTransfer: dt });
  expect(dt.setData).toHaveBeenCalledWith('application/reactflow-nodetype', 'navigate');
});

test('drag sets effectAllowed to move', () => {
  render(<NodeLibrary />);
  const el = screen.getByTestId('node-type-navigate');
  const dt = { setData: vi.fn(), effectAllowed: '' };
  fireEvent.dragStart(el, { dataTransfer: dt });
  expect(dt.effectAllowed).toBe('move');
});

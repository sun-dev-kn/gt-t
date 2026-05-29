import React from 'react';
import { render } from '@testing-library/react';
import { useInternalNode, ReactFlowProvider } from '@xyflow/react';
import { TypedEdge } from './TypedEdge';
import { Position } from '@xyflow/react';
import { useWorkflowStore } from '../store';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useInternalNode: vi.fn(),
    getBezierPath: vi.fn(() => ['M0 0', 50, 50]),
    BaseEdge: ({ id, path, style, className, onMouseEnter, onMouseLeave }: { id: string; path: string; style?: React.CSSProperties; className?: string; onMouseEnter?: () => void; onMouseLeave?: () => void }) => (
      <path id={id} d={path} style={style} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />
    ),
    EdgeLabelRenderer: ({ children }: { children?: React.ReactNode }) => <div data-testid="edge-label-renderer">{children}</div>,
  };
});

vi.mock('../store', () => ({
  useWorkflowStore: vi.fn(() => ({ onEdgesChange: vi.fn() })),
}));

const baseProps = {
  id: 'edge-1',
  source: 'n1',
  target: 'n2',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  animated: false,
  selectable: true,
  deletable: true,
  data: {},
};

const defaultProps = baseProps;

test('renders without invalid class for compatible ports', () => {
  // trigger 'out' (flow) → navigate 'in' (flow) — compatible
  (useInternalNode as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
    if (id === 'n1') return { type: 'trigger' };
    if (id === 'n2') return { type: 'navigate' };
    return undefined;
  });

  const { container } = render(
    <svg>
      <TypedEdge {...baseProps} sourceHandleId="out" targetHandleId="in" />
    </svg>
  );

  const pathEl = container.querySelector('path#edge-1');
  expect(pathEl).toBeTruthy();
  const cls = pathEl?.getAttribute('class') ?? '';
  expect(cls).not.toContain('edge-invalid');
});

test('renders edge-invalid class for incompatible ports', () => {
  // trigger 'out' (flow) → extract 'out' (data) — incompatible
  (useInternalNode as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
    if (id === 'n1') return { type: 'trigger' };
    if (id === 'n2') return { type: 'extract' };
    return undefined;
  });

  const { container } = render(
    <svg>
      <TypedEdge {...baseProps} sourceHandleId="out" targetHandleId="out" />
    </svg>
  );

  const pathEl = container.querySelector('path#edge-1');
  expect(pathEl).toBeTruthy();
  expect(pathEl?.getAttribute('class')).toContain('edge-invalid');
});

test('renders without invalid class when handles unknown', () => {
  // unknown handle IDs — portsCompatible returns true (allow), so isInvalid = false
  (useInternalNode as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
    if (id === 'n1') return { type: 'trigger' };
    if (id === 'n2') return { type: 'navigate' };
    return undefined;
  });

  const { container } = render(
    <svg>
      <TypedEdge {...baseProps} sourceHandleId={null} targetHandleId={null} />
    </svg>
  );

  const pathEl = container.querySelector('path#edge-1');
  expect(pathEl).toBeTruthy();
  const cls = pathEl?.getAttribute('class') ?? '';
  expect(cls).not.toContain('edge-invalid');
});

it('shows delete button when edge is selected', () => {
  (useInternalNode as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
    if (id === 'n1') return { type: 'trigger' };
    if (id === 'n2') return { type: 'navigate' };
    return undefined;
  });
  const { getByText } = render(
    <ReactFlowProvider>
      <TypedEdge {...defaultProps} selected={true} />
    </ReactFlowProvider>
  );
  expect(getByText('×')).toBeDefined();
});

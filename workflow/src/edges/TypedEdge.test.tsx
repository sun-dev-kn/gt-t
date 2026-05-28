import React from 'react';
import { render } from '@testing-library/react';
import { useInternalNode } from '@xyflow/react';
import { TypedEdge } from './TypedEdge';
import { Position } from '@xyflow/react';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useInternalNode: vi.fn(),
    getBezierPath: vi.fn(() => ['M0 0']),
    BaseEdge: ({ id, path, style, className }: { id: string; path: string; style?: React.CSSProperties; className?: string }) => (
      <path id={id} d={path} style={style} className={className} />
    ),
  };
});

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

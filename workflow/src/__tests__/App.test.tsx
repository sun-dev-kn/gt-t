import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../App';

// Mock @xyflow/react to avoid canvas errors in jsdom
vi.mock('@xyflow/react', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="react-flow">{children}</div>,
  ReactFlow: ({ children }: { children?: React.ReactNode }) => <div data-testid="react-flow">{children}</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  addEdge: vi.fn(),
  applyNodeChanges: vi.fn((_, nodes) => nodes),
  applyEdgeChanges: vi.fn((_, edges) => edges),
}));

// Mock child components
vi.mock('../components/NodeLibrary', () => ({ NodeLibrary: () => <div data-testid="node-library" /> }));
vi.mock('../components/Inspector', () => ({ Inspector: () => <div data-testid="inspector" /> }));
vi.mock('../components/Toolbar', () => ({ Toolbar: () => <div data-testid="toolbar" /> }));
vi.mock('../components/RecordingPanel', () => ({ RecordingPanel: () => null }));

describe('App', () => {
  it('renders main layout components', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('node-library')).toBeDefined();
    expect(getByTestId('inspector')).toBeDefined();
    expect(getByTestId('toolbar')).toBeDefined();
  });
});

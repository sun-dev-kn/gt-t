import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from './Toolbar';
import { useWorkflowStore } from '../store';

vi.mock('../store', () => ({
  useWorkflowStore: vi.fn(),
}));

function mockStore(overrides: object) {
  (useWorkflowStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    workflowName: 'My Workflow',
    workflowDomain: 'example.com',
    setWorkflowName: vi.fn(),
    setWorkflowDomain: vi.fn(),
    past: [],
    future: [],
    undo: vi.fn(),
    redo: vi.fn(),
    saveCurrentWorkflow: vi.fn(),
    resetWorkflow: vi.fn(),
    ...overrides,
  });
}

describe('Toolbar', () => {
  it('renders all toolbar elements', () => {
    mockStore({});
    render(<Toolbar />);
    expect(screen.getByTestId('toolbar')).toBeDefined();
    expect(screen.getByTestId('workflow-name')).toBeDefined();
    expect(screen.getByTestId('workflow-domain')).toBeDefined();
    expect(screen.getByTestId('btn-undo')).toBeDefined();
    expect(screen.getByTestId('btn-redo')).toBeDefined();
    expect(screen.getByTestId('btn-save')).toBeDefined();
    expect(screen.getByTestId('btn-new')).toBeDefined();
  });

  it('undo disabled when no history', () => {
    mockStore({ past: [] });
    render(<Toolbar />);
    const undoBtn = screen.getByTestId('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
  });

  it('undo enabled when history exists', () => {
    mockStore({ past: [{ nodes: [], edges: [] }] });
    render(<Toolbar />);
    const undoBtn = screen.getByTestId('btn-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);
  });

  it('calls setWorkflowName on change', () => {
    const setWorkflowName = vi.fn();
    mockStore({ setWorkflowName });
    render(<Toolbar />);
    const input = screen.getByTestId('workflow-name');
    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(setWorkflowName).toHaveBeenCalledWith('New Name');
  });

  it('calls undo on click', () => {
    const undo = vi.fn();
    mockStore({ past: [{ nodes: [], edges: [] }], undo });
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('btn-undo'));
    expect(undo).toHaveBeenCalled();
  });

  it('calls saveCurrentWorkflow on save click', () => {
    const saveCurrentWorkflow = vi.fn();
    mockStore({ saveCurrentWorkflow });
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('btn-save'));
    expect(saveCurrentWorkflow).toHaveBeenCalled();
  });
});

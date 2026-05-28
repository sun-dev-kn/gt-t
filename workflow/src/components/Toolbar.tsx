import { useWorkflowStore } from '../store';

export function Toolbar() {
  const {
    workflowName,
    workflowDomain,
    setWorkflowName,
    setWorkflowDomain,
    past,
    future,
    undo,
    redo,
    saveCurrentWorkflow,
    resetWorkflow,
  } = useWorkflowStore();

  return (
    <div data-testid="toolbar" className="wf-toolbar">
      <input
        data-testid="workflow-name"
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        placeholder="Workflow name"
      />
      <input
        data-testid="workflow-domain"
        value={workflowDomain}
        onChange={(e) => setWorkflowDomain(e.target.value)}
        placeholder="Domain (e.g. producthunt.com)"
      />
      <button data-testid="btn-undo" onClick={undo} disabled={past.length === 0}>
        Undo
      </button>
      <button data-testid="btn-redo" onClick={redo} disabled={future.length === 0}>
        Redo
      </button>
      <button data-testid="btn-save" onClick={() => saveCurrentWorkflow()}>
        Save
      </button>
      <button data-testid="btn-new" onClick={() => resetWorkflow()}>
        New
      </button>
    </div>
  );
}

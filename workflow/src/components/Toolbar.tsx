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
    recordingState,
    capturedEvents,
    startRecording,
    stopRecording,
  } = useWorkflowStore();

  const isRecording = recordingState === 'recording';
  const isReviewing = recordingState === 'reviewing' || recordingState === 'error';

  return (
    <div
      data-testid="toolbar"
      className="wf-toolbar"
      style={isRecording ? { borderBottom: '2px solid #e94560' } : undefined}
    >
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

      {/* Recording state display */}
      {isRecording && (
        <span
          data-testid="recording-indicator"
          style={{ color: '#e94560', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span
            style={{
              width: 8, height: 8, background: '#e94560', borderRadius: '50%',
              boxShadow: '0 0 0 3px rgba(233,69,96,0.25)',
              display: 'inline-block',
              animation: 'pulse 1.2s infinite',
            }}
          />
          RECORDING — {workflowDomain || 'new tab'} — {capturedEvents.length} actions
        </span>
      )}

      {/* Record / Stop button */}
      {!isRecording && !isReviewing && (
        <button
          data-testid="btn-record"
          onClick={startRecording}
          style={{ marginLeft: 'auto', background: '#e94560', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ width: 7, height: 7, background: '#fff', borderRadius: '50%', display: 'inline-block' }} />
          Record
        </button>
      )}
      {isRecording && (
        <button
          data-testid="btn-stop"
          onClick={stopRecording}
          style={{ marginLeft: 'auto', background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
        >
          ■ Stop
        </button>
      )}

      <button
        data-testid="btn-save"
        onClick={() => saveCurrentWorkflow()}
        style={isRecording ? { opacity: 0.5 } : undefined}
      >
        Save
      </button>
      <button data-testid="btn-new" onClick={() => resetWorkflow()}>
        New
      </button>
    </div>
  );
}

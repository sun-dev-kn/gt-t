import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '../store';
import type { RecordedEvent } from '../types';

const ACTION_ICON: Partial<Record<RecordedEvent['type'], string>> = {
  navigate: '→', click: '↙', dblclick: '↙↙', rightClick: '⋮',
  fill: 'T', selectOption: '▾', check: '☑', scroll: '↕',
  hover: '◎', pressKey: '⌨', dragDrop: '↔', uploadFile: '📎',
  paste: '⎘', goBack: '◁', goForward: '▷', reload: '↺',
};

const ACTION_COLOR: Partial<Record<RecordedEvent['type'], string>> = {
  navigate: '#22d3ee', click: '#3b82f6', dblclick: '#3b82f6', rightClick: '#3b82f6',
  fill: '#8b5cf6', selectOption: '#8b5cf6', check: '#8b5cf6', scroll: '#64748b',
  hover: '#64748b', pressKey: '#f59e0b', dragDrop: '#3b82f6', uploadFile: '#3b82f6',
  paste: '#8b5cf6', goBack: '#ec4899', goForward: '#ec4899', reload: '#ec4899',
};

interface EventRowProps {
  event: RecordedEvent;
  checked?: boolean;
  onToggle?: () => void;
  reviewMode?: boolean;
}

function EventRow({ event, checked, onToggle, reviewMode }: EventRowProps) {
  const color = ACTION_COLOR[event.type] ?? '#94a3b8';
  const icon = ACTION_ICON[event.type] ?? '•';
  const selector = event.selector ? (event.selector.length > 20 ? event.selector.slice(0, 18) + '…' : event.selector) : event.url;
  const isXpath = event.selectorStrategy === 'xpath';

  return (
    <div
      style={{
        background: '#0f172a',
        border: isXpath ? '1px solid #1e3a5f' : 'none',
        borderRadius: 3,
        padding: '4px 6px',
        fontSize: 12,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        opacity: reviewMode && !checked ? 0.45 : 1,
      }}
    >
      {reviewMode && (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          style={{ accentColor: color, flexShrink: 0 }}
        />
      )}
      <span style={{ color, fontWeight: 700, minWidth: 14 }}>{icon}</span>
      <span style={{ color: '#94a3b8' }}>{event.type}</span>
      <span style={{ color: '#475569', marginLeft: 'auto', fontSize: 11 }}>
        {selector}{isXpath && ' ⚠'}
      </span>
    </div>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  no_domain: 'No domain set — enter a domain (e.g. example.com) in the toolbar.',
  no_runtime: 'Extension runtime unavailable. Open this page from the extension popup.',
  connect_failed: 'Could not connect to extension background. Try reloading.',
  tab_create_failed: 'Failed to open the recording tab. Check the domain is correct.',
  disconnected: 'Recording ended — tab was closed.',
};

export function RecordingPanel() {
  const { recordingState, recordingError, capturedEvents, importRecording, discardRecording } = useWorkflowStore();
  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    if (recordingState === 'reviewing') {
      setChecked(capturedEvents.map(() => true));
    }
  }, [recordingState, capturedEvents]);

  if (recordingState === 'idle') return null;

  const selectedEvents = capturedEvents.filter((_, i) => checked[i] ?? true);
  const selectedCount = recordingState === 'reviewing' ? selectedEvents.length : capturedEvents.length;

  return (
    <div
      data-testid="recording-panel"
      style={{
        width: 220,
        minWidth: 220,
        background: '#0a1628',
        borderLeft: '1px solid #1e3a5f',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
          {recordingState === 'reviewing' ? 'REVIEW ACTIONS' : 'CAPTURED ACTIONS'}
        </span>
        <span style={{ color: '#475569', fontSize: 11 }}>{selectedCount}</span>
      </div>

      {/* Error banner */}
      {recordingState === 'error' && (
        <div style={{ background: '#450a0a', borderBottom: '1px solid #7f1d1d', padding: '6px 10px', fontSize: 11, color: '#f87171' }}>
          {recordingError ? (ERROR_MESSAGES[recordingError] ?? `Recording failed (${recordingError}).`) : 'Recording failed.'}
        </div>
      )}

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {capturedEvents.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 16 }}>
            {recordingState === 'recording' ? 'Interact in the opened tab…' : 'Nothing was captured.'}
          </div>
        ) : (
          capturedEvents.map((ev, i) => (
            <EventRow
              key={i}
              event={ev}
              checked={checked[i] ?? true}
              onToggle={() => setChecked((prev) => prev.map((v, j) => j === i ? !v : v))}
              reviewMode={recordingState === 'reviewing'}
            />
          ))
        )}
      </div>

      {/* Import / Discard buttons — reviewing mode only */}
      {(recordingState === 'reviewing' || recordingState === 'error') && (
        <div style={{ padding: 8, borderTop: '1px solid #1e3a5f', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            data-testid="btn-import"
            disabled={selectedCount === 0}
            onClick={() => importRecording(selectedEvents)}
            style={{
              background: selectedCount === 0 ? '#1e293b' : '#22d3ee',
              color: selectedCount === 0 ? '#475569' : '#0f172a',
              border: 'none',
              borderRadius: 4,
              padding: '6px 0',
              fontSize: 12,
              fontWeight: 700,
              cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Import {selectedCount} node{selectedCount !== 1 ? 's' : ''} to canvas
          </button>
          <button
            data-testid="btn-discard"
            onClick={discardRecording}
            style={{ background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 4, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

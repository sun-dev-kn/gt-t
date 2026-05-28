import React from 'react';
import { useWorkflowStore } from '../store';
import type { NodeData, WorkflowNode } from '../types';

// ─── Field helpers ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: '#94a3b8',
          marginBottom: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 4,
  color: '#e2e8f0',
  fontSize: 13,
  padding: '4px 8px',
  boxSizing: 'border-box',
};

// ─── NodeForm ─────────────────────────────────────────────────────────────────

interface NodeFormProps {
  node: WorkflowNode;
  onChange: (data: NodeData) => void;
}

function NodeForm({ node, onChange }: NodeFormProps) {
  const d = node.data;

  switch (d.subtype) {
    // ── Trigger ──────────────────────────────────────────────────────────────
    case 'schedule':
      return (
        <Field label="Interval (hours)">
          <input
            type="number"
            data-testid="intervalHours"
            style={inputStyle}
            value={d.intervalHours}
            onChange={(e) => onChange({ ...d, intervalHours: Number(e.target.value) })}
          />
        </Field>
      );
    case 'manual':
      return <div style={{ color: '#64748b', fontSize: 13 }}>(no configuration)</div>;

    // ── Browser ──────────────────────────────────────────────────────────────
    case 'navigate':
      return (
        <Field label="URL">
          <input
            type="text"
            data-testid="url"
            style={inputStyle}
            value={d.url}
            onChange={(e) => onChange({ ...d, url: e.target.value })}
          />
        </Field>
      );
    case 'click':
      return (
        <Field label="Selector">
          <input
            type="text"
            data-testid="selector"
            style={inputStyle}
            value={d.selector}
            onChange={(e) => onChange({ ...d, selector: e.target.value })}
          />
        </Field>
      );
    case 'fill':
      return (
        <>
          <Field label="Selector">
            <input
              type="text"
              data-testid="selector"
              style={inputStyle}
              value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })}
            />
          </Field>
          <Field label="Value">
            <input
              type="text"
              data-testid="value"
              style={inputStyle}
              value={d.value}
              onChange={(e) => onChange({ ...d, value: e.target.value })}
            />
          </Field>
        </>
      );
    case 'scroll':
      return (
        <>
          <Field label="Selector">
            <input
              type="text"
              data-testid="selector"
              style={inputStyle}
              value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })}
            />
          </Field>
          <Field label="Direction">
            <select
              data-testid="direction"
              style={inputStyle}
              value={d.direction}
              onChange={(e) => onChange({ ...d, direction: e.target.value as 'down' | 'up' })}
            >
              <option value="down">down</option>
              <option value="up">up</option>
            </select>
          </Field>
          <Field label="Amount">
            <input
              type="number"
              data-testid="amount"
              style={inputStyle}
              value={d.amount}
              onChange={(e) => onChange({ ...d, amount: Number(e.target.value) })}
            />
          </Field>
        </>
      );
    case 'hover':
      return (
        <Field label="Selector">
          <input
            type="text"
            data-testid="selector"
            style={inputStyle}
            value={d.selector}
            onChange={(e) => onChange({ ...d, selector: e.target.value })}
          />
        </Field>
      );

    // ── Wait ─────────────────────────────────────────────────────────────────
    case 'waitForSelector':
      return (
        <>
          <Field label="Selector">
            <input
              type="text"
              data-testid="selector"
              style={inputStyle}
              value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })}
            />
          </Field>
          <Field label="Timeout (ms)">
            <input
              type="number"
              data-testid="timeoutMs"
              style={inputStyle}
              value={d.timeoutMs}
              onChange={(e) => onChange({ ...d, timeoutMs: Number(e.target.value) })}
            />
          </Field>
        </>
      );
    case 'delay':
      return (
        <Field label="Delay (ms)">
          <input
            type="number"
            data-testid="ms"
            style={inputStyle}
            value={d.ms}
            onChange={(e) => onChange({ ...d, ms: Number(e.target.value) })}
          />
        </Field>
      );
    case 'networkIdle':
      return <div style={{ color: '#64748b', fontSize: 13 }}>(no configuration)</div>;

    // ── Data ─────────────────────────────────────────────────────────────────
    case 'extract':
      return (
        <>
          <Field label="Variable name">
            <input
              type="text"
              data-testid="varName"
              style={inputStyle}
              value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })}
            />
          </Field>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
            (fields editing not implemented)
          </div>
        </>
      );
    case 'extractTable':
      return (
        <>
          <Field label="Selector">
            <input
              type="text"
              data-testid="selector"
              style={inputStyle}
              value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })}
            />
          </Field>
          <Field label="Variable name">
            <input
              type="text"
              data-testid="varName"
              style={inputStyle}
              value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })}
            />
          </Field>
        </>
      );

    // ── Control ──────────────────────────────────────────────────────────────
    case 'condition':
      return (
        <>
          <Field label="Variable">
            <input
              type="text"
              data-testid="variable"
              style={inputStyle}
              value={d.variable}
              onChange={(e) => onChange({ ...d, variable: e.target.value })}
            />
          </Field>
          <Field label="Operator">
            <select
              data-testid="operator"
              style={inputStyle}
              value={d.operator}
              onChange={(e) =>
                onChange({ ...d, operator: e.target.value as '==' | '!=' | '>' | '<' | 'contains' })
              }
            >
              <option value="==">==</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value="contains">contains</option>
            </select>
          </Field>
          <Field label="Value">
            <input
              type="text"
              data-testid="value"
              style={inputStyle}
              value={d.value}
              onChange={(e) => onChange({ ...d, value: e.target.value })}
            />
          </Field>
        </>
      );
    case 'loop':
      return (
        <>
          <Field label="Max iterations">
            <input
              type="number"
              data-testid="maxIterations"
              style={inputStyle}
              value={d.maxIterations}
              onChange={(e) => onChange({ ...d, maxIterations: Number(e.target.value) })}
            />
          </Field>
          <Field label="Continue variable">
            <input
              type="text"
              data-testid="continueVariable"
              style={inputStyle}
              value={d.continueVariable}
              onChange={(e) => onChange({ ...d, continueVariable: e.target.value })}
            />
          </Field>
        </>
      );
    case 'merge':
      return <div style={{ color: '#64748b', fontSize: 13 }}>(no configuration)</div>;

    // ── Account ──────────────────────────────────────────────────────────────
    case 'injectCredentials':
      return <div style={{ color: '#64748b', fontSize: 13 }}>(no configuration)</div>;
    case 'switchAccount':
      return <div style={{ color: '#64748b', fontSize: 13 }}>(no configuration)</div>;

    // ── Output ───────────────────────────────────────────────────────────────
    case 'sendToBackend':
      return (
        <Field label="Endpoint (optional)">
          <input
            type="text"
            data-testid="endpoint"
            style={inputStyle}
            value={d.endpoint ?? ''}
            onChange={(e) => onChange({ ...d, endpoint: e.target.value })}
          />
        </Field>
      );
    case 'saveLocally':
      return <div style={{ color: '#64748b', fontSize: 13 }}>(no configuration)</div>;

    default:
      return <div style={{ color: '#64748b', fontSize: 13 }}>(unknown node type)</div>;
  }
}

// ─── Inspector ────────────────────────────────────────────────────────────────

export function Inspector() {
  const { nodes, selectedNodeId, updateNodeData } = useWorkflowStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  if (!selectedNode) {
    return (
      <div
        data-testid="inspector-empty"
        style={{
          padding: '24px 16px',
          color: '#475569',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        Select a node to inspect
      </div>
    );
  }

  return (
    <div
      data-testid="inspector"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div
        className="wf-inspector-header"
        style={{
          padding: '10px 14px',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#94a3b8',
          borderBottom: '1px solid #1e293b',
          background: '#0f172a',
        }}
      >
        {selectedNode.type}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <NodeForm
          node={selectedNode}
          onChange={(data) => updateNodeData(selectedNode.id, data)}
        />
      </div>
    </div>
  );
}

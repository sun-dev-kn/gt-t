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
    case 'doubleClick':
      return (
        <Field label="Selector">
          <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
            onChange={(e) => onChange({ ...d, selector: e.target.value })} />
        </Field>
      );
    case 'rightClick':
      return (
        <Field label="Selector">
          <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
            onChange={(e) => onChange({ ...d, selector: e.target.value })} />
        </Field>
      );
    case 'selectOption':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Value">
            <input type="text" data-testid="value" style={inputStyle} value={d.value}
              onChange={(e) => onChange({ ...d, value: e.target.value })} />
          </Field>
        </>
      );
    case 'check':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Checked">
            <select data-testid="checked" style={inputStyle} value={String(d.checked)}
              onChange={(e) => onChange({ ...d, checked: e.target.value === 'true' })}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </Field>
        </>
      );
    case 'pressKey':
      return (
        <Field label="Key (e.g. Enter, Control+a)">
          <input type="text" data-testid="key" style={inputStyle} value={d.key}
            onChange={(e) => onChange({ ...d, key: e.target.value })} />
        </Field>
      );
    case 'dragDrop':
      return (
        <>
          <Field label="Source selector">
            <input type="text" data-testid="sourceSelector" style={inputStyle} value={d.sourceSelector}
              onChange={(e) => onChange({ ...d, sourceSelector: e.target.value })} />
          </Field>
          <Field label="Target selector">
            <input type="text" data-testid="targetSelector" style={inputStyle} value={d.targetSelector}
              onChange={(e) => onChange({ ...d, targetSelector: e.target.value })} />
          </Field>
        </>
      );
    case 'uploadFile':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="File name">
            <input type="text" data-testid="fileName" style={inputStyle} value={d.fileName}
              onChange={(e) => onChange({ ...d, fileName: e.target.value })} />
          </Field>
        </>
      );
    case 'paste':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Text">
            <input type="text" data-testid="text" style={inputStyle} value={d.text}
              onChange={(e) => onChange({ ...d, text: e.target.value })} />
          </Field>
        </>
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
    case 'waitForUrl':
      return (
        <>
          <Field label="URL pattern">
            <input type="text" data-testid="pattern" style={inputStyle} value={d.pattern}
              onChange={(e) => onChange({ ...d, pattern: e.target.value })} />
          </Field>
          <Field label="Timeout (ms)">
            <input type="number" data-testid="timeoutMs" style={inputStyle} value={d.timeoutMs}
              onChange={(e) => onChange({ ...d, timeoutMs: Number(e.target.value) })} />
          </Field>
        </>
      );
    case 'waitForVisible':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Visible">
            <select data-testid="visible" style={inputStyle} value={String(d.visible)}
              onChange={(e) => onChange({ ...d, visible: e.target.value === 'true' })}>
              <option value="true">visible</option>
              <option value="false">hidden</option>
            </select>
          </Field>
          <Field label="Timeout (ms)">
            <input type="number" data-testid="timeoutMs" style={inputStyle} value={d.timeoutMs}
              onChange={(e) => onChange({ ...d, timeoutMs: Number(e.target.value) })} />
          </Field>
        </>
      );

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
    case 'getCurrentUrl':
      return (
        <Field label="Variable name">
          <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
            onChange={(e) => onChange({ ...d, varName: e.target.value })} />
        </Field>
      );
    case 'getValue':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
          </Field>
        </>
      );
    case 'screenshot':
      return (
        <Field label="Variable name">
          <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
            onChange={(e) => onChange({ ...d, varName: e.target.value })} />
        </Field>
      );
    case 'countElements':
      return (
        <>
          <Field label="Selector">
            <input type="text" data-testid="selector" style={inputStyle} value={d.selector}
              onChange={(e) => onChange({ ...d, selector: e.target.value })} />
          </Field>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
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
    case 'forEach':
      return (
        <>
          <Field label="List variable">
            <input type="text" data-testid="listVar" style={inputStyle} value={d.listVar}
              onChange={(e) => onChange({ ...d, listVar: e.target.value })} />
          </Field>
          <Field label="Item variable">
            <input type="text" data-testid="itemVar" style={inputStyle} value={d.itemVar}
              onChange={(e) => onChange({ ...d, itemVar: e.target.value })} />
          </Field>
        </>
      );
    case 'tryCatch':
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

    // ── Variable ─────────────────────────────────────────────────────────────
    case 'setVariable':
      return (
        <>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
          </Field>
          <Field label="Value (supports ${varName})">
            <input type="text" data-testid="value" style={inputStyle} value={d.value}
              onChange={(e) => onChange({ ...d, value: e.target.value })} />
          </Field>
        </>
      );
    case 'setArray':
      return (
        <>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
          </Field>
          <Field label="Items (one per line)">
            <textarea
              data-testid="items"
              style={{ ...inputStyle, height: 80, resize: 'vertical' }}
              value={d.items.join('\n')}
              onChange={(e) => onChange({ ...d, items: e.target.value.split('\n') })}
            />
          </Field>
        </>
      );
    case 'setObject':
      return (
        <>
          <Field label="Variable name">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName}
              onChange={(e) => onChange({ ...d, varName: e.target.value })} />
          </Field>
          <Field label="Key-value pairs">
            {d.pairs.map((pair, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="key"
                  value={pair.key}
                  onChange={(e) => {
                    const pairs = d.pairs.map((p, j) => j === i ? { ...p, key: e.target.value } : p);
                    onChange({ ...d, pairs });
                  }}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="value"
                  value={pair.value}
                  onChange={(e) => {
                    const pairs = d.pairs.map((p, j) => j === i ? { ...p, value: e.target.value } : p);
                    onChange({ ...d, pairs });
                  }}
                />
              </div>
            ))}
            <button
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 3, padding: '2px 8px', fontSize: 12, cursor: 'pointer', marginTop: 2 }}
              onClick={() => onChange({ ...d, pairs: [...d.pairs, { key: '', value: '' }] })}
            >
              + Add pair
            </button>
          </Field>
        </>
      );
    // ── Page / Tab ────────────────────────────────────────────────────────────
    case 'goBack':
    case 'goForward':
    case 'reload':
    case 'closeTab':
      return <div style={{ color: '#64748b', fontSize: 13 }}>(no configuration)</div>;
    case 'openTab':
      return (
        <Field label="URL">
          <input type="text" data-testid="url" style={inputStyle} value={d.url}
            onChange={(e) => onChange({ ...d, url: e.target.value })} />
        </Field>
      );
    case 'switchTab':
      return (
        <Field label="URL pattern">
          <input type="text" data-testid="urlPattern" style={inputStyle} value={d.urlPattern}
            onChange={(e) => onChange({ ...d, urlPattern: e.target.value })} />
        </Field>
      );
    case 'runScript':
      return (
        <>
          <Field label="Script (JS)">
            <textarea
              data-testid="script"
              style={{ ...inputStyle, height: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
              value={d.script}
              onChange={(e) => onChange({ ...d, script: e.target.value })}
            />
          </Field>
          <Field label="Store result in variable (optional)">
            <input type="text" data-testid="varName" style={inputStyle} value={d.varName ?? ''}
              onChange={(e) => onChange({ ...d, varName: e.target.value || undefined })} />
          </Field>
        </>
      );
    // ── Human ─────────────────────────────────────────────────────────────────
    case 'notifyUser':
      return (
        <>
          <Field label="Title">
            <input type="text" data-testid="title" style={inputStyle} value={d.title}
              onChange={(e) => onChange({ ...d, title: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea data-testid="message" style={{ ...inputStyle, height: 60, resize: 'vertical' }}
              value={d.message} onChange={(e) => onChange({ ...d, message: e.target.value })} />
          </Field>
          <Field label="Wait for dismiss">
            <select data-testid="waitForDismiss" style={inputStyle} value={String(d.waitForDismiss)}
              onChange={(e) => onChange({ ...d, waitForDismiss: e.target.value === 'true' })}>
              <option value="true">Yes — pause execution</option>
              <option value="false">No — continue immediately</option>
            </select>
          </Field>
        </>
      );

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

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DataNodeData } from '../types';

const HEADER = (d: DataNodeData): string => {
  switch (d.subtype) {
    case 'extract':       return 'Extract';
    case 'extractTable':  return 'Extract Table';
    case 'getCurrentUrl': return 'Get URL';
    case 'getValue':      return 'Get Value';
    case 'screenshot':    return 'Screenshot';
    case 'countElements': return 'Count Elements';
  }
};

const LABEL = (d: DataNodeData): string => {
  switch (d.subtype) {
    case 'extract':       return `${d.fields.length} field(s) → ${d.varName}`;
    case 'extractTable':  return `${d.selector} → ${d.varName}`;
    case 'getCurrentUrl': return `→ ${d.varName}`;
    case 'getValue':      return `${d.selector} → ${d.varName}`;
    case 'screenshot':    return `→ ${d.varName}`;
    case 'countElements': return `${d.selector} → ${d.varName}`;
  }
};

export function DataNode({ data, selected }: NodeProps & { data: DataNodeData }) {
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#34d399' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#34d399' }}>{HEADER(data)}</div>
      <div className="wf-node-label">{LABEL(data)}</div>
      <Handle type="source" position={Position.Right} id="out" style={{ background: '#34d399' }} />
    </div>
  );
}

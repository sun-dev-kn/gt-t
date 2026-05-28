import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DataNodeData } from '../types';

export function DataNode({ data, selected }: NodeProps & { data: DataNodeData }) {
  const header = data.subtype === 'extract' ? 'Extract' : 'Extract Table';
  const label = data.subtype === 'extract'
    ? `${data.fields.length} field(s) → ${data.varName}`
    : `${data.selector} → ${data.varName}`;

  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#34d399' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#34d399' }}>{header}</div>
      <div className="wf-node-label">{label}</div>
      <Handle type="source" position={Position.Right} id="out" style={{ background: '#34d399' }} />
    </div>
  );
}

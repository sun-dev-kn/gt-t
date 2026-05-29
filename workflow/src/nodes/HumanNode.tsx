import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { HumanData } from '../types';

export function HumanNode({ data, selected }: NodeProps & { data: HumanData }) {
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#f97316' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#f97316' }}>Notify User</div>
      <div className="wf-node-label">
        {data.title || '(title)'}
        {data.waitForDismiss && ' ⏸'}
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

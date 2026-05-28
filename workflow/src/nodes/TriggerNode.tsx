import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TriggerData } from '../types';

export function TriggerNode({ data, selected }: NodeProps & { data: TriggerData }) {
  const label = data.subtype === 'schedule'
    ? `Schedule · ${data.intervalHours}h`
    : 'Manual Trigger';

  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#22d3ee' }}>
      <div className="wf-node-header" style={{ color: '#22d3ee' }}>
        {data.subtype === 'schedule' ? 'Schedule' : 'Manual'}
      </div>
      <div className="wf-node-label">{label}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OutputData } from '../types';

export function OutputNode({ data, selected }: NodeProps & { data: OutputData }) {
  const label = data.subtype === 'sendToBackend'
    ? `POST ${data.endpoint || '/api/launches'}`
    : 'Save Locally';

  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#fb923c' }}>
      <Handle type="target" position={Position.Left} id="in-flow" />
      <Handle type="target" position={Position.Top} id="in-data" style={{ background: '#34d399' }} />
      <div className="wf-node-header" style={{ color: '#fb923c' }}>
        {data.subtype === 'sendToBackend' ? 'Send to Backend' : 'Save Locally'}
      </div>
      <div className="wf-node-label">{label}</div>
      {data.subtype === 'sendToBackend' && (
        <>
          <Handle type="source" position={Position.Right} id="out-success" style={{ top: '35%' }} />
          <Handle type="source" position={Position.Right} id="out-error" style={{ top: '65%', background: '#e94560' }} />
        </>
      )}
      {data.subtype === 'saveLocally' && (
        <Handle type="source" position={Position.Right} id="out" />
      )}
    </div>
  );
}

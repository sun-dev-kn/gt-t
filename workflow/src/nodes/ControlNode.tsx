import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ControlData } from '../types';

export function ControlNode({ data, selected }: NodeProps & { data: ControlData }) {
  if (data.subtype === 'loop') {
    return (
      <div className={`wf-node wf-loop-node${selected ? ' selected' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="wf-node-header" style={{ color: '#e94560' }}>Loop</div>
        <div className="wf-node-label">max {data.maxIterations} · {data.continueVariable}</div>
        <Handle type="source" position={Position.Right} id="out-loop" style={{ top: '40%' }} />
        <Handle type="source" position={Position.Right} id="out-done" style={{ top: '70%', background: '#34d399' }} />
      </div>
    );
  }

  if (data.subtype === 'condition') {
    return (
      <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#f97316' }}>
        <Handle type="target" position={Position.Left} id="in" />
        <Handle type="target" position={Position.Top} id="in-data" style={{ background: '#34d399' }} />
        <div className="wf-node-header" style={{ color: '#f97316' }}>Condition</div>
        <div className="wf-node-label">{data.variable} {data.operator} {data.value}</div>
        <Handle type="source" position={Position.Right} id="out-true" style={{ top: '35%' }} />
        <Handle type="source" position={Position.Right} id="out-false" style={{ top: '65%', background: '#e94560' }} />
      </div>
    );
  }

  if (data.subtype === 'forEach') {
    return (
      <div className={`wf-node wf-loop-node${selected ? ' selected' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="wf-node-header" style={{ color: '#e94560' }}>For Each</div>
        <div className="wf-node-label">{data.listVar} → {data.itemVar}</div>
        <Handle type="source" position={Position.Right} id="out-loop" style={{ top: '40%' }} />
        <Handle type="source" position={Position.Right} id="out-done" style={{ top: '70%', background: '#34d399' }} />
      </div>
    );
  }

  if (data.subtype === 'tryCatch') {
    return (
      <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#f97316' }}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="wf-node-header" style={{ color: '#f97316' }}>Try / Catch</div>
        <Handle type="source" position={Position.Right} id="out-try" style={{ top: '40%' }} />
        <Handle type="source" position={Position.Right} id="out-catch" style={{ top: '70%', background: '#e94560' }} />
      </div>
    );
  }

  // merge
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#94a3b8' }}>
      <Handle type="target" position={Position.Left} id="in-a" style={{ top: '30%' }} />
      <Handle type="target" position={Position.Left} id="in-b" style={{ top: '55%' }} />
      <Handle type="target" position={Position.Left} id="in-err" style={{ top: '80%', background: '#e94560' }} />
      <div className="wf-node-header" style={{ color: '#94a3b8' }}>Merge</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

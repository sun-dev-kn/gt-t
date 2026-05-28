import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WaitData } from '../types';

const LABEL = (d: WaitData): string => {
  switch (d.subtype) {
    case 'waitForSelector': return `Wait: ${d.selector} (${d.timeoutMs}ms)`;
    case 'delay':           return `Delay ${d.ms}ms`;
    case 'networkIdle':     return 'Network Idle';
  }
};

const HEADER = (d: WaitData): string => {
  switch (d.subtype) {
    case 'waitForSelector': return 'Wait Selector';
    case 'delay':           return 'Delay';
    case 'networkIdle':     return 'Network Idle';
  }
};

export function WaitNode({ data, selected }: NodeProps & { data: WaitData }) {
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#fbbf24' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#fbbf24' }}>{HEADER(data)}</div>
      <div className="wf-node-label">{LABEL(data)}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

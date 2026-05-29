import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WaitData } from '../types';

const HEADER = (d: WaitData): string => {
  switch (d.subtype) {
    case 'waitForSelector': return 'Wait Selector';
    case 'delay':           return 'Delay';
    case 'networkIdle':     return 'Network Idle';
    case 'waitForUrl':      return 'Wait for URL';
    case 'waitForVisible':  return 'Wait Visible';
  }
};

const LABEL = (d: WaitData): string => {
  switch (d.subtype) {
    case 'waitForSelector': return `${d.selector || '(selector)'} (${d.timeoutMs ?? 0}ms)`;
    case 'delay':           return `${d.ms}ms`;
    case 'networkIdle':     return '';
    case 'waitForUrl':      return `${d.pattern || '(pattern)'} (${d.timeoutMs ?? 0}ms)`;
    case 'waitForVisible':  return `${d.selector || '(selector)'} ${d.visible ? 'visible' : 'hidden'}`;
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

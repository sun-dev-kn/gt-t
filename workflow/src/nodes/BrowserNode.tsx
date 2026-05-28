import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BrowserData } from '../types';

const LABELS: Record<BrowserData['subtype'], string> = {
  navigate: 'Navigate',
  click: 'Click',
  fill: 'Fill',
  scroll: 'Scroll',
  hover: 'Hover',
};

const DETAIL = (d: BrowserData): string => {
  switch (d.subtype) {
    case 'navigate': return d.url;
    case 'click':    return d.selector;
    case 'fill':     return `${d.selector} = ${d.value}`;
    case 'scroll':   return `${d.selector} ${d.direction} ${d.amount}px`;
    case 'hover':    return d.selector;
  }
};

export function BrowserNode({ data, selected }: NodeProps & { data: BrowserData }) {
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#a78bfa' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#a78bfa' }}>{LABELS[data.subtype]}</div>
      <div className="wf-node-label">{DETAIL(data)}</div>
      <Handle type="source" position={Position.Right} id="out-success" />
      <Handle type="source" position={Position.Bottom} id="out-error" style={{ background: '#e94560' }} />
    </div>
  );
}

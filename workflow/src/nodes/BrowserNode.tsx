import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BrowserData } from '../types';

const LABELS: Record<BrowserData['subtype'], string> = {
  navigate:     'Navigate',
  click:        'Click',
  fill:         'Fill',
  scroll:       'Scroll',
  hover:        'Hover',
  doubleClick:  'Double Click',
  rightClick:   'Right Click',
  selectOption: 'Select Option',
  check:        'Check',
  pressKey:     'Press Key',
  dragDrop:     'Drag & Drop',
  uploadFile:   'Upload File',
  paste:        'Paste',
};

const DETAIL = (d: BrowserData): string => {
  switch (d.subtype) {
    case 'navigate':     return d.url || '(url)';
    case 'click':        return d.selector || '(selector)';
    case 'fill':         return `${d.selector || '(selector)'} → ${d.value || '…'}`;
    case 'scroll':       return `${d.selector || '(selector)'} ${d.direction || 'down'} ${d.amount ?? 0}px`;
    case 'hover':        return d.selector || '(selector)';
    case 'doubleClick':  return d.selector || '(selector)';
    case 'rightClick':   return d.selector || '(selector)';
    case 'selectOption': return `${d.selector || '(selector)'} = ${d.value || '…'}`;
    case 'check':        return `${d.selector || '(selector)'} ${d.checked ? '☑' : '☐'}`;
    case 'pressKey':     return d.key || '(key)';
    case 'dragDrop':     return `${d.sourceSelector || '(src)'} → ${d.targetSelector || '(tgt)'}`;
    case 'uploadFile':   return `${d.selector || '(selector)'} — ${d.fileName || '(file)'}`;
    case 'paste':        return `${d.selector || '(selector)'} ← clipboard`;
  }
};

const NO_ERR = new Set<BrowserData['subtype']>(['pressKey', 'paste']);

export function BrowserNode({ data, selected }: NodeProps & { data: BrowserData }) {
  const hasErrorPath = !NO_ERR.has(data.subtype);
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#3b82f6' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#3b82f6' }}>{LABELS[data.subtype]}</div>
      <div className="wf-node-label">{DETAIL(data)}</div>
      {hasErrorPath ? (
        <>
          <Handle type="source" position={Position.Right} id="out-success" style={{ top: '40%' }} />
          <Handle type="source" position={Position.Right} id="out-error" style={{ top: '70%', background: '#e94560' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="out" />
      )}
    </div>
  );
}

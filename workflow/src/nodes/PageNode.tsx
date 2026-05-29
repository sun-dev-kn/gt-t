import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PageData } from '../types';

const HEADER: Record<PageData['subtype'], string> = {
  goBack:    'Go Back',
  goForward: 'Go Forward',
  reload:    'Reload',
  openTab:   'Open Tab',
  closeTab:  'Close Tab',
  switchTab: 'Switch Tab',
  runScript: 'Run Script',
};

const LABEL = (d: PageData): string => {
  switch (d.subtype) {
    case 'openTab':   return d.url || '(url)';
    case 'switchTab': return d.urlPattern || '(pattern)';
    case 'runScript': return d.varName ? `→ ${d.varName}` : '(script)';
    default:          return '';
  }
};

export function PageNode({ data, selected }: NodeProps & { data: PageData }) {
  const hasDataOut = data.subtype === 'runScript';
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#ec4899' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#ec4899' }}>{HEADER[data.subtype]}</div>
      <div className="wf-node-label">{LABEL(data)}</div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={hasDataOut ? { background: '#34d399' } : undefined}
      />
    </div>
  );
}

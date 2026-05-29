import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VariableData } from '../types';

const HEADER: Record<VariableData['subtype'], string> = {
  setVariable: 'Set Variable',
  setArray:    'Set Array',
  setObject:   'Set Object',
};

const LABEL = (d: VariableData): string => {
  switch (d.subtype) {
    case 'setVariable': return `${d.varName} = ${d.value || '…'}`;
    case 'setArray':    return `${d.varName} [${d.items.length} items]`;
    case 'setObject':   return `${d.varName} {${d.pairs.length} keys}`;
  }
};

export function VariableNode({ data, selected }: NodeProps & { data: VariableData }) {
  const isData = data.subtype === 'setArray' || data.subtype === 'setObject';
  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#06b6d4' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#06b6d4' }}>{HEADER[data.subtype]}</div>
      <div className="wf-node-label">{LABEL(data)}</div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={isData ? { background: '#34d399' } : undefined}
      />
    </div>
  );
}

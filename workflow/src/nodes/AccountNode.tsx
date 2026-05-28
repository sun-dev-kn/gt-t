import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AccountData } from '../types';

export function AccountNode({ data, selected }: NodeProps & { data: AccountData }) {
  const label = data.subtype === 'injectCredentials' ? 'Inject Credentials' : 'Switch Account';

  return (
    <div className={`wf-node${selected ? ' selected' : ''}`} style={{ borderTopColor: '#60a5fa' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="wf-node-header" style={{ color: '#60a5fa' }}>Account</div>
      <div className="wf-node-label">{label}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

import { getBezierPath, BaseEdge, useInternalNode, type EdgeProps } from '@xyflow/react';
import { portsCompatible } from '../types';

export function TypedEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  source, target, sourceHandleId, targetHandleId,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const isInvalid = sourceNode?.type != null && targetNode?.type != null
    && sourceHandleId != null && targetHandleId != null
    && !portsCompatible(sourceNode.type, sourceHandleId, targetNode.type, targetHandleId);

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      className={isInvalid ? 'edge-invalid' : undefined}
      style={{
        stroke: isInvalid ? '#e94560' : selected ? '#ffffff' : '#475569',
        strokeWidth: selected ? 2 : 1.5,
      }}
    />
  );
}

import { getBezierPath, BaseEdge, useNodes, type EdgeProps } from '@xyflow/react';
import { HANDLE_TYPES } from '../types';

export function TypedEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  source, target, sourceHandleId, targetHandleId,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const nodes = useNodes();
  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);

  const srcType = sourceNode?.type && sourceHandleId ? HANDLE_TYPES[sourceNode.type]?.[sourceHandleId] : undefined;
  const tgtType = targetNode?.type && targetHandleId ? HANDLE_TYPES[targetNode.type]?.[targetHandleId] : undefined;
  const isInvalid = srcType !== undefined && tgtType !== undefined && srcType !== tgtType;

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

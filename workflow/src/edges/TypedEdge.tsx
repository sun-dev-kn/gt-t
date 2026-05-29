import { useState } from 'react';
import { getBezierPath, BaseEdge, useInternalNode, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { portsCompatible } from '../types';
import { useWorkflowStore } from '../store';

export function TypedEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  source, target, sourceHandleId, targetHandleId, selected }: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const isInvalid = sourceNode?.type != null && targetNode?.type != null
    && sourceHandleId != null && targetHandleId != null
    && !portsCompatible(sourceNode.type, sourceHandleId, targetNode.type, targetHandleId);
  const onEdgesChange = useWorkflowStore(s => s.onEdgesChange);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={20}
        className={isInvalid ? 'edge-invalid' : undefined}
        style={{ stroke: isInvalid ? '#e94560' : selected ? '#ffffff' : '#475569', strokeWidth: selected ? 2 : 1.5 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {(hovered || selected) && (
        <EdgeLabelRenderer>
          <button
            className="edge-delete-btn"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={(e) => {
              e.stopPropagation();
              onEdgesChange([{ type: 'remove', id }]);
            }}
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

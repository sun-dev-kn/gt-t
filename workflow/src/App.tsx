import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore } from './store';
import { nodeTypes } from './nodes';
import { getDefaultData } from './nodes/defaults';
import { edgeTypes } from './edges';
import { NodeLibrary } from './components/NodeLibrary';
import { Inspector } from './components/Inspector';
import { Toolbar } from './components/Toolbar';
import { RecordingPanel } from './components/RecordingPanel';
import { NodeContextMenu, PaneContextMenu } from './components/ContextMenu';

type CtxMenu =
  | { kind: 'node'; x: number; y: number; nodeId: string }
  | { kind: 'pane'; x: number; y: number; flowX: number; flowY: number };

export default function App() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect: storeOnConnect,
    addNode,
    setSelectedNodeId,
    undo,
    redo,
  } = useWorkflowStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfRef = useRef<any>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      storeOnConnect(connection);
    },
    [storeOnConnect],
  );

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: { id: string }) => {
    e.preventDefault();
    setCtxMenu({ kind: 'node', x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    const evt = e as React.MouseEvent;
    const flowPos = rfRef.current?.screenToFlowPosition({ x: evt.clientX, y: evt.clientY }) ?? { x: evt.clientX, y: evt.clientY };
    setCtxMenu({ kind: 'pane', x: evt.clientX, y: evt.clientY, flowX: flowPos.x, flowY: flowPos.y });
  }, []);

  const handleAddFromContext = useCallback((subtype: string, flowX: number, flowY: number) => {
    const defaultData = getDefaultData(subtype);
    if (!defaultData) return;
    addNode({
      id: crypto.randomUUID(),
      position: { x: flowX - 75, y: flowY - 20 },
      data: defaultData,
      type: subtype,
    });
  }, [addNode]);

  const onDragOver: React.DragEventHandler<HTMLDivElement> = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('application/reactflow-nodetype');
      if (!nodeType || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: e.clientX - bounds.left - 75,
        y: e.clientY - bounds.top - 20,
      };

      const defaultData = getDefaultData(nodeType);
      if (!defaultData) return;

      addNode({
        id: crypto.randomUUID(),
        position,
        data: defaultData,
        type: nodeType,
      });
    },
    [addNode],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return (
    <div className="wf-app">
      <Toolbar />
      <div className="wf-main">
        <NodeLibrary />
        <div className="wf-canvas" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={(instance) => { rfRef.current = instance; }}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => { setSelectedNodeId(null); setCtxMenu(null); }}
            onNodeContextMenu={onNodeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            defaultEdgeOptions={{ type: 'typed' }}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor="#334155"
              maskColor="rgba(15, 23, 42, 0.6)"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            />
          </ReactFlow>
        </div>
        <Inspector />
        <RecordingPanel />
      </div>

      {ctxMenu?.kind === 'node' && (
        <NodeContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          nodeId={ctxMenu.nodeId}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {ctxMenu?.kind === 'pane' && (
        <PaneContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onAddNode={(subtype) => {
            if (ctxMenu.kind !== 'pane') return;
            handleAddFromContext(subtype, ctxMenu.flowX, ctxMenu.flowY);
          }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef } from 'react';
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
import { edgeTypes } from './edges';
import { NodeLibrary } from './components/NodeLibrary';
import { Inspector } from './components/Inspector';
import { Toolbar } from './components/Toolbar';
import { RecordingPanel } from './components/RecordingPanel';
import type { NodeData } from './types';

function getDefaultData(nodeType: string): NodeData | null {
  switch (nodeType) {
    case 'trigger': return { subtype: 'manual' };
    case 'schedule': return { subtype: 'schedule', intervalHours: 24 };
    case 'manual': return { subtype: 'manual' };
    case 'navigate': return { subtype: 'navigate', url: '' };
    case 'click': return { subtype: 'click', selector: '' };
    case 'fill': return { subtype: 'fill', selector: '', value: '' };
    case 'scroll': return { subtype: 'scroll', selector: '', direction: 'down', amount: 300 };
    case 'hover': return { subtype: 'hover', selector: '' };
    case 'waitForSelector': return { subtype: 'waitForSelector', selector: '', timeoutMs: 5000 };
    case 'delay': return { subtype: 'delay', ms: 1000 };
    case 'networkIdle': return { subtype: 'networkIdle' };
    case 'extract': return { subtype: 'extract', fields: [], varName: '' };
    case 'extractTable': return { subtype: 'extractTable', selector: '', varName: '' };
    case 'condition': return { subtype: 'condition', variable: '', operator: '==', value: '' };
    case 'loop': return { subtype: 'loop', maxIterations: 10, continueVariable: '' };
    case 'merge': return { subtype: 'merge' };
    case 'injectCredentials': return { subtype: 'injectCredentials' };
    case 'switchAccount': return { subtype: 'switchAccount' };
    case 'sendToBackend': return { subtype: 'sendToBackend' };
    case 'saveLocally': return { subtype: 'saveLocally' };
    case 'doubleClick':    return { subtype: 'doubleClick', selector: '' };
    case 'rightClick':     return { subtype: 'rightClick', selector: '' };
    case 'selectOption':   return { subtype: 'selectOption', selector: '', value: '' };
    case 'check':          return { subtype: 'check', selector: '', checked: true };
    case 'pressKey':       return { subtype: 'pressKey', key: 'Enter' };
    case 'dragDrop':       return { subtype: 'dragDrop', sourceSelector: '', targetSelector: '' };
    case 'uploadFile':     return { subtype: 'uploadFile', selector: '', fileName: '' };
    case 'paste':          return { subtype: 'paste', selector: '', text: '' };
    case 'waitForUrl':     return { subtype: 'waitForUrl', pattern: '', timeoutMs: 5000 };
    case 'waitForVisible': return { subtype: 'waitForVisible', selector: '', visible: true, timeoutMs: 5000 };
    case 'getCurrentUrl':  return { subtype: 'getCurrentUrl', varName: '' };
    case 'getValue':       return { subtype: 'getValue', selector: '', varName: '' };
    case 'screenshot':     return { subtype: 'screenshot', varName: '' };
    case 'countElements':  return { subtype: 'countElements', selector: '', varName: '' };
    case 'forEach':        return { subtype: 'forEach', listVar: '', itemVar: 'item' };
    case 'tryCatch':       return { subtype: 'tryCatch' };
    case 'setVariable':    return { subtype: 'setVariable', varName: '', value: '' };
    case 'setArray':       return { subtype: 'setArray', varName: '', items: [] };
    case 'setObject':      return { subtype: 'setObject', varName: '', pairs: [] };
    case 'goBack':         return { subtype: 'goBack' };
    case 'goForward':      return { subtype: 'goForward' };
    case 'reload':         return { subtype: 'reload' };
    case 'openTab':        return { subtype: 'openTab', url: '' };
    case 'closeTab':       return { subtype: 'closeTab' };
    case 'switchTab':      return { subtype: 'switchTab', urlPattern: '' };
    case 'runScript':      return { subtype: 'runScript', script: '' };
    case 'notifyUser':     return { subtype: 'notifyUser', title: '', message: '', waitForDismiss: false };
    default: return null;
  }
}

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

  const onConnect: OnConnect = useCallback(
    (connection) => {
      storeOnConnect(connection);
    },
    [storeOnConnect],
  );

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
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
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
    </div>
  );
}

import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Edge,
} from '@xyflow/react';
import type { WorkflowNode, NodeData, RecordedEvent } from './types';
import { saveWorkflow } from './storage/workflows';
import { eventsToNodes } from './recording/eventsToNodes';

// Module-level port reference — survives Zustand state object replacement after set() calls.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _recordingPort: any = null;

type HistoryEntry = { nodes: WorkflowNode[]; edges: Edge[] };

interface WorkflowStore {
  // React Flow state
  nodes: WorkflowNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Workflow metadata
  workflowName: string;
  workflowDomain: string;
  setWorkflowMeta: (name: string, domain: string) => void;
  setWorkflowName: (name: string) => void;
  setWorkflowDomain: (domain: string) => void;
  saveCurrentWorkflow: () => Promise<void>;

  // History
  past: HistoryEntry[];
  future: HistoryEntry[];
  snapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Node operations
  addNode: (node: WorkflowNode) => void;
  deleteNode: (id: string) => void;
  updateNodeData: (id: string, data: NodeData) => void;

  // Selection
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;

  // Load / reset
  loadWorkflow: (nodes: WorkflowNode[], edges: Edge[], name: string, domain: string) => void;
  resetWorkflow: () => void;

  // Recording
  recordingState: 'idle' | 'recording' | 'reviewing' | 'error';
  capturedEvents: RecordedEvent[];
  startRecording(): void;
  stopRecording(): void;
  importRecording(selected: RecordedEvent[]): void;
  discardRecording(): void;
  appendEvent(event: RecordedEvent): void;
  setRecordingState(state: 'idle' | 'recording' | 'reviewing' | 'error'): void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],
  workflowName: 'Untitled Workflow',
  workflowDomain: '',
  past: [],
  future: [],
  selectedNodeId: null,
  recordingState: 'idle' as const,
  capturedEvents: [],

  setWorkflowMeta(name, domain) {
    set({ workflowName: name, workflowDomain: domain });
  },

  setWorkflowName(name) {
    set({ workflowName: name });
  },

  setWorkflowDomain(domain) {
    set({ workflowDomain: domain });
  },

  async saveCurrentWorkflow() {
    const { workflowName, workflowDomain, nodes, edges } = get();
    await saveWorkflow({ name: workflowName, domain: workflowDomain, nodes, edges });
  },

  snapshot() {
    const { nodes, edges, past } = get();
    set({
      past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(-50),
      future: [],
    });
  },

  undo() {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: past.slice(0, -1),
      future: [{ nodes: structuredClone(nodes), edges: structuredClone(edges) }, ...future].slice(0, 50),
    });
  },

  redo() {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(-50),
      future: future.slice(1),
    });
  },

  onNodesChange(changes: NodeChange[]) {
    const hasDragEnd = changes.some((c) => c.type === 'position' && !c.dragging);
    const hasRemove  = changes.some((c) => c.type === 'remove');
    if (hasDragEnd || hasRemove) {
      const { nodes, edges, past } = get();
      set({
        past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(-50),
        future: [],
        nodes: applyNodeChanges(changes, nodes) as WorkflowNode[],
      });
    } else {
      set({ nodes: applyNodeChanges(changes, get().nodes) as WorkflowNode[] });
    }
  },

  onEdgesChange(changes) {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect(connection: Connection) {
    const { nodes, edges, past } = get();
    set({
      past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(-50),
      future: [],
      edges: addEdge({ ...connection, id: crypto.randomUUID(), type: 'typed' }, edges),
    });
  },

  addNode(node: WorkflowNode) {
    const { nodes, edges, past } = get();
    set({
      past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(-50),
      future: [],
      nodes: [...nodes, node],
    });
  },

  deleteNode(id: string) {
    const { nodes, edges, past } = get();
    set({
      past: [...past, { nodes: structuredClone(nodes), edges: structuredClone(edges) }].slice(-50),
      future: [],
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  updateNodeData(id: string, data: NodeData) {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data } : n
      ),
    });
  },

  selectNode(id) {
    set({ selectedNodeId: id });
  },

  setSelectedNodeId(id) {
    set({ selectedNodeId: id });
  },

  loadWorkflow(nodes, edges, name, domain) {
    set({ nodes, edges, workflowName: name, workflowDomain: domain, past: [], future: [] });
  },

  setRecordingState(state) {
    set({ recordingState: state });
  },

  appendEvent(event: RecordedEvent) {
    set((s) => ({ capturedEvents: [...s.capturedEvents, event] }));
  },

  startRecording() {
    if (_recordingPort) {
      try { _recordingPort.disconnect(); } catch { /* ignore */ }
      _recordingPort = null;
    }
    const { workflowDomain } = get();
    // Prefer browser (Firefox native) over chrome (Chrome / compatibility alias).
    // chrome.runtime can be undefined in Firefox extension pages even when browser.runtime is available.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runtime = (globalThis as any).browser?.runtime ?? (globalThis as any).chrome?.runtime;
    if (!runtime) {
      console.error('[DotGit] Extension runtime not available. Open the workflow designer from the extension.');
      set({ recordingState: 'error' });
      return;
    }
    set({ recordingState: 'recording', capturedEvents: [] });
    try {
      _recordingPort = runtime.connect({ name: 'designer-relay' });
    } catch (err) {
      console.error('[DotGit] Failed to connect to background script:', err);
      set({ recordingState: 'error' });
      return;
    }
    _recordingPort.onMessage.addListener((msg: { type: string; event?: RecordedEvent; events?: RecordedEvent[]; reason?: string }) => {
      if (msg.type === 'LIVE_EVENT' && msg.event) {
        get().appendEvent(msg.event);
      }
      if (msg.type === 'RECORDING_COMPLETE' && msg.events) {
        set({ capturedEvents: msg.events, recordingState: 'reviewing' });
      }
      if (msg.type === 'RECORDING_ERROR') {
        set({ recordingState: 'error' });
      }
    });
    _recordingPort.onDisconnect.addListener(() => {
      _recordingPort = null;
      if (get().recordingState === 'recording') {
        set({ recordingState: 'error' });
      }
    });
    _recordingPort.postMessage({ type: 'RECORDING_START', domain: workflowDomain || 'about:blank' });
  },

  stopRecording() {
    _recordingPort?.postMessage({ type: 'RECORDING_STOP' });
    _recordingPort = null;
  },

  importRecording(selected: RecordedEvent[]) {
    const { nodes: existingNodes, edges: existingEdges, past } = get();
    const { nodes: newNodes, edges: newEdges } = eventsToNodes(selected);
    set({
      past: [...past, { nodes: structuredClone(existingNodes), edges: structuredClone(existingEdges) }].slice(-50),
      future: [],
      nodes: [...existingNodes, ...newNodes],
      edges: [...existingEdges, ...newEdges],
      capturedEvents: [],
      recordingState: 'idle',
    });
  },

  discardRecording() {
    set({ capturedEvents: [], recordingState: 'idle' });
  },

  resetWorkflow() {
    set({
      nodes: [],
      edges: [],
      past: [],
      future: [],
      selectedNodeId: null,
      workflowName: 'Untitled Workflow',
      workflowDomain: '',
    });
  },
}));

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
import type { WorkflowNode, NodeData } from './types';

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
  saveCurrentWorkflow: () => void;

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
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],
  workflowName: 'Untitled Workflow',
  workflowDomain: '',
  past: [],
  future: [],
  selectedNodeId: null,

  setWorkflowMeta(name, domain) {
    set({ workflowName: name, workflowDomain: domain });
  },

  setWorkflowName(name) {
    set({ workflowName: name });
  },

  setWorkflowDomain(domain) {
    set({ workflowDomain: domain });
  },

  saveCurrentWorkflow() {
    // Serialise to JSON and write to browser.storage.local under the workflow name
    const { nodes, edges, workflowName, workflowDomain } = get();
    const payload = JSON.stringify({ name: workflowName, domain: workflowDomain, nodes, edges });
    try {
      (globalThis as Record<string, unknown> & { browser?: { storage?: { local?: { set?: (items: Record<string, unknown>) => void } } } }).browser?.storage?.local?.set?.({ [workflowName]: payload });
    } catch {
      // storage unavailable in test/dev environments — silently skip
    }
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
      edges: addEdge({ ...connection, type: 'typed' }, edges),
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

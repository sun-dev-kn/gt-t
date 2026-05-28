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

  // History
  past: HistoryEntry[];
  future: HistoryEntry[];
  snapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Node operations
  addNode: (node: WorkflowNode) => void;
  deleteNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;

  // Selection
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;

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

  onNodesChange(changes) {
    set({ nodes: applyNodeChanges(changes, get().nodes) as WorkflowNode[] });
  },

  onEdgesChange(changes) {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect(connection) {
    get().snapshot();
    set({ edges: addEdge({ ...connection, type: 'typed' }, get().edges) });
  },

  addNode(node) {
    get().snapshot();
    set({ nodes: [...get().nodes, node] });
  },

  deleteNode(id) {
    get().snapshot();
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  updateNodeData(id, data) {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } as NodeData } : n
      ),
    });
  },

  selectNode(id) {
    set({ selectedNodeId: id });
  },

  loadWorkflow(nodes, edges, name, domain) {
    set({ nodes, edges, workflowName: name, workflowDomain: domain, past: [], future: [] });
  },

  resetWorkflow() {
    set({ nodes: [], edges: [], past: [], future: [], selectedNodeId: null });
  },
}));

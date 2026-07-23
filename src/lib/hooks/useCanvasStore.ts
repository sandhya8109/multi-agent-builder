import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';

export type AgentNodeData = {
  label: string;
  role?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  outputKey?: string;
  status?: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';
};

export type CustomNode = Node<AgentNodeData>;

interface CanvasState {
  nodes: CustomNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange<CustomNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: CustomNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (type: 'input' | 'agent' | 'output') => void;
  updateNodeData: (nodeId: string, data: Partial<AgentNodeData>) => void;
  loadWorkflow: (nodes: CustomNode[], edges: Edge[]) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge({ ...connection, animated: true }, get().edges) });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (type) => {
    const id = `node_${Date.now()}`;
    const newNode: CustomNode = {
      id,
      type,
      position: { x: 250, y: get().nodes.length * 120 + 100 },
      data: {
        label: type === 'agent' ? 'AI Agent' : type === 'input' ? 'Workflow Input' : 'Final Output',
        role: type === 'agent' ? 'Assistant' : undefined,
        model: 'gpt-4o',
        systemPrompt: '',
        status: 'IDLE',
      },
    };
    set({ nodes: [...get().nodes, newNode] });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },

  loadWorkflow: (nodes, edges) => {
    set({ nodes, edges });
  },
}));
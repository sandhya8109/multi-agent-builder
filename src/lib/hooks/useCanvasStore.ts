import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';

export type CustomNode = Node;
export type NodeType = 'agent' | 'input' | 'output' | 'api';

interface CanvasState {
  nodes: CustomNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addAgentNode: () => void;
  addCustomNode: (
    type: NodeType,
    position?: { x: number; y: number },
    dataOverrides?: Record<string, any>
  ) => void;
  updateNodeData: (nodeId: string, data: Record<string, any>) => void;
  deleteNode: (nodeId: string) => void; // <-- Add this
  loadWorkflow: (nodes: CustomNode[], edges: Edge[]) => void;
}

const DEFAULT_NODE_CONFIGS: Record<NodeType, { label: string; defaultData: Record<string, any> }> = {
  agent: {
    label: 'Agent Node',
    defaultData: {
      label: 'New Agent',
      role: 'Assistant',
      systemPrompt: '',
      model: 'llama-3.3-70b-versatile',
      status: 'IDLE',
    },
  },
  input: {
    label: 'User Input',
    defaultData: {
      label: 'User Input',
      value: '',
      status: 'IDLE',
    },
  },
  output: {
    label: 'Final Output',
    defaultData: {
      label: 'Final Output',
      output: '',
      status: 'IDLE',
    },
  },
  api: {
    label: 'API Fetcher',
    defaultData: {
      label: 'API Fetcher',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      method: 'GET',
      status: 'IDLE',
    },
  },
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) => set({ edges: addEdge({ ...connection, animated: true }, get().edges) }),

  addCustomNode: (type, position, dataOverrides = {}) => {
    const currentNodes = get().nodes;
    const count = currentNodes.length;
    const newId = `node_${type}_${Date.now()}`;
    const config = DEFAULT_NODE_CONFIGS[type] || DEFAULT_NODE_CONFIGS.agent;

    const defaultPos = position || {
      x: 250 + (count % 3) * 50,
      y: 100 + count * 120,
    };

    const newNode: CustomNode = {
      id: newId,
      type,
      position: defaultPos,
      data: { ...config.defaultData, ...dataOverrides },
    };

    set({ nodes: [...currentNodes, newNode] });
  },

  addAgentNode: () => get().addCustomNode('agent'),

  updateNodeData: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      ),
    });
  },

  // Removes node AND any attached connection lines
  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  },

  loadWorkflow: (initialNodes, initialEdges) => {
    set({
      nodes: initialNodes || [],
      edges: initialEdges || [],
    });
  },
}));
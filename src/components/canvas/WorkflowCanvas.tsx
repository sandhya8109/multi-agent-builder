'use client';

import React, { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

import { AgentNode } from './custom-nodes/AgentNode';
import { InputNode } from './custom-nodes/InputNode';
import { OutputNode } from './custom-nodes/OutputNode';
import { ApiNode } from './custom-nodes/ApiNode';
import { RAGNode } from './custom-nodes/RAGNode';

// Registered with full aliases so any drag-and-drop node key maps correctly
const nodeTypes = {
  agent: AgentNode,
  agentNode: AgentNode,
  input: InputNode,
  inputNode: InputNode,
  output: OutputNode,
  outputNode: OutputNode,
  api: ApiNode,
  apiNode: ApiNode,
  apiFetcher: ApiNode,
  rag: RAGNode,
  ragNode: RAGNode,
};

interface WorkflowCanvasProps {
  workflowId: string;
  onNodeClick?: (id: string) => void;
}

function InnerWorkflowCanvas({ workflowId, onNodeClick }: WorkflowCanvasProps) {
  const { nodes,
  edges,
  setNodes,
  setEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  addNode, } = useCanvasStore((s: any) => s);

  const { screenToFlowPosition } = useReactFlow();

  // Workflow state (nodes/edges) is loaded exactly once, by the parent
  // CanvasWrapper, which owns `isLoading` and only mounts this component
  // once the Zustand store has been populated. Fetching here too used to
  // race CanvasWrapper's own load and could blow away real data with an
  // empty canvas depending on which request resolved last.

  // Handle Drag & Drop Node Creation
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `node_${type}_${Date.now()}`,
        type,
        position,
        data: {
          label: `${type.toUpperCase()} Node`,
          instructions: 'You are a helpful assistant.',
          model: 'llama-3.1-8b-instant',
          temperature: 0.3,
        },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  return (
    <div className="w-full h-full bg-slate-950" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        fitView
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls className="!bg-slate-900 !border-slate-800 !text-slate-200 fill-slate-200" />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-slate-900/80 !border-slate-800"
        />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerWorkflowCanvas {...props} />
    </ReactFlowProvider>
  );
}
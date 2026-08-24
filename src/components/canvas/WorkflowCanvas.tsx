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

function InnerWorkflowCanvas({ onNodeClick }: WorkflowCanvasProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const addNode = useCanvasStore((s) => s.addNode);

  const { screenToFlowPosition } = useReactFlow();

  // Note: canvas state is loaded once by CanvasWrapper on mount, so this
  // component no longer fetches the workflow itself (that caused a duplicate
  // request and a race that could blank the canvas).

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
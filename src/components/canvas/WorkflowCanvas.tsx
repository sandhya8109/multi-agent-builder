'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  Edge,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore, CustomNode, NodeType } from '@/lib/hooks/useCanvasStore';
import { AgentNode } from './custom-nodes/AgentNode';
import { InputNode } from './custom-nodes/InputNode';
import { OutputNode } from './custom-nodes/OutputNode';
import { ApiNode } from './custom-nodes/ApiNode';

const nodeTypes = {
  agent: AgentNode,
  input: InputNode,
  output: OutputNode,
  api: ApiNode,
};

interface WorkflowCanvasProps {
  initialNodes?: CustomNode[];
  initialEdges?: Edge[];
}

function InnerWorkflowCanvas({
  initialNodes = [],
  initialEdges = [],
}: WorkflowCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, loadWorkflow, addCustomNode } =
    useCanvasStore();

  const isInitialized = useRef(false);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    if (!isInitialized.current && initialNodes && initialNodes.length > 0) {
      loadWorkflow(initialNodes, initialEdges);
      isInitialized.current = true;
    }
  }, [initialNodes, initialEdges, loadWorkflow]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addCustomNode(type, position);
    },
    [screenToFlowPosition, addCustomNode]
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
        fitView
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls className="bg-slate-900 border-slate-800 text-slate-100 fill-slate-100" />
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
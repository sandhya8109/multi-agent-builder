'use client';

import { useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore, CustomNode } from '@/lib/hooks/useCanvasStore';
import { AgentNode } from './custom-nodes/AgentNode';
import { Button } from '@/components/ui/button';
import { Plus, Save } from 'lucide-react';

const nodeTypes: NodeTypes = {
  agent: AgentNode as any,
};

interface WorkflowCanvasProps {
  workflowId: string;
  initialNodes: CustomNode[];
  initialEdges: any[];
  onSave: () => void;
}

export function WorkflowCanvas({
  initialNodes,
  initialEdges,
  onSave,
}: WorkflowCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, loadWorkflow } =
    useCanvasStore();

  useEffect(() => {
    if (initialNodes.length > 0) {
      loadWorkflow(initialNodes, initialEdges);
    }
  }, [initialNodes, initialEdges, loadWorkflow]);

  return (
    <div className="w-full h-[calc(100vh-4rem)] relative bg-slate-950">
      {/* Canvas Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button size="sm" onClick={() => addNode('agent')} className="gap-1 bg-blue-600 hover:bg-blue-500">
          <Plus className="w-4 h-4" /> Add Agent Node
        </Button>
        <Button size="sm" variant="secondary" onClick={onSave} className="gap-1">
          <Save className="w-4 h-4" /> Save Canvas
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#334155" gap={16} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} className="bg-slate-900" />
      </ReactFlow>
    </div>
  );
}
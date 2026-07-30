'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { NodePalette } from '@/components/canvas/NodePalette';
import { ExecutionLogsSheet } from '@/components/canvas/ExecutionLogsSheet';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import { getLayoutedElements } from '@/lib/utils/layout';
import { Play, Save, LayoutGrid, Terminal } from 'lucide-react';

interface CanvasWrapperProps {
  workflowId: string;
}

export default function CanvasWrapper({ workflowId }: CanvasWrapperProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Zustand Canvas Store
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  // 1. Auto Layout Handler
  const handleAutoLayout = () => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  };

  // 2. Save Canvas Action
  const handleSaveCanvas = async () => {
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  // 3. Run Workflow Action
  const handleRunWorkflow = async () => {
    setIsRunning(true);
    await handleSaveCanvas();

    // Ensure nodes is always treated as an array
    const safeNodes = Array.isArray(nodes) ? nodes : [];

    safeNodes.forEach((node) => {
      if (node.type === 'agent') {
        updateNodeData(node.id, { status: 'RUNNING' });
      }
    });

    try {
      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_data: 'Start initial workflow execution.' }),
      });

      const resText = await res.text();
      let result: any = {};
      try {
        result = JSON.parse(resText);
      } catch {
        throw new Error(`Server returned non-JSON response (${res.status}).`);
      }

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Workflow execution failed');
      }

      setActiveRunId(result.runId);
      const outputs: Record<string, string> = result.outputs || {};

      safeNodes.forEach((node) => {
        if (node.type === 'agent' || node.type === 'output') {
          updateNodeData(node.id, {
            status: 'SUCCESS',
            output: outputs[node.id] || 'Step completed successfully.',
          });
        }
      });
    } catch (err: any) {
      console.error('Workflow Execution Error:', err);
      safeNodes.forEach((node) => {
        if (node.type === 'agent') {
          updateNodeData(node.id, { status: 'FAILED' });
        }
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header / Toolbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/80 px-4 flex items-center justify-between z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm tracking-wide text-slate-200">
            Canvas Workspace
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto Layout Button */}
          <Button
            onClick={handleAutoLayout}
            size="sm"
            variant="outline"
            className="border-slate-800 text-slate-300 hover:bg-slate-900 text-xs flex items-center gap-1.5"
            title="Auto-arrange canvas nodes"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-amber-400" /> Auto Layout
          </Button>

          {/* Save Button */}
          <Button
            onClick={handleSaveCanvas}
            size="sm"
            variant="outline"
            className="border-slate-800 text-slate-300 hover:bg-slate-900 text-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-blue-400" /> Save Canvas
          </Button>

          {/* Logs Button */}
          <Button
            onClick={() => setIsLogsOpen(true)}
            size="sm"
            variant="outline"
            className="border-slate-800 text-slate-300 hover:bg-slate-900 text-xs flex items-center gap-1.5"
          >
            <Terminal className="w-3.5 h-3.5 text-purple-400" /> Logs
          </Button>

          {/* Run Workflow Button */}
          <Button
            onClick={handleRunWorkflow}
            disabled={isRunning}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 px-4"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isRunning ? 'Running...' : 'Run Workflow'}
          </Button>
        </div>
      </header>

      {/* Main Canvas Body */}
      <div className="flex flex-1 relative overflow-hidden">
        <NodePalette />
        <div className="flex-1 h-full relative">
          <WorkflowCanvas workflowId={workflowId} />
        </div>
      </div>

      {/* Execution Logs Drawer */}
      <ExecutionLogsSheet
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        runId={activeRunId}
      />
    </div>
  );
}
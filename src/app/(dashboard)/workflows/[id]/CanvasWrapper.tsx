'use client';

import React, { useState } from 'react';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { NodePalette } from '@/components/canvas/NodePalette';
import { ExecutionLogsSheet } from '@/components/canvas/ExecutionLogsSheet';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import { saveWorkflowAction } from '@/app/actions/workflow';
import { Button } from '@/components/ui/button';
import { Play, Save, Activity } from 'lucide-react';

interface CanvasWrapperProps {
  workflowId: string;
  initialNodes?: any[];
  initialEdges?: any[];
}

export default function CanvasWrapper({
  workflowId,
  initialNodes = [],
  initialEdges = [],
}: CanvasWrapperProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  // 1. Save Canvas State
  const handleSaveCanvas = async () => {
    setIsSaving(true);
    try {
      await saveWorkflowAction(workflowId, nodes, edges);
    } catch (err) {
      console.error('Failed to save canvas:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Run Workflow Pipeline & Update Live Node States
  const handleRunWorkflow = async () => {
    setIsRunning(true);

    await handleSaveCanvas();

    nodes.forEach((node) => {
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

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Workflow execution failed');
      }

      setActiveRunId(result.runId);

      const outputs: Record<string, string> = result.outputs || {};

      nodes.forEach((node) => {
        if (node.type === 'agent' || node.type === 'output') {
          updateNodeData(node.id, {
            status: 'SUCCESS',
            output: outputs[node.id] || 'Step completed successfully.',
          });
        }
      });
    } catch (err: any) {
      console.error('Workflow Execution Error:', err);

      nodes.forEach((node) => {
        if (node.type === 'agent') {
          updateNodeData(node.id, { status: 'FAILED' });
        }
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="relative flex w-full h-[calc(100vh-4rem)] overflow-hidden bg-slate-950">
      {/* Left Collapsible Node Library Palette */}
      <NodePalette />

      {/* Main Canvas Area */}
      <div className="relative flex-1 h-full">
        {/* Canvas Control Bar */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 backdrop-blur-md shadow-lg">
          <Button
            onClick={handleSaveCanvas}
            disabled={isSaving}
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800 text-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Canvas'}
          </Button>
        </div>

        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {activeRunId && (
            <Button
              onClick={() => setIsLogsOpen(true)}
              size="sm"
              variant="outline"
              className="border-blue-700/50 bg-blue-950/40 text-blue-300 hover:bg-blue-900/50 text-xs flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-blue-400" /> Show Stream
            </Button>
          )}

          <Button
            onClick={handleRunWorkflow}
            disabled={isRunning}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isRunning ? 'Running...' : 'Run Workflow'}
          </Button>
        </div>

        {/* Workflow React Flow Canvas */}
        <WorkflowCanvas initialNodes={initialNodes} initialEdges={initialEdges} />
      </div>

      {/* Execution Logs Drawer */}
      {activeRunId && (
        <ExecutionLogsSheet
          isOpen={isLogsOpen}
          onClose={() => setIsLogsOpen(false)}
          runId={activeRunId}
        />
      )}
    </div>
  );
}
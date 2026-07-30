'use client';

import React, { useState, useRef } from 'react';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { NodePalette } from '@/components/canvas/NodePalette';
import { ExecutionLogsSheet } from '@/components/canvas/ExecutionLogsSheet';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import { saveWorkflowAction } from '@/app/actions/workflow';
import { Button } from '@/components/ui/button';
import { Play, Save, Activity, Download, Upload } from 'lucide-react';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const loadWorkflow = useCanvasStore((s) => s.loadWorkflow);

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

  // 2. Export Canvas DAG as JSON File
  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `workflow-${workflowId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 3. Import JSON Workflow File onto Canvas
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        if (content.nodes && content.edges) {
          loadWorkflow(content.nodes, content.edges);
        }
      } catch (err) {
        console.error('Invalid workflow JSON file:', err);
      }
    };
    reader.readAsText(file);
  };

  // 4. Run Workflow Pipeline
  // 4. Run Workflow Pipeline
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

      // Safely read response text first to handle potential HTML 500 error pages
      const resText = await res.text();
      let result: any = {};
      try {
        result = JSON.parse(resText);
      } catch {
        throw new Error(`Server returned HTML error (${res.status}). Check server logs.`);
      }

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
        {/* Canvas Control Bar (Left Side) */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md shadow-lg">
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

          <Button
            onClick={handleExportJSON}
            size="sm"
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1.5"
            title="Export DAG to JSON"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" /> Export
          </Button>

          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1.5"
            title="Import DAG from JSON"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" /> Import
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            accept=".json"
            className="hidden"
          />
        </div>

        {/* Canvas Action Bar (Right Side) */}
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
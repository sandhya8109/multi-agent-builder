'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { NodePalette } from '@/components/canvas/NodePalette';
import { ExecutionLogsSheet } from '@/components/canvas/ExecutionLogsSheet';
import { NodeSettingsSheet } from '@/components/canvas/NodeSettingsSheet';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import { getLayoutedElements } from '@/lib/utils/layout';
import { Play, Save, LayoutGrid, Terminal, Download, Upload } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react'; 

interface CanvasWrapperProps {
  workflowId: string;
}

export default function CanvasWrapper({ workflowId }: CanvasWrapperProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Zustand Store
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  // Auto Layout
  const handleAutoLayout = () => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  };

  // Save Canvas
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

  // Export JSON
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

  // Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        if (Array.isArray(content.nodes)) setNodes(content.nodes);
        if (Array.isArray(content.edges)) setEdges(content.edges);
      } catch {
        alert('Invalid workflow JSON structure.');
      }
    };
    reader.readAsText(file);
  };

  // Run Workflow Action
  const handleRunWorkflow = async () => {
    setIsRunning(true);
    await handleSaveCanvas();

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
        body: JSON.stringify({ nodes, edges }),
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

      setActiveRunId(result.workflowId);
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
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
        {/* Top Toolbar */}
        <header className="h-14 border-b border-slate-800 bg-slate-950/80 px-4 flex items-center justify-between z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm tracking-wide text-slate-200">
              Canvas Workspace
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto Layout */}
            <Button
              onClick={handleAutoLayout}
              size="sm"
              variant="outline"
              className="border-slate-800 text-slate-300 hover:bg-slate-900 text-xs flex items-center gap-1.5"
              title="Auto-arrange canvas nodes"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-400" /> Auto Layout
            </Button>

            {/* Export JSON */}
            <Button
              onClick={handleExportJSON}
              size="sm"
              variant="outline"
              className="border-slate-800 text-slate-300 hover:bg-slate-900 text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Export
            </Button>

            {/* Import JSON */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
              <div className="border border-slate-800 text-slate-300 hover:bg-slate-900 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-colors">
                <Upload className="w-3.5 h-3.5 text-cyan-400" /> Import
              </div>
            </label>

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

            {/* Run Workflow */}
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

        {/* Main Canvas Area */}
        <div className="flex flex-1 relative overflow-hidden">
          <NodePalette />
          <div className="flex-1 h-full relative">
            <WorkflowCanvas
              workflowId={workflowId}
              onNodeClick={(id) => setSelectedNodeId(id)}
            />
          </div>

          {/* Node Settings Drawer */}
          <NodeSettingsSheet
            nodeId={selectedNodeId}
            onClose={() => setSelectedNodeId(null)}
          />
        </div>

        {/* Execution Logs Drawer */}
        <ExecutionLogsSheet
          isOpen={isLogsOpen}
          onClose={() => setIsLogsOpen(false)}
          runId={activeRunId}
        />
      </div>
    </ReactFlowProvider>
  );
}
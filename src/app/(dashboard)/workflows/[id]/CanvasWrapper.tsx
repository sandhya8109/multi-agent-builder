'use client';

import { useState } from 'react';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { ExecutionLogsSheet } from '@/components/canvas/ExecutionLogsSheet';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import { saveWorkflowAction } from '@/app/actions/workflow';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Terminal } from 'lucide-react';

interface CanvasWrapperProps {
  workflow: {
    id: string;
    name: string;
    nodes: any[];
    edges: any[];
  };
}

export function WorkflowCanvasWrapper({ workflow }: CanvasWrapperProps) {
  const { nodes, edges } = useCanvasStore();
  const [isRunning, setIsRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  const handleSave = async () => {
    await saveWorkflowAction(workflow.id, nodes, edges);
    alert('Workflow saved successfully!');
  };

  const handleExecute = async () => {
    setIsRunning(true);
    try {
      await saveWorkflowAction(workflow.id, nodes, edges);

      const res = await fetch(`/api/workflows/${workflow.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_data: 'Start initial workflow execution.' }),
      });

      const data = await res.json();
      if (res.ok) {
        setActiveRunId(data.runId);
        setIsLogsOpen(true);
      } else {
        alert(`Execution Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        {activeRunId && (
          <Button
            variant="outline"
            onClick={() => setIsLogsOpen(true)}
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          >
            <Terminal className="w-4 h-4 mr-2 text-blue-400" /> Show Stream
          </Button>
        )}
        <Button
          onClick={handleExecute}
          disabled={isRunning}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2 fill-current" />
          )}
          Run Workflow
        </Button>
      </div>

      <WorkflowCanvas
        workflowId={workflow.id}
        initialNodes={workflow.nodes || []}
        initialEdges={workflow.edges || []}
        onSave={handleSave}
      />

      <ExecutionLogsSheet
        runId={activeRunId}
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />
    </div>
  );
}
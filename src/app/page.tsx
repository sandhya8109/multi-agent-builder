'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Workflow {
  id: string;
  name: string;
  nodes?: any[];
  updated_at?: string;
  created_at?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch all workflows from API
  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows || []);
      }
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  // Create new workflow
  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Multi-Agent Workflow' }),
      });
      const data = await res.json();
      if (data.workflow?.id) {
        router.push(`/workflows/${data.workflow.id}`);
      }
    } catch (err) {
      console.error('Failed to create workflow:', err);
    } finally {
      setCreating(false);
    }
  };

  // Delete workflow card
  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation(); // Prevents navigating into the canvas

    if (!confirm(`Are you sure you want to delete "${name || 'this workflow'}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setWorkflows((prev) => prev.filter((w) => w.id !== id));
      } else {
        alert('Failed to delete workflow');
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              AI Agent Workflows
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Build, chain, and monitor multi-agent execution pipelines in real time.
            </p>
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            {creating ? 'Creating...' : 'Create Workflow'}
          </Button>
        </header>

        {/* Workflows List Grid */}
        {loading ? (
          <div className="text-sm text-slate-500 py-12 text-center">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-400 text-sm">No workflows created yet.</p>
            <Button
              onClick={handleCreate}
              variant="outline"
              className="mt-4 border-slate-700 text-slate-300"
            >
              Create your first workflow
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {workflows.map((wf) => {
              const nodeCount = Array.isArray(wf.nodes) ? wf.nodes.length : 0;
              const formattedDate = wf.updated_at
                ? new Date(wf.updated_at).toLocaleDateString()
                : 'Recently';

              return (
                <div
                  key={wf.id}
                  onClick={() => router.push(`/workflows/${wf.id}`)}
                  className="group flex items-center justify-between p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 hover:border-blue-500/40 cursor-pointer transition-all shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                        {wf.name || 'New Multi-Agent Workflow'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Chained AI processing pipeline</p>
                      <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
                        <span>{nodeCount} nodes</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, wf.id, wf.name)}
                    className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Workflow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
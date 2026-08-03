'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Network, Plus, Layers, Bot, ArrowRight, Loader2 } from 'lucide-react';

interface WorkflowItem {
  id: string;
  name?: string;
  created_at?: string;
  nodes?: any[];
}

export default function HomePage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  // Fetch workflows from your existing working API route
  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.workflows || [];
        setWorkflows(list);
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

  const handleCreateWorkflow = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Multi-Agent Workflow',
          nodes: [],
          edges: [],
        }),
      });
      const data = await res.json();
      const newId = data?.id || data?.workflow?.id;

      if (newId) {
        router.push(`/workflows/${newId}`);
      }
    } catch (err) {
      console.error('Failed to create workflow:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5 text-white">
              <Network className="h-6 w-6 text-blue-400" /> Multi-Agent Workflows
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage and monitor all your deployed agent pipelines.
            </p>
          </div>

          <button
            onClick={handleCreateWorkflow}
            disabled={creating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>{creating ? 'Creating...' : 'Create New Workflow'}</span>
          </button>
        </div>

        {/* Loading / Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 gap-2 text-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <span>Loading workflows...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {workflows.map((wf) => {
              const nodesArr = Array.isArray(wf.nodes) ? wf.nodes : [];
              const nodeCount = nodesArr.length;
              const agentCount = nodesArr.filter(
                (n: any) => n.type === 'agent' || n.type === 'agentNode'
              ).length;
              const formattedDate = wf.created_at
                ? new Date(wf.created_at).toLocaleDateString()
                : new Date().toLocaleDateString();

              return (
                <div
                  key={wf.id}
                  className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-5 flex flex-col justify-between space-y-5 hover:border-slate-700 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                        WORKFLOW ID: {wf.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500">{formattedDate}</span>
                    </div>

                    <h2 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                      {wf.name || 'New Multi-Agent Workflow'}
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Layers className="h-4 w-4 text-emerald-400" />
                      <div>
                        <span className="block text-slate-500 text-[10px]">Total Nodes</span>
                        <span className="font-bold text-slate-200">{nodeCount} Nodes</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Bot className="h-4 w-4 text-blue-400" />
                      <div>
                        <span className="block text-slate-500 text-[10px]">Agents</span>
                        <span className="font-bold text-slate-200">{agentCount} Agents</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/workflows/${wf.id}`}
                    className="flex items-center justify-between w-full text-xs font-semibold text-slate-300 hover:text-white pt-2 border-t border-slate-800/60 transition-colors"
                  >
                    <span>Open Canvas</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform text-slate-400 group-hover:text-white" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
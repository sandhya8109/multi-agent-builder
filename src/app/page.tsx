import { createClient } from '@/lib/supabase/server';
import { createWorkflowAction } from '@/app/actions/workflow';
import Link from 'next/link';
import { Plus, Workflow, Bot } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch existing workflows from Supabase
  const { data: workflows } = await supabase
    .from('workflows')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Agent Workflows</h1>
            <p className="text-slate-400 text-sm mt-1">
              Build, chain, and monitor multi-agent execution pipelines in real time.
            </p>
          </div>

          <form action={createWorkflowAction}>
            <button
              type="submit"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Workflow
            </button>
          </form>
        </div>

        {/* Workflows Grid / Empty State */}
        {workflows && workflows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((wf) => (
              <Link
                key={wf.id}
                href={`/workflows/${wf.id}`}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-center gap-2 text-blue-400 font-semibold mb-2">
                    <Bot className="w-5 h-5" />
                    <h3>{wf.name}</h3>
                  </div>
                  <p className="text-slate-400 text-xs line-clamp-2">
                    {wf.description || 'No description provided.'}
                  </p>
                </div>
                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>{(wf.nodes || []).length} nodes</span>
                  <span>{new Date(wf.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 bg-slate-900/40">
            <Workflow className="w-12 h-12 text-slate-600" />
            <div>
              <h3 className="font-semibold text-slate-200">No workflows created yet</h3>
              <p className="text-slate-400 text-xs mt-1">
                Click the button below to generate your first agent pipeline.
              </p>
            </div>
            <form action={createWorkflowAction}>
              <button
                type="submit"
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium px-4 py-2 rounded-lg transition-colors text-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create First Workflow
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
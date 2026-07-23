import { createClient } from '@/lib/supabase/server';
import { createWorkflowAction } from '@/app/actions/workflow';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Workflow, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: workflows } = await supabase
    .from('workflows')
    .select('*')
    .order('updated_at', { ascending: false });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Agent Workflows</h1>
            <p className="text-slate-400 text-sm mt-1">
              Build, chain, and monitor multi-agent execution pipelines in real time.
            </p>
          </div>
          <form action={createWorkflowAction}>
            <Button className="bg-blue-600 hover:bg-blue-500 gap-2">
              <Plus className="w-4 h-4" /> Create Workflow
            </Button>
          </form>
        </div>

        {/* Workflows List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows && workflows.length > 0 ? (
            workflows.map((wf) => (
              <Card
                key={wf.id}
                className="bg-slate-900 border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Workflow className="w-5 h-5 text-blue-400" />
                    <CardTitle className="text-slate-100 text-base">{wf.name}</CardTitle>
                  </div>
                  <CardDescription className="text-slate-400 text-xs line-clamp-2">
                    {wf.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>
                <div className="p-6 pt-0">
                  <Link href={`/workflows/${wf.id}`}>
                    <Button variant="secondary" className="w-full text-xs gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200">
                      Open Canvas <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-800 rounded-xl">
              <Workflow className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-slate-300 font-medium text-sm">No workflows created yet</h3>
              <p className="text-slate-500 text-xs mt-1 mb-4">
                Click the button below to generate your first agent pipeline.
              </p>
              <form action={createWorkflowAction}>
                <Button variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
                  <Plus className="w-4 h-4 mr-2" /> Create First Workflow
                </Button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
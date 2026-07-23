import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runWorkflowDAG } from '@/lib/ai/dag-runner';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const workflowId = params.id;
    const { input_data } = await request.json().catch(() => ({ input_data: '' }));

    // Fetch workflow graph definition
    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Create execution run record
    const { data: run, error: runError } = await supabase
      .from('workflow_runs')
      .insert({
        workflow_id: workflowId,
        status: 'RUNNING',
        input_data: { initialInput: input_data },
      })
      .select()
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: 'Failed to create run log' }, { status: 500 });
    }

    // Execute DAG in background
    runWorkflowDAG(
      workflowId,
      run.id,
      workflow.nodes,
      workflow.edges,
      input_data
    );

    return NextResponse.json({ runId: run.id, status: 'RUNNING' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
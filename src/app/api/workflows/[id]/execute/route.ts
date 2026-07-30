import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runWorkflowDAG } from '@/lib/ai/dag-runner';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const body = await req.json().catch(() => ({}));
    const inputData = body.input_data || 'Start initial workflow execution.';

    const supabase = await createClient();

    // Fetch active session user if available
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Fetch the workflow definition
    const { data: workflow, error: wfError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (wfError || !workflow) {
      return NextResponse.json(
        { error: `Workflow not found: ${wfError?.message || 'Invalid ID'}` },
        { status: 404 }
      );
    }

    // Determine user ID (prefer logged-in user, fallback to workflow creator)
    const runUserId = user?.id || workflow.user_id || null;

    // 2. Prepare payload and insert execution record
    const insertPayload: Record<string, any> = {
      workflow_id: workflowId,
      status: 'RUNNING',
    };

    if (runUserId) {
      insertPayload.user_id = runUserId;
    }

    const { data: run, error: runError } = await supabase
      .from('workflow_runs')
      .insert(insertPayload)
      .select()
      .single();

    if (runError) {
      console.error('❌ Failed to insert into workflow_runs:', runError);
      return NextResponse.json(
        { error: `Failed to create run log: ${runError.message}` },
        { status: 500 }
      );
    }

    // 3. Execute the DAG / Agent pipeline
    try {
      const dagResult = await runWorkflowDAG(
        workflowId,
        run.id,
        workflow.nodes || [],
        workflow.edges || [],
        inputData
      );

      return NextResponse.json({
        success: true,
        runId: run.id,
        outputs: dagResult.outputs,
      });
    } catch (execErr: any) {
      console.error('❌ DAG Execution Error:', execErr);
      await supabase
        .from('workflow_runs')
        .update({ status: 'FAILED' })
        .eq('id', run.id);

      return NextResponse.json(
        { error: execErr.message || 'Agent execution failed' },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('❌ Execute Route Exception:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
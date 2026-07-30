import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runWorkflowDAG } from '@/lib/ai/dag-runner';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch workflow data from database
    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found in database.' },
        { status: 404 }
      );
    }

    // Safely parse nodes & edges
    let nodes = workflow.nodes || [];
    let edges = workflow.edges || [];

    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes); } catch {}
    }
    if (typeof edges === 'string') {
      try { edges = JSON.parse(edges); } catch {}
    }

    if (!Array.isArray(nodes)) nodes = [];
    if (!Array.isArray(edges)) edges = [];

    if (nodes.length === 0) {
      return NextResponse.json({
        success: true,
        runId: `run_${Date.now()}`,
        outputs: {},
        metrics: {},
        message: 'No nodes present on canvas to execute.',
      });
    }

    // Execute workflow DAG
    const { outputs, metricsMap } = await runWorkflowDAG(nodes, edges);

    return NextResponse.json({
      success: true,
      runId: `run_${Date.now()}`,
      outputs,
      metrics: metricsMap,
    });
  } catch (err: any) {
    console.error('Workflow execution error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Workflow execution failed.' },
      { status: 500 }
    );
  }
}
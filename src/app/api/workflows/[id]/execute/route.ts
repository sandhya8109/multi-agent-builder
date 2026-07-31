import { NextResponse } from 'next/server';
import { runWorkflowDAG } from '@/lib/ai/dag-runner';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const workflowId = resolvedParams.id;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body passed
    }

    let nodes = body.nodes;
    let edges = body.edges;

    // Fallback: If nodes or edges were not provided in the request body, load them from Supabase
    if (!nodes || !edges) {
      try {
        const supabase = await createClient();
        const { data: workflow } = await supabase
          .from('workflows')
          .select('nodes, edges')
          .eq('id', workflowId)
          .single();

        if (workflow) {
          nodes = nodes || workflow.nodes;
          edges = edges || workflow.edges;
        }
      } catch (dbErr) {
        console.warn('Could not fetch workflow from database fallback:', dbErr);
      }
    }

    // Default to empty arrays if still missing
    nodes = Array.isArray(nodes) ? nodes : [];
    edges = Array.isArray(edges) ? edges : [];

    if (nodes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Canvas is empty. Add nodes to execute the workflow.' },
        { status: 400 }
      );
    }

    // Run execution pipeline
    const result = await runWorkflowDAG(nodes, edges);

    return NextResponse.json({
      success: true,
      workflowId,
      nodes: result.nodes,
      outputs: result.outputs,
    });
  } catch (error: any) {
    console.error('Workflow execution error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Execution failed.' },
      { status: 500 }
    );
  }
}
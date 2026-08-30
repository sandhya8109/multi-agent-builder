import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { executeWorkflowDAG } from '@/lib/ai/dag-runner';
import { isInputNode } from '@/lib/ai/node-types';
import { isPlaceholderOrEmpty } from '@/lib/utils/input-validation';
import type { WorkflowNode, WorkflowEdge } from '@/lib/types/workflow';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const nodes: WorkflowNode[] = body.nodes || [];
    const edges: WorkflowEdge[] = body.edges || [];
    // The client generates a runId so the Execution Logs panel can start
    // subscribing before this request finishes; fall back to generating
    // one here so the route still works if called without it.
    const runId: string = body.runId || crypto.randomUUID();

    let hasInputError = false;

    // 1. Inspect Input Nodes for unedited placeholder/example text
    for (const node of nodes) {
      if (isInputNode(node.type)) {
        const textVal = node.data?.value || '';

        if (isPlaceholderOrEmpty(textVal)) {
          hasInputError = true;
          node.data = {
            ...node.data,
            status: 'ERROR',
            errorMessage:
              '⚠️ Action required: replace placeholder text with real input data before running.',
            output: '',
          };
        } else {
          node.data = { ...node.data, status: 'SUCCESS', errorMessage: null, output: textVal };
        }
      }
    }

    // 2. Halt immediately if any input still contains placeholder/empty text
    if (hasInputError) {
      for (const node of nodes) {
        if (!isInputNode(node.type)) {
          node.data = { ...node.data, status: 'IDLE', output: 'Awaiting valid input data...' };
        }
      }

      if (id) {
        await supabase.from('workflows').update({ nodes, edges }).eq('id', id);
      }

      return NextResponse.json({
        success: false,
        message: 'Workflow paused: please provide valid input data.',
        nodes,
        runId,
      });
    }

    // 3. Execute the DAG — one shared executor for every node type
    // (agent, input, api, rag, output), logging each node's result to
    // Supabase as it completes so the Execution Logs panel can stream it
    // in via realtime.
    const { nodes: executedNodes, logs } = await executeWorkflowDAG(nodes, edges, {
      onNodeLog: async (log) => {
        const { error } = await supabase.from('run_logs').insert({
          run_id: runId,
          workflow_id: id,
          node_id: log.nodeId,
          node_label: log.nodeLabel,
          status: log.status,
          log_data: {
            input_context: log.inputContext,
            output: log.output,
            error: log.error ?? null,
          },
        });

        if (error) {
          // Do not fail the run over a logging problem, but do not hide it
          // either — most likely cause is the run_logs table/migration
          // hasn't been applied yet (see supabase/migrations).
          console.error('[execute] Failed to write run_logs row:', error.message);
        }
      },
    });

    if (id) {
      await supabase.from('workflows').update({ nodes: executedNodes, edges }).eq('id', id);
    }

    return NextResponse.json({ success: true, nodes: executedNodes, runId, logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

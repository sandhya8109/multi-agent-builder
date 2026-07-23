import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@/lib/supabase/server';
import { CustomNode } from '@/lib/hooks/useCanvasStore';
import { Edge } from '@xyflow/react';

// Topological Sort for Directed Acyclic Graph (DAG)
function getExecutionOrder(nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  nodes.forEach((node) => {
    inDegree[node.id] = 0;
    adjList[node.id] = [];
  });

  edges.forEach((edge) => {
    if (adjList[edge.source]) {
      adjList[edge.source].push(edge.target);
    }
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
  });

  const queue: string[] = Object.keys(inDegree).filter((id) => inDegree[id] === 0);
  const sortedIds: string[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    sortedIds.push(curr);

    (adjList[curr] || []).forEach((neighbor) => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    });
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return sortedIds.map((id) => nodeMap.get(id)!).filter(Boolean);
}

export async function runWorkflowDAG(
  workflowId: string,
  runId: string,
  nodes: CustomNode[],
  edges: Edge[],
  initialInput: string = ''
) {
  const supabase = await createClient();
  const sortedNodes = getExecutionOrder(nodes, edges);
  const nodeOutputs: Record<string, string> = {};

  try {
    for (const node of sortedNodes) {
      // Find all incoming edge sources for context
      const incomingEdges = edges.filter((e) => e.target === node.id);
      const parentContexts = incomingEdges
        .map((e) => `[Output from ${e.source}]:\n${nodeOutputs[e.source] || ''}`)
        .join('\n\n');

      // Log: Node Starting
      await supabase.from('run_logs').insert({
        run_id: runId,
        node_id: node.id,
        node_label: node.data.label || 'Agent',
        status: 'RUNNING',
        log_data: { input_context: parentContexts },
      });

      let outputText = '';

      if (node.type === 'input') {
        outputText = initialInput;
      } else if (node.type === 'agent') {
        const systemPrompt = node.data.systemPrompt || 'You are a helpful AI agent.';
        const userPrompt = `Context from previous steps:\n${parentContexts || 'No prior context.'}\n\nTask Instructions:\n${node.data.role || 'Process the input.'}`;

        const response = await generateText({
          model: openai(node.data.model || 'gpt-4o'),
          system: systemPrompt,
          prompt: userPrompt,
          temperature: node.data.temperature ?? 0.7,
        });

        outputText = response.text;
      } else {
        // Output / Pass-through node
        outputText = parentContexts;
      }

      nodeOutputs[node.id] = outputText;

      // Log: Node Success
      await supabase.from('run_logs').insert({
        run_id: runId,
        node_id: node.id,
        node_label: node.data.label || 'Agent',
        status: 'SUCCESS',
        log_data: { output: outputText },
      });
    }

    // Mark Workflow Run Complete
    await supabase
      .from('workflow_runs')
      .update({
        status: 'COMPLETED',
        output_data: nodeOutputs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return { success: true, outputs: nodeOutputs };
  } catch (err: any) {
    // Mark Workflow Run Failed
    await supabase
      .from('workflow_runs')
      .update({
        status: 'FAILED',
        output_data: { error: err.message },
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    throw err;
  }
}
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function saveWorkflowAction(workflowId: string, nodes: any[], edges: any[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('workflows')
    .update({
      nodes,
      edges,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workflowId);

  if (error) {
    throw new Error(`Failed to save workflow: ${error.message}`);
  }

  revalidatePath(`/workflows/${workflowId}`);
  return { success: true };
}

export async function createWorkflowAction() {
  const supabase = await createClient();

  // Starter nodes pre-populated on creation
  const initialNodes = [
    {
      id: 'node_input',
      type: 'input',
      position: { x: 250, y: 80 },
      data: { label: 'User Input', status: 'IDLE' },
    },
    {
      id: 'node_agent_1',
      type: 'agent',
      position: { x: 250, y: 220 },
      data: {
        label: 'Summary Agent',
        role: 'Summarizer',
        systemPrompt: 'Summarize the input text into 3 bullet points.',
        model: 'gpt-4o',
        status: 'IDLE',
      },
    },
  ];

  const initialEdges = [
    { id: 'edge_1', source: 'node_input', target: 'node_agent_1', animated: true },
  ];

  const { data, error } = await supabase
    .from('workflows')
    .insert({
      name: 'New Multi-Agent Workflow',
      description: 'Chained AI processing pipeline',
      nodes: initialNodes,
      edges: initialEdges,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create workflow: ${error?.message}`);
  }

  redirect(`/workflows/${data.id}`);
}
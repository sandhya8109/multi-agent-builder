'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function createWorkflowAction() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialNodes = [
    {
      id: 'node_input',
      type: 'input',
      position: { x: 250, y: 80 },
      data: { label: 'User Input', value: '', status: 'IDLE' },
    },
    {
      id: 'node_agent_1',
      type: 'agent',
      position: { x: 250, y: 220 },
      data: {
        label: 'Summary Agent',
        role: 'Summarizer',
        systemPrompt: 'Summarize the input text into 3 concise bullet points.',
        model: 'llama-3.3-70b-versatile',
        status: 'IDLE',
      },
    },
  ];

  const initialEdges = [
    { id: 'edge_1', source: 'node_input', target: 'node_agent_1', animated: true },
  ];
 
  const insertPayload: Record<string, any> = {
    name: 'New Multi-Agent Workflow',
    description: 'Chained AI processing pipeline',
    nodes: initialNodes,
    edges: initialEdges,
  };

  if (user?.id) {
    insertPayload.user_id = user.id;
  }

  const { data, error } = await supabase
    .from('workflows')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('❌ Supabase Insert Error:', error);
    throw new Error(`Database Insert Failed: ${error.message}`);
  }

  redirect(`/workflows/${data.id}`);
}

export async function getWorkflowAction(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function saveWorkflowAction(id: string, nodes: any[], edges: any[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('workflows')
    .update({
      nodes,
      edges,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('❌ Supabase Save Error:', error.message);
    throw new Error(`Failed to save workflow: ${error.message}`);
  }

  revalidatePath(`/workflows/${id}`);
  return { success: true };
}
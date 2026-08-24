import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET all workflows
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase GET Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('API GET Exception:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// POST create workflow
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { name, title, nodes = [], edges = [] } = body;
    const workflowName = name || title || 'New Multi-Agent Workflow';

    const { data, error } = await supabase
      .from('workflows')
      .insert([
        {
          name: workflowName,
          nodes,
          edges,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase POST Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API POST Exception:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// DELETE workflow by ID
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
    }

    const { error } = await supabase.from('workflows').delete().eq('id', id);

    if (error) {
      console.error('Supabase DELETE Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API DELETE Exception:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
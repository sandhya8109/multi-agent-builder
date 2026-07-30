import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Load workflow nodes and edges from Supabase
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found in database' },
        { status: 404 }
      );
    }

    return NextResponse.json({ workflow });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Save canvas nodes and edges to Supabase
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { nodes, edges } = body;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('workflows')
      .update({
        nodes,
        edges,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workflow: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
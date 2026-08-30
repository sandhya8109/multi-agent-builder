import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false });

    if (user) {
      query = query.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json({ success: false, workflows: [] }, { status: 200 });
    }

    return NextResponse.json({ success: true, workflows: data || [] });
  } catch (err: any) {
    console.error('Failed to fetch workflows:', err);
    return NextResponse.json({ success: false, workflows: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json();
    const { name, nodes = [], edges = [] } = body;

    const insertPayload: Record<string, any> = {
      name: name || 'New Multi-Agent Workflow',
      nodes,
      edges,
    };

    if (user?.id) {
      insertPayload.user_id = user.id;
    }

    const { data, error } = await supabase
      .from('workflows')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error('Error inserting workflow into Supabase:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to insert workflow' },
        { status: 400 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Failed to process POST /api/workflows:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing workflow ID' }, { status: 400 });
    }

    const { error } = await supabase.from('workflows').delete().eq('id', id);

    if (error) {
      console.error('Error deleting workflow:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete workflow:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
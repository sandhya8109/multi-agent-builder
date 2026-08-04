import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Load ALL workflows for the dashboard list
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workflows: workflows || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create a new workflow card
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = body.name || 'New Multi-Agent Workflow';
    const supabase = await createClient();

    // Optional: Get authenticated user if using Supabase Auth
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('workflows')
      .insert([
        {
          name,
          nodes: [],
          edges: [],
          ...(user ? { user_id: user.id } : {}), // Binds to user if auth is active
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workflow: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
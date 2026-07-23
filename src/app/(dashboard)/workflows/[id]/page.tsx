import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import CanvasWrapper from './CanvasWrapper';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: workflow, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !workflow) {
    notFound();
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950">
      <CanvasWrapper workflow={workflow} />
    </div>
  );
}
import CanvasWrapper from './CanvasWrapper';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkflowCanvasPage({ params }: PageProps) {
  const { id } = await params;

  return <CanvasWrapper workflowId={id} />;
}
import CanvasWrapper from './CanvasWrapper';

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  return <CanvasWrapper workflowId={resolvedParams.id} />;
}
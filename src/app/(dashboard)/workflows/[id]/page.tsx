import { getWorkflowAction } from '@/app/actions/workflow';
import CanvasWrapper from './CanvasWrapper';

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workflow = await getWorkflowAction(id);

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950">
      <CanvasWrapper
        workflowId={id}
        initialNodes={workflow?.nodes || []}
        initialEdges={workflow?.edges || []}
      />
    </div>
  );
}
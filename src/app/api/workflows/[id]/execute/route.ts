import { NextResponse } from 'next/server';
import { runWorkflowDAG } from '@/lib/ai/dag-runner';
import { createClient, hasSupabaseConfig } from '@/lib/supabase/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const workflowId = resolvedParams.id;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body passed
    }

    let nodes = Array.isArray(body.nodes) ? body.nodes : [];
    let edges = Array.isArray(body.edges) ? body.edges : [];

    if ((!nodes.length && !edges.length) || (!nodes.length && edges.length > 0) || (nodes.length > 0 && !edges.length)) {
      if (hasSupabaseConfig()) {
        try {
          const supabase = await createClient();
          const { data: workflow } = await supabase
            .from('workflows')
            .select('nodes, edges')
            .eq('id', workflowId)
            .single();

          if (workflow) {
            nodes = Array.isArray(workflow.nodes) ? workflow.nodes : nodes;
            edges = Array.isArray(workflow.edges) ? workflow.edges : edges;
          }
        } catch (dbErr) {
          console.warn('Could not fetch workflow from database fallback:', dbErr);
        }
      }
    }

    nodes = Array.isArray(nodes) ? nodes : [];
    edges = Array.isArray(edges) ? edges : [];

    if (nodes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Canvas is empty. Add nodes to execute the workflow.' },
        { status: 400 }
      );
    }

    const processedNodes = nodes.map((node: any) => {
      if (node.type === 'agentNode' || node.type === 'agent') {
        const incomingEdges = edges.filter((e: any) => e.target === node.id);
        const connectedNodes = incomingEdges.map((e: any) =>
          nodes.find((n: any) => n.id === e.source)
        );

        let jobDescriptionText = '';
        let resumeText = '';
        const extraInputs: string[] = [];

        connectedNodes.forEach((connNode: any) => {
          if (!connNode) return;
          const content = connNode.data?.value || connNode.data?.text || '';
          const title = (connNode.data?.roleName || connNode.data?.title || '').toLowerCase();

          if (title.includes('job') || title.includes('jd') || content.toLowerCase().includes('job description')) {
            jobDescriptionText += content + '\n\n';
          } else if (title.includes('resume') || title.includes('cv') || content.toLowerCase().includes('experience')) {
            resumeText += content + '\n\n';
          } else {
            extraInputs.push(content);
          }
        });

        if (!jobDescriptionText && connectedNodes[0]) {
          jobDescriptionText = connectedNodes[0].data?.value || connectedNodes[0].data?.text || '';
        }
        if (!resumeText && connectedNodes[1]) {
          resumeText = connectedNodes[1].data?.value || connectedNodes[1].data?.text || '';
        }

        let instructions = node.data?.instructions || node.data?.systemPrompt || '';

        instructions = instructions
          .replace('{{JOB_DESCRIPTION}}', jobDescriptionText.trim() || '[No Job Description Provided]')
          .replace('{{RESUME_TEXT}}', resumeText.trim() || '[No Resume Provided]')
          .replace('{{SENIORITY_LEVEL}}', node.data?.seniority || 'Not Specified (Infer from JD)')
          .replace('{{INDUSTRY}}', node.data?.industry || 'Not Specified (Infer from JD)');

        return {
          ...node,
          data: {
            ...node.data,
            instructions,
            userPrompt:
              extraInputs.length > 0
                ? extraInputs.join('\n\n')
                : 'Evaluate the provided Job Description and Resume according to your system instructions.',
          },
        };
      }
      return node;
    });

    const result = await runWorkflowDAG(processedNodes, edges);

    if (hasSupabaseConfig()) {
      try {
        const supabase = await createClient();
        await supabase.from('workflow_runs').insert({
          workflow_id: workflowId,
          status: 'COMPLETED',
          input_data: {
            nodes: processedNodes.map((n: any) => ({
              id: n.id,
              type: n.type,
              title: n.data?.label || n.data?.title,
            })),
            edgesCount: edges.length,
          },
        });
      } catch (logErr) {
        console.error('Failed to persist execution log:', logErr);
      }
    }

    return NextResponse.json({
      success: true,
      workflowId,
      nodes: result.nodes,
      outputs: result.outputs,
    });
  } catch (error: any) {
    console.error('Workflow execution failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Workflow execution failed',
      },
      { status: 400 }
    );
  }
}

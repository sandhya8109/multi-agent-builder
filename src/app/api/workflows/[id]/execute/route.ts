import { NextResponse } from 'next/server';
import { runWorkflowDAG } from '@/lib/ai/dag-runner';
import { createClient } from '@/lib/supabase/server';

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

    let nodes = body.nodes;
    let edges = body.edges;

    // Fallback to Supabase if nodes or edges are not in request body
    if (!nodes || !edges) {
      try {
        const supabase = await createClient();
        const { data: workflow } = await supabase
          .from('workflows')
          .select('nodes, edges')
          .eq('id', workflowId)
          .single();

        if (workflow) {
          nodes = nodes || workflow.nodes;
          edges = edges || workflow.edges;
        }
      } catch (dbErr) {
        console.warn('Could not fetch workflow from database fallback:', dbErr);
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

    // Pre-process Agent system prompts to interpolate {{JOB_DESCRIPTION}} and {{RESUME_TEXT}}
    const processedNodes = nodes.map((node: any) => {
      if (node.type === 'agentNode' || node.type === 'agent') {
        const incomingEdges = edges.filter((e: any) => e.target === node.id);
        const connectedNodes = incomingEdges.map((e: any) =>
          nodes.find((n: any) => n.id === e.source)
        );

        let jobDescriptionText = '';
        let resumeText = '';
        let extraInputs: string[] = [];

        connectedNodes.forEach((connNode: any) => {
          if (!connNode) return;
          const content = connNode.data?.value || connNode.data?.text || '';
          const title = (connNode.data?.roleName || connNode.data?.title || '').toLowerCase();

          // Match node content or title to classify Job Description vs Resume
          if (title.includes('job') || title.includes('jd') || content.toLowerCase().includes('job description')) {
            jobDescriptionText += content + '\n\n';
          } else if (title.includes('resume') || title.includes('cv') || content.toLowerCase().includes('experience')) {
            resumeText += content + '\n\n';
          } else {
            extraInputs.push(content);
          }
        });

        // Fallback: If no clear title matching, assign connected inputs by position
        if (!jobDescriptionText && connectedNodes[0]) {
          jobDescriptionText = connectedNodes[0].data?.value || connectedNodes[0].data?.text || '';
        }
        if (!resumeText && connectedNodes[1]) {
          resumeText = connectedNodes[1].data?.value || connectedNodes[1].data?.text || '';
        }

        let instructions = node.data?.instructions || node.data?.systemPrompt || '';

        // Hydrate variables in system instructions
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
            // Pass full hydrated prompt to execution engine
            userPrompt: extraInputs.length > 0 ? extraInputs.join('\n\n') : 'Evaluate the provided Job Description and Resume according to your system instructions.',
          },
        };
      }
      return node;
    });

    // Run execution pipeline with hydrated nodes
    // Run execution pipeline with hydrated nodes
    const result = await runWorkflowDAG(processedNodes, edges);

    // PERSIST EXECUTION RUN TO SUPABASE
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

    return NextResponse.json({
      success: true,
      workflowId,
      nodes: result.nodes,
      outputs: result.outputs,
    });
  } catch (err: any) {
    console.error('Workflow execution error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Workflow execution failed' },
      { status: 500 }
    );
  }
}
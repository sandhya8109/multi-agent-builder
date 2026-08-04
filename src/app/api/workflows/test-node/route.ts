import { NextResponse } from 'next/server';
import { executeWorkflowDAG } from '@/lib/ai/dag-runner';

// Collect all ancestor node IDs recursively
function getAncestorNodeIds(targetId: string, edges: any[]): Set<string> {
  const ancestors = new Set<string>();
  const queue = [targetId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const incomingEdges = edges.filter((e: any) => e.target === currentId);
    for (const edge of incomingEdges) {
      if (!ancestors.has(edge.source)) {
        ancestors.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return ancestors;
}

export async function POST(req: Request) {
  try {
    const { nodeId, nodes = [], edges = [] } = await req.json();

    if (!nodeId || !nodes.length) {
      return NextResponse.json({ error: 'Node ID and canvas nodes required' }, { status: 400 });
    }

    // 1. Trace ancestor graph for nodeId
    const ancestorIds = getAncestorNodeIds(nodeId, edges);

    // 2. Build targeted subgraph
    const subgraphNodeIds = new Set([...ancestorIds, nodeId]);
    const subgraphNodes = nodes.filter((n: any) => subgraphNodeIds.has(n.id));
    const subgraphEdges = edges.filter(
      (e: any) => subgraphNodeIds.has(e.source) && subgraphNodeIds.has(e.target)
    );

    // 3. Execute subgraph and return output for target node
    const { outputs } = await executeWorkflowDAG(subgraphNodes, subgraphEdges);
    const targetOutput = outputs[nodeId] || 'No output generated.';

    return NextResponse.json({ output: targetOutput });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
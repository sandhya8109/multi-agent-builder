import { createClient } from '@/lib/supabase/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface DAGNode {
  id: string;
  type?: string;
  data: Record<string, any>;
}

interface DAGEdge {
  id: string;
  source: string;
  target: string;
}

export async function runWorkflowDAG(
  workflowId: string,
  runId: string,
  nodes: DAGNode[],
  edges: DAGEdge[],
  initialInput: string = ''
) {
  const supabase = await createClient();

  // 1. Build In-Degree and Adjacency List for Topological Sorting
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};
  const parentMap: Record<string, string[]> = {};

  nodes.forEach((node) => {
    inDegree[node.id] = 0;
    adjList[node.id] = [];
    parentMap[node.id] = [];
  });

  edges.forEach((edge) => {
    if (adjList[edge.source]) {
      adjList[edge.source].push(edge.target);
    }
    if (inDegree[edge.target] !== undefined) {
      inDegree[edge.target] += 1;
    }
    if (parentMap[edge.target]) {
      parentMap[edge.target].push(edge.source);
    }
  });

  // 2. Queue for start nodes (In-degree = 0)
  const queue: string[] = Object.keys(inDegree).filter(
    (id) => inDegree[id] === 0
  );

  const outputs: Record<string, string> = {};

  // 3. Process nodes in topological order
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) continue;

    // Log step start in Supabase
    await supabase.from('run_logs').insert({
      run_id: runId,
      node_id: node.id,
      node_label: node.data.label || node.type || 'Node',
      status: 'RUNNING',
      log_data: { parent_sources: parentMap[node.id] },
    });

    // Gather context from upstream parent nodes
    const parents = parentMap[node.id] || [];
    const parentContexts = parents
      .map((pId) => outputs[pId])
      .filter(Boolean)
      .join('\n\n---\n\n');

    let outputText = '';

    try {
      if (node.type === 'input') {
        outputText = node.data.value || node.data.input || initialInput;
      } else if (node.type === 'api') {
        // Clean & Sanitize URL
        let rawUrl = (node.data.url || '').trim();
        if (!rawUrl || rawUrl === 'https://jsonplaceholder.typicode.com/') {
          rawUrl = 'https://jsonplaceholder.typicode.com/todos/1';
        }

        rawUrl = rawUrl.replace(/^["'\[<]+|["'\]>]+$/g, '').trim();

        if (!/^https?:\/\//i.test(rawUrl)) {
          rawUrl = `https://${rawUrl}`;
        }

        const method = (node.data.method || 'GET').toUpperCase();

        const apiRes = await fetch(rawUrl, {
          method,
          headers: { 'Content-Type': 'application/json' },
        });

        if (!apiRes.ok) {
          throw new Error(`HTTP ${apiRes.status}: ${apiRes.statusText}`);
        }

        const rawData = await apiRes.json().catch(() => apiRes.text());
        outputText = typeof rawData === 'string' ? rawData : JSON.stringify(rawData, null, 2);
      } else if (node.type === 'output') {
        outputText = parentContexts || 'No upstream output received.';
      } else if (node.type === 'agent') {
        const systemPrompt =
          node.data.systemPrompt || 'You are a helpful AI assistant.';
        const userPrompt = parentContexts
          ? `Context from previous steps:\n${parentContexts}`
          : initialInput;
        const requestedModel = node.data.model || 'llama-3.3-70b-versatile';
        const temp = node.data.temperature ?? 0.7;

        let response;
        try {
          if (requestedModel.startsWith('gpt-') && process.env.OPENAI_API_KEY) {
            response = await generateText({
              model: openai(requestedModel),
              system: systemPrompt,
              prompt: userPrompt,
              temperature: temp,
            });
          } else {
            response = await generateText({
              model: groq('llama-3.3-70b-versatile'),
              system: systemPrompt,
              prompt: userPrompt,
              temperature: temp,
            });
          }
        } catch (modelErr) {
          console.warn(`⚠️ Model "${requestedModel}" failed, falling back to Groq Llama 3.3...`);
          response = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            system: systemPrompt,
            prompt: userPrompt,
            temperature: temp,
          });
        }

        outputText = response.text;
      }

      outputs[node.id] = outputText;

      // Update log as SUCCESS
      await supabase.from('run_logs').insert({
        run_id: runId,
        node_id: node.id,
        node_label: node.data.label || node.type || 'Node',
        status: 'SUCCESS',
        log_data: { output: outputText },
      });
    } catch (err: any) {
      console.error(`❌ Node ${node.id} execution failed:`, err);
      await supabase.from('run_logs').insert({
        run_id: runId,
        node_id: node.id,
        node_label: node.data.label || node.type || 'Node',
        status: 'FAILED',
        log_data: { error: err.message },
      });
      throw err;
    }

    // Decrement in-degree for downstream neighbors
    const neighbors = adjList[node.id] || [];
    for (const neighborId of neighbors) {
      inDegree[neighborId] -= 1;
      if (inDegree[neighborId] === 0) {
        queue.push(neighborId);
      }
    }
  }

  return { outputs };
}
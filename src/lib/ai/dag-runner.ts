import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { retrieveRelevantPassages } from './rag';
import { safeFetch } from '@/lib/net/safe-fetch';

// Initialize Provider Instances
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Current Groq-hosted default (the older llama-3.x models were retired).
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const LARGE_GROQ_MODEL = 'openai/gpt-oss-120b';

// Helper to select the correct AI model instance.
//
// Provider routing note: several Groq-hosted models are namespaced with a
// vendor prefix that contains a slash (e.g. "openai/gpt-oss-20b",
// "qwen/qwen3.6-27b", "groq/compound"). Those must still go through the Groq
// provider, NOT the OpenAI provider — so we route by slash / known patterns,
// and only treat un-prefixed "gpt-*" / "o*" names as real OpenAI API models.
function getModelInstance(modelName: string) {
  const model = modelName ? modelName.trim() : '';

  if (!model) return groq(DEFAULT_GROQ_MODEL);

  // Auto-migrate retired Groq model ids (present in older saved workflows).
  if (/llama-?3\.1-8b|llama3-8b|8b-instant/i.test(model)) return groq(DEFAULT_GROQ_MODEL);
  if (/llama-?3\.3|llama3-70b|70b-versatile|(^|[^0-9])70b/i.test(model)) return groq(LARGE_GROQ_MODEL);

  // Groq-hosted models: vendor-prefixed (has a slash) or known families.
  if (model.includes('/') || /groq|qwen|allam|gpt-oss|compound|mixtral|llama/i.test(model)) {
    return groq(model);
  }

  // Otherwise a real OpenAI API model (e.g. gpt-4o-mini, o4-mini).
  return openai(model);
}

// Helper: Topologically sort nodes so parents run before children
function getTopologicallySortedNodes(nodes: any[], edges: any[]): any[] {
  const nodeMap = new Map<string, any>(nodes.map((n) => [n.id, n]));
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  nodes.forEach((n) => {
    inDegree[n.id] = 0;
    adjList[n.id] = [];
  });

  edges.forEach((e) => {
    if (adjList[e.source] && inDegree[e.target] !== undefined) {
      adjList[e.source].push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    }
  });

  const queue: string[] = [];
  Object.keys(inDegree).forEach((id) => {
    if (inDegree[id] === 0) queue.push(id);
  });

  const sorted: any[] = [];
  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currNode = nodeMap.get(currId);
    if (currNode) sorted.push(currNode);

    (adjList[currId] || []).forEach((neighborId) => {
      inDegree[neighborId] -= 1;
      if (inDegree[neighborId] === 0) {
        queue.push(neighborId);
      }
    });
  }

  // Fallback for any unvisited nodes (e.g. cycles)
  nodes.forEach((n) => {
    if (!sorted.find((s) => s.id === n.id)) {
      sorted.push(n);
    }
  });

  return sorted;
}

// Per-node log record emitted during execution.
export interface NodeLog {
  nodeId: string;
  nodeLabel: string;
  status: 'SUCCESS' | 'FAILED';
  inputContext: string;
  output: string;
}

export interface RunWorkflowOptions {
  // Called after each node finishes (success or failure). Awaited so callers
  // can persist logs in order.
  onNodeResult?: (log: NodeLog) => Promise<void> | void;
}

const MAX_CONTEXT_CHARS = 10_000;

export async function executeWorkflowDAG(
  nodes: any[],
  edges: any[],
  options: RunWorkflowOptions = {}
) {
  const nodeOutputs: Record<string, any> = {};

  // Map incoming edge dependencies
  const incomingEdges: Record<string, string[]> = {};
  edges.forEach((edge) => {
    if (!incomingEdges[edge.target]) {
      incomingEdges[edge.target] = [];
    }
    incomingEdges[edge.target].push(edge.source);
  });

  // Sort nodes topologically for correct sequence execution
  const sortedNodes = getTopologicallySortedNodes(nodes, edges);

  for (const node of sortedNodes) {
    const parentNodeIds = incomingEdges[node.id] || [];

    // Combine upstream parent outputs
    const combinedParentInputs = parentNodeIds
      .map((parentId) => {
        const parentOutput = nodeOutputs[parentId];
        if (!parentOutput) return '';
        return typeof parentOutput === 'string'
          ? parentOutput
          : JSON.stringify(parentOutput, null, 2);
      })
      .filter(Boolean)
      .join('\n\n--- INCOMING INPUT ---\n\n');

    let inputContext = combinedParentInputs;
    let output = '';
    let status: NodeLog['status'] = 'SUCCESS';

    try {
      const isAgent = node.type === 'agentNode' || node.type === 'agent';
      const isInput = node.type === 'inputNode' || node.type === 'input';
      const isApi = node.type === 'apiNode' || node.type === 'apiFetcher' || node.type === 'api';
      const isRag = node.type === 'ragNode' || node.type === 'rag';

      if (isAgent) {
        const modelName = node.data?.model || DEFAULT_GROQ_MODEL;
        const systemInstructions =
          node.data?.instructions ||
          node.data?.systemPrompt ||
          'You are a helpful assistant.';

        // Combine inputs from parents and local node prompt
        let contextText = combinedParentInputs;
        if (node.data?.userPrompt) {
          contextText = contextText
            ? `${contextText}\n\nAdditional Instructions:\n${node.data.userPrompt}`
            : node.data.userPrompt;
        } else if (!contextText && node.data?.value) {
          contextText = node.data.value;
        }

        const safeContext = contextText.slice(0, MAX_CONTEXT_CHARS);
        inputContext = safeContext;

        const result = await generateText({
          model: getModelInstance(modelName),
          system: systemInstructions,
          prompt: safeContext
            ? `Here is the data to analyze:\n\n${safeContext}`
            : 'Please execute your task based on system instructions.',
          temperature: node.data?.temperature ?? 0.3,
        });

        output = result.text;
      } else if (isInput) {
        const content = node.data?.value || node.data?.content || node.data?.text || '';
        inputContext = '';
        output = content;
      } else if (isApi) {
        const url = node.data?.url;
        const method = node.data?.method || 'GET';
        inputContext = url ? `${method} ${url}` : '';

        if (url) {
          try {
            const res = await safeFetch(url, {
              method,
              headers: node.data?.headers,
              body: node.data?.body,
            });
            output = res.truncated
              ? `${res.text}\n\n[Response truncated at size limit]`
              : res.text;
            status = res.ok ? 'SUCCESS' : 'FAILED';
          } catch (apiErr: any) {
            output = `API Fetch Failed: ${apiErr.message}`;
            status = 'FAILED';
          }
        } else {
          output = '';
        }
      } else if (isRag) {
        const query = node.data?.query || '';
        const topK = node.data?.topK || 3;
        inputContext = combinedParentInputs;

        const rag = await retrieveRelevantPassages(combinedParentInputs, query, topK);
        output = rag.text;
        node.data = { ...node.data, ragMethod: rag.method };
      } else {
        output = combinedParentInputs || node.data?.value || node.data?.output || '';
      }

      nodeOutputs[node.id] = output;
      node.data = { ...node.data, output, status };
    } catch (err: any) {
      console.error(`Error executing node ${node.id}:`, err);
      output = `Execution Error: ${err.message}`;
      status = 'FAILED';
      node.data = { ...node.data, status, output };
      nodeOutputs[node.id] = output;
    }

    // Emit the per-node log (order preserved because we await).
    if (options.onNodeResult) {
      try {
        await options.onNodeResult({
          nodeId: node.id,
          nodeLabel: node.data?.label || node.data?.title || node.type || 'Node',
          status,
          inputContext,
          output,
        });
      } catch (logErr) {
        console.error(`Failed to emit log for node ${node.id}:`, logErr);
      }
    }
  }

  return { nodes: sortedNodes, outputs: nodeOutputs };
}

export const runWorkflowDAG = executeWorkflowDAG;

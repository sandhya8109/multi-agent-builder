import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

function hasAIProvider() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY);
}

function getModelInstance(modelName: string) {
  const model = modelName ? modelName.trim() : '';

  if (
    !model ||
    model.includes('llama3-8b-8192') ||
    model.includes('llama3-8b') ||
    model === 'llama3-70b-8192'
  ) {
    return groq('llama-3.1-8b-instant');
  }

  if (model.includes('llama-3.3') || model.includes('70b')) {
    return groq('llama-3.3-70b-versatile');
  }

  if (
    model.toLowerCase().includes('llama') ||
    model.toLowerCase().includes('groq') ||
    model.toLowerCase().includes('mixtral')
  ) {
    return groq(model);
  }

  return openai(model || 'gpt-4o-mini');
}

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

  const cycleNodes = nodes
    .filter((node) => !sorted.some((entry) => entry.id === node.id))
    .map((node) => node.id);

  if (cycleNodes.length > 0) {
    throw new Error(
      `Workflow graph contains a cycle. Check the connections for: ${cycleNodes.join(', ')}`
    );
  }

  return sorted;
}

export async function executeWorkflowDAG(nodes: any[], edges: any[]) {
  const nodeOutputs: Record<string, any> = {};

  if (!nodes.length) {
    return { nodes: [], outputs: {} };
  }

  if (!hasAIProvider()) {
    throw new Error('No AI provider is configured. Add OPENAI_API_KEY or GROQ_API_KEY to run agent nodes.');
  }

  const incomingEdges: Record<string, string[]> = {};
  edges.forEach((edge) => {
    if (!incomingEdges[edge.target]) {
      incomingEdges[edge.target] = [];
    }
    incomingEdges[edge.target].push(edge.source);
  });

  const sortedNodes = getTopologicallySortedNodes(nodes, edges);

  for (const node of sortedNodes) {
    const parentNodeIds = incomingEdges[node.id] || [];

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

    try {
      const isAgent = node.type === 'agentNode' || node.type === 'agent';
      const isInput = node.type === 'inputNode' || node.type === 'input';
      const isApi = node.type === 'apiNode' || node.type === 'apiFetcher' || node.type === 'api';

      if (isAgent) {
        const modelName = node.data?.model || 'llama-3.1-8b-instant';
        const systemInstructions =
          node.data?.instructions || node.data?.systemPrompt || 'You are a helpful assistant.';

        let contextText = combinedParentInputs;
        if (node.data?.userPrompt) {
          contextText = contextText
            ? `${contextText}\n\nAdditional Instructions:\n${node.data.userPrompt}`
            : node.data.userPrompt;
        } else if (!contextText && node.data?.value) {
          contextText = node.data.value;
        }

        const safeContext = contextText.slice(0, 10000);

        const result = await generateText({
          model: getModelInstance(modelName),
          system: systemInstructions,
          prompt: safeContext
            ? `Here is the data to analyze:\n\n${safeContext}`
            : 'Please execute your task based on system instructions.',
          temperature: node.data?.temperature ?? 0.3,
        });

        nodeOutputs[node.id] = result.text;
        node.data = { ...node.data, output: result.text, status: 'SUCCESS' };
      } else if (isInput) {
        const content = node.data?.value || node.data?.content || node.data?.text || '';
        nodeOutputs[node.id] = content;
        node.data = { ...node.data, output: content, status: 'SUCCESS' };
      } else if (isApi) {
        const url = node.data?.url;
        const method = node.data?.method || 'GET';

        if (url) {
          try {
            const response = await fetch(url, { method });
            const responseData = await response.text();
            nodeOutputs[node.id] = responseData;
            node.data = { ...node.data, output: responseData, status: 'SUCCESS' };
          } catch (apiErr: any) {
            const errText = `API Fetch Failed: ${apiErr.message}`;
            nodeOutputs[node.id] = errText;
            node.data = { ...node.data, output: errText, status: 'FAILED' };
          }
        } else {
          nodeOutputs[node.id] = '';
          node.data = { ...node.data, status: 'SUCCESS' };
        }
      } else {
        nodeOutputs[node.id] = combinedParentInputs || node.data?.value || node.data?.output || '';
        node.data = { ...node.data, output: nodeOutputs[node.id], status: 'SUCCESS' };
      }
    } catch (err: any) {
      console.error(`Error executing node ${node.id}:`, err);
      const errMsg = `Execution Error: ${err.message}`;
      node.data = { ...node.data, status: 'FAILED', output: errMsg };
      nodeOutputs[node.id] = errMsg;
    }
  }

  return { nodes: sortedNodes, outputs: nodeOutputs };
}

export const runWorkflowDAG = executeWorkflowDAG;
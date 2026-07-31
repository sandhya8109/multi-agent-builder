import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

// Initialize Provider Instances
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Helper to select the correct AI model instance
// Helper to select the correct AI model instance with fallback for deprecated models
function getModelInstance(modelName: string) {
  let model = modelName ? modelName.trim() : '';

  // 1. Remap decommissioned Groq model names to active equivalents
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

  // 2. Handle Groq / Llama models
  if (model.toLowerCase().includes('llama') || model.toLowerCase().includes('groq') || model.toLowerCase().includes('mixtral')) {
    return groq(model);
  }

  // 3. Handle OpenAI models
  return openai(model || 'gpt-4o-mini');
}

export async function executeWorkflowDAG(nodes: any[], edges: any[]) {
  const nodeOutputs: Record<string, any> = {};

  // Build adjacency map to find upstream inputs for each node
  const incomingEdges: Record<string, string[]> = {};
  edges.forEach((edge) => {
    if (!incomingEdges[edge.target]) {
      incomingEdges[edge.target] = [];
    }
    incomingEdges[edge.target].push(edge.source);
  });

  // Topologically process / execute nodes
  for (const node of nodes) {
    const parentNodeIds = incomingEdges[node.id] || [];

    // Collect all incoming context (Resume + Job Description)
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
      if (node.type === 'agentNode' || node.type === 'agent') {
        const modelName = node.data?.model || 'llama-3.1-8b-instant';
        const systemInstructions =
          node.data?.instructions ||
          node.data?.systemPrompt ||
          'You are a helpful assistant.';

        // Truncate input text to safely avoid token limits (~10,000 chars)
        const contextText = combinedParentInputs || node.data?.value || '';
        const safeContext = contextText.slice(0, 10000);

        const result = await generateText({
          model: getModelInstance(modelName),
          system: systemInstructions,
          prompt: safeContext
            ? `Here is the data to analyze:\n\n${safeContext}`
            : 'Please execute your task.',
          temperature: node.data?.temperature ?? 0.3,
        });

        nodeOutputs[node.id] = result.text;
        node.data.output = result.text;
        node.data.status = 'SUCCESS';
      } else if (node.type === 'inputNode' || node.type === 'input') {
        const content = node.data?.value || node.data?.content || '';
        nodeOutputs[node.id] = content;
        node.data.output = content;
        node.data.status = 'SUCCESS';
      } else if (node.type === 'apiNode' || node.type === 'apiFetcher') {
        const content =
          node.data?.output || node.data?.response || node.data?.url || '';
        nodeOutputs[node.id] = content;
        node.data.output = content;
        node.data.status = 'SUCCESS';
      } else {
        nodeOutputs[node.id] = combinedParentInputs || node.data?.value || '';
        node.data.output = nodeOutputs[node.id];
        node.data.status = 'SUCCESS';
      }
    } catch (err: any) {
      console.error(`Error executing node ${node.id}:`, err);
      node.data.status = 'FAILED';
      node.data.output = `Agent Execution Error: ${err.message}`;
      nodeOutputs[node.id] = `Agent Execution Error: ${err.message}`;
    }
  }

  return { nodes, outputs: nodeOutputs };
}

// Export alias to satisfy imports looking for runWorkflowDAG
export const runWorkflowDAG = executeWorkflowDAG;
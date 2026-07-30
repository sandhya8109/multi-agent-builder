import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// RAG text chunking and keyword relevance scoring
function extractTopRelevantChunks(text: string, query: string, topK: number = 3): string {
  if (!text || !query) return text.slice(0, 5000);

  const chunks = text.split(/\n\s*\n/).filter((c) => c.trim().length > 40);
  if (chunks.length <= topK) return text;

  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const scoredChunks = chunks.map((chunk) => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    queryTerms.forEach((term) => {
      const matches = (chunkLower.match(new RegExp(term, 'g')) || []).length;
      score += matches * 2;
    });
    return { chunk, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks
    .slice(0, topK)
    .map((item, idx) => `[Relevant Passage #${idx + 1}]\n${item.chunk}`)
    .join('\n\n---\n\n');
}

// Model provider helper
function getModel(modelName: string = 'gpt-4o-mini') {
  const groqApiKey = process.env.GROQ_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (groqApiKey && (modelName.includes('llama') || modelName.includes('mixtral') || modelName.includes('gemma'))) {
    const groqOpenAI = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: groqApiKey,
    });
    return groqOpenAI(modelName || 'llama-3.3-70b-versatile');
  }

  const openai = createOpenAI({
    apiKey: openAiApiKey || '',
  });
  return openai(modelName || 'gpt-4o-mini');
}

interface Node {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface Edge {
  source: string;
  target: string;
}

export async function runWorkflowDAG(nodes: Node[] = [], edges: Edge[] = []) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];

  const outputs: Record<string, string> = {};
  const metricsMap: Record<string, { latency: string; tokens: number }> = {};

  const incomingEdges: Record<string, string[]> = {};
  safeNodes.forEach((n) => {
    incomingEdges[n.id] = [];
  });
  safeEdges.forEach((e) => {
    if (incomingEdges[e.target]) {
      incomingEdges[e.target].push(e.source);
    }
  });

  for (const node of safeNodes) {
    const startTime = Date.now();
    let outputText = '';
    let executionMetrics = { latency: '0s', tokens: 0 };

    const parentIds = incomingEdges[node.id] || [];
    const parentContexts = parentIds
      .map((pId) => outputs[pId])
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (node.type === 'input') {
      outputText = node.data?.value || '';
    } else if (node.type === 'api') {
      const url = node.data?.url || node.data?.endpoint || '';
      if (url) {
        try {
          const res = await fetch(url);
          outputText = await res.text();
        } catch (err: any) {
          outputText = `API Fetch Error: ${err.message}`;
        }
      } else {
        outputText = 'No URL provided for API Fetcher node.';
      }
    } else if (node.type === 'rag') {
      const query = node.data?.query || '';
      const topK = node.data?.topK || 3;
      outputText = extractTopRelevantChunks(parentContexts, query, topK);
    } else if (node.type === 'agent') {
      const systemInstructions =
        node.data?.systemInstructions ||
        node.data?.instructions ||
        'Summarize the input context.';
      const modelName = node.data?.model || 'gpt-4o-mini';

      const prompt = parentContexts
        ? `Context Data:\n${parentContexts}\n\nTask Instructions:\n${systemInstructions}`
        : systemInstructions;

      try {
        const model = getModel(modelName);
        const response = await generateText({
          model,
          prompt,
          temperature: node.data?.temperature ?? 0.7,
        });

        outputText = response.text;
        const tokenUsage = response.usage?.totalTokens || 0;
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        executionMetrics = { latency: `${duration}s`, tokens: tokenUsage };
      } catch (err: any) {
        outputText = `Agent Execution Error: ${err.message}`;
      }
    } else if (node.type === 'output') {
      outputText = parentContexts || 'No upstream content received.';
    }

    outputs[node.id] = outputText;
    metricsMap[node.id] = executionMetrics;
    if (node.data) {
      node.data.metrics = executionMetrics;
    }
  }

  return { outputs, metricsMap };
}
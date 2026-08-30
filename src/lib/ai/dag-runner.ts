import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, embed, embedMany, cosineSimilarity } from 'ai';
import type {
  WorkflowNode,
  WorkflowEdge,
  NodeExecutionLog,
  WorkflowExecutionResult,
} from '@/lib/types/workflow';
import { isAgentNode, isInputNode, isApiNode, isRagNode, isOutputNode } from '@/lib/ai/node-types';

// Initialize Provider Instances
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// ---------------------------------------------------------------------------
// Model selection.
//
// Groq deprecates model ids frequently — this app previously hardcoded
// 'llama-3.1-8b-instant' and 'llama-3.3-70b-versatile' as defaults, and
// both now 404 with "does not exist or you do not have access to it".
// GROQ_FAST_MODEL/GROQ_QUALITY_MODEL below were verified live against this
// account's actual catalog (GET https://api.groq.com/openai/v1/models) on
// 2026-08-30 — re-check that endpoint if agent nodes start 404ing again
// rather than guessing a replacement id.
// ---------------------------------------------------------------------------
const GROQ_FAST_MODEL = 'openai/gpt-oss-20b';
const GROQ_QUALITY_MODEL = 'openai/gpt-oss-120b';

// Namespaces/ids actually present in this account's Groq catalog as of the
// verification above. Anything not matching is assumed to be a plain
// OpenAI model id (e.g. 'gpt-4o-mini') and sent to the OpenAI provider.
const GROQ_MODEL_PATTERN = /^(openai\/|qwen\/|meta-llama\/|groq\/|canopylabs\/|allam|whisper|llama)/i;

interface ResolvedModel {
  instance: ReturnType<typeof groq> | ReturnType<typeof openai>;
  /** True when the resolved instance talks to Groq's OpenAI-compatible API. */
  isGroq: boolean;
}

function getModelInstance(modelName: string): ResolvedModel {
  const model = modelName ? modelName.trim() : '';

  if (!model) {
    return { instance: groq(GROQ_FAST_MODEL), isGroq: true };
  }

  // Back-compat: workflows/templates saved before Groq deprecated the old
  // llama-3.x family still have those exact names in node.data.model. Map
  // them onto the closest currently-live equivalents instead of sending a
  // request that's guaranteed to 404.
  if (
    model === 'llama3-8b-8192' ||
    model === 'llama3-70b-8192' ||
    model === 'llama-3.1-8b-instant' ||
    model.includes('llama3-8b')
  ) {
    return { instance: groq(GROQ_FAST_MODEL), isGroq: true };
  }

  if (model === 'llama-3.3-70b-versatile' || model.includes('llama-3.3') || model.includes('70b')) {
    return { instance: groq(GROQ_QUALITY_MODEL), isGroq: true };
  }

  if (GROQ_MODEL_PATTERN.test(model)) {
    return { instance: groq(model), isGroq: true };
  }

  return { instance: openai(model || 'gpt-4o-mini'), isGroq: false };
}

// ---------------------------------------------------------------------------
// Retry helper — every outbound call (model call, HTTP fetch, embeddings)
// gets bounded retries with backoff instead of failing on the first
// transient error. Failures are logged, never swallowed.
//
// Retries are skipped for errors that are permanent by nature — a bad
// model id, an exhausted quota, an invalid API key. Retrying those wastes
// 20-30s per node reproducing the exact same failure (this is what made
// the "model does not exist" and "no credits remaining" errors so slow to
// see in the logs) instead of surfacing the real problem immediately.
// ---------------------------------------------------------------------------
function isPermanentError(err: unknown): boolean {
  const anyErr = err as
    | { statusCode?: number; message?: string; isRetryable?: boolean }
    | undefined;

  // The AI SDK already tells us when the provider says "don't bother
  // retrying this" (e.g. Groq's 413 "request too large for TPM limit" —
  // no amount of retrying within a couple of seconds fixes a per-minute
  // token-budget rejection, since the account's limit doesn't reset that
  // fast). Trust that signal first.
  if (anyErr?.isRetryable === false) return true;

  if (anyErr?.statusCode && [401, 403, 404, 413].includes(anyErr.statusCode)) return true;

  const message = anyErr?.message || String(err);
  return /model_not_found|does not exist|invalid api key|insufficient_quota|credit_balance_exhausted|no credits remaining|rate_limit_exceeded|tokens per minute|request too large/i.test(
    message
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { label: string; retries?: number; baseDelayMs?: number }
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 400;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (isPermanentError(err)) {
        console.error(`[dag-runner] ${opts.label} failed with a non-retryable error, not retrying:`, err);
        throw err;
      }

      if (attempt < retries) {
        const delay = baseDelayMs * 2 ** attempt;
        console.error(
          `[dag-runner] ${opts.label} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
          err
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastErr;
}

// Helper: Topologically sort nodes so parents run before children
function getTopologicallySortedNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));
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

  const sorted: WorkflowNode[] = [];
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

  // Fallback for any unvisited nodes (e.g. cycles) so a malformed graph still
  // executes something rather than silently dropping nodes.
  nodes.forEach((n) => {
    if (!sorted.find((s) => s.id === n.id)) {
      sorted.push(n);
    }
  });

  return sorted;
}

// ---------------------------------------------------------------------------
// RAG node — real (not placeholder) semantic passage filtering.
//
// There is no persisted vector store here: this splits the upstream text
// into chunks, embeds the chunks and the query with OpenAI embeddings, and
// keeps the top-K chunks by cosine similarity. That's a genuine retrieval
// step scoped to a single run's input, not a lie about having a vector
// database. Wiring this to a persisted store (pgvector, etc.) is future
// work if the workflows need retrieval across documents rather than within
// one run's upstream output.
// ---------------------------------------------------------------------------
function chunkText(text: string, maxChunkChars = 600): string[] {
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkChars) {
      chunks.push(paragraph);
      continue;
    }
    for (let start = 0; start < paragraph.length; start += maxChunkChars) {
      const slice = paragraph.slice(start, start + maxChunkChars).trim();
      if (slice) chunks.push(slice);
    }
  }

  return chunks;
}

async function runRagFilter(
  inputText: string,
  query: string,
  topK: number
): Promise<{ output: string; status: 'SUCCESS' | 'FAILED' }> {
  if (!inputText.trim()) {
    return { output: '', status: 'SUCCESS' };
  }

  if (!query.trim()) {
    // No query to filter by — pass the upstream text through unchanged
    // rather than guessing at what to keep.
    return { output: inputText, status: 'SUCCESS' };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      output:
        'RAG Filter Error: OPENAI_API_KEY is not set. Semantic passage filtering requires OpenAI embeddings — add OPENAI_API_KEY to .env.local.',
      status: 'FAILED',
    };
  }

  const chunks = chunkText(inputText);
  if (chunks.length === 0) {
    return { output: '', status: 'SUCCESS' };
  }

  try {
    const embeddingModel = openai.textEmbeddingModel('text-embedding-3-small');

    const [{ embedding: queryEmbedding }, { embeddings: chunkEmbeddings }] = await withRetry(
      () =>
        Promise.all([
          embed({ model: embeddingModel, value: query }),
          embedMany({ model: embeddingModel, values: chunks }),
        ]),
      { label: 'RAG embeddings' }
    );

    const ranked = chunks
      .map((chunk, i) => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunkEmbeddings[i]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK));

    return { output: ranked.map((r) => r.chunk).join('\n\n---\n\n'), status: 'SUCCESS' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `RAG Filter Error: ${message}`, status: 'FAILED' };
  }
}

export interface ExecuteWorkflowOptions {
  /** Called once per node after it finishes executing, for observability. */
  onNodeLog?: (log: NodeExecutionLog) => void | Promise<void>;
}

export async function executeWorkflowDAG(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options: ExecuteWorkflowOptions = {}
): Promise<WorkflowExecutionResult> {
  const nodeOutputs: Record<string, string> = {};
  const logs: NodeExecutionLog[] = [];

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
    const startedAt = new Date().toISOString();
    const parentNodeIds = incomingEdges[node.id] || [];

    // Combine upstream parent outputs
    const combinedParentInputs = parentNodeIds
      .map((parentId) => nodeOutputs[parentId])
      .filter(Boolean)
      .join('\n\n--- INCOMING INPUT ---\n\n');

    let status: NodeExecutionLog['status'] = 'SUCCESS';
    let output = '';
    let errorMessage: string | undefined;

    try {
      if (isAgentNode(node.type)) {
        const modelName = node.data?.model || 'llama-3.1-8b-instant';
        const systemInstructions =
          node.data?.instructions || 'You are a helpful assistant.';

        let contextText = combinedParentInputs || node.data?.value || '';
        // Groq's on_demand service tier enforces an org-wide tokens-per-minute
        // cap (this account's is 8000 TPM) that counts prompt tokens *plus*
        // the requested max_tokens against the same budget — a request can
        // be rejected outright (413) even with zero conversation history if
        // max_tokens alone is set too high. Keep the context slice modest so
        // prompt + maxOutputTokens below stays comfortably under that cap.
        const safeContext = contextText.slice(0, 6000);

        const { instance: modelInstance, isGroq } = getModelInstance(modelName);

        // gpt-oss (and other reasoning-capable) Groq models spend completion
        // tokens on a hidden "analysis" pass before writing the visible
        // answer. Without reasoningEffort capped, a task can burn its whole
        // output budget on that hidden pass and never reach the final
        // answer, which comes back as a *successful* call with an empty
        // `text` — no error is thrown, so this used to look like a node
        // that silently produced nothing. reasoningEffort: 'low' keeps most
        // of the (deliberately small, see TPM note above) output budget
        // available for the actual answer.
        const result = await withRetry(
          () =>
            generateText({
              model: modelInstance,
              system: systemInstructions,
              prompt: safeContext
                ? `Here is the data to analyze:\n\n${safeContext}`
                : 'Please execute your task based on system instructions.',
              temperature: node.data?.temperature ?? 0.3,
              // See the TPM note above: this must stay low enough that
              // safeContext (≈1500 tokens worst case) + this value still
              // lands well under the account's 8000 TPM ceiling, even
              // though nothing enforces that; unused response headroom
              // just makes the model rejected outright before Groq ever
              // reads the prompt.
              maxOutputTokens: 1024,
              ...(isGroq
                ? { providerOptions: { groq: { reasoningEffort: 'low' as const } } }
                : {}),
            }),
          { label: `agent node ${node.id}` }
        );

        output = result.text;

        // Defensive fallback: if the provider returned no error but also no
        // visible text (e.g. a reasoning model that only produced hidden
        // "analysis" content), surface that instead of a blank output so
        // the failure is visible and diagnosable rather than silent.
        if (!output && result.reasoningText) {
          output = `[Model returned no final answer text — showing its reasoning output instead. Consider raising this node's output budget or simplifying its task.]\n\n${result.reasoningText.slice(0, 4000)}`;
          console.error(
            `[dag-runner] Node ${node.id} (${node.type}) got empty text from ${modelName}; falling back to reasoningText (finishReason=${result.finishReason}).`
          );
        } else if (!output) {
          console.error(
            `[dag-runner] Node ${node.id} (${node.type}) got empty text from ${modelName} with no reasoning fallback available (finishReason=${result.finishReason}).`
          );
        }
      } else if (isInputNode(node.type)) {
        output = node.data?.value || '';
      } else if (isApiNode(node.type)) {
        const url = node.data?.url;
        const method = node.data?.method || 'GET';

        if (url) {
          const response = await withRetry(
            async () => {
              const res = await fetch(url, { method });
              if (!res.ok && res.status >= 500) {
                throw new Error(`API responded with ${res.status}`);
              }
              return res;
            },
            { label: `API node ${node.id}` }
          );
          output = await response.text();
          if (!response.ok) status = 'FAILED';
        } else {
          output = '';
        }
      } else if (isRagNode(node.type)) {
        const ragResult = await runRagFilter(
          combinedParentInputs,
          node.data?.query || '',
          node.data?.topK ?? 3
        );
        output = ragResult.output;
        status = ragResult.status;
      } else if (isOutputNode(node.type)) {
        output = combinedParentInputs || node.data?.value || '';
      } else {
        // Unknown node type — pass upstream data through rather than
        // silently dropping it.
        output = combinedParentInputs || node.data?.value || node.data?.output || '';
      }
    } catch (err) {
      status = 'FAILED';
      errorMessage = err instanceof Error ? err.message : String(err);
      output = `Execution Error: ${errorMessage}`;
      console.error(`[dag-runner] Node ${node.id} (${node.type}) failed:`, err);
    }

    node.data = { ...node.data, output, status, errorMessage: errorMessage ?? null };
    nodeOutputs[node.id] = output;

    const log: NodeExecutionLog = {
      nodeId: node.id,
      nodeLabel: node.data?.label || node.id,
      status,
      inputContext: combinedParentInputs,
      output,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: errorMessage,
    };
    logs.push(log);

    if (options.onNodeLog) {
      try {
        await options.onNodeLog(log);
      } catch (logErr) {
        // Logging must never take down the run itself, but a failure here
        // is still a real problem (the Logs panel will be missing data) —
        // surface it instead of swallowing it.
        console.error(`[dag-runner] onNodeLog callback failed for node ${node.id}:`, logErr);
      }
    }
  }

  return { nodes: sortedNodes, outputs: nodeOutputs, logs };
}

export const runWorkflowDAG = executeWorkflowDAG;

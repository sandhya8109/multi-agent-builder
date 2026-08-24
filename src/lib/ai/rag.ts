import { createOpenAI } from '@ai-sdk/openai';
import { embedMany, cosineSimilarity } from 'ai';

/**
 * Retrieval for the RAG node.
 *
 * The node sits in the DAG with upstream nodes feeding it text and a `query` +
 * `topK` config. Its job is genuine retrieval: split the incoming text into
 * passages and return the `topK` passages most relevant to the query.
 *
 * Ranking strategy:
 *   1. Embedding similarity (OpenAI text-embedding-3-small + cosine) — the real
 *      semantic path, used when OPENAI_API_KEY is configured.
 *   2. Lexical overlap (query-term frequency, length-normalised) — a genuine
 *      fallback used when no embedding key is available, so the node still
 *      retrieves rather than silently passing text through.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
// Cap how many passages we embed in one run to bound cost/latency; when a
// document has more passages than this we lexically pre-filter first.
const MAX_PASSAGES_TO_EMBED = 200;
const MAX_CHUNK_CHARS = 1_000;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'at', 'by', 'as', 'it',
  'this', 'that', 'these', 'those', 'from', 'into', 'than', 'then', 'so', 'such',
]);

export interface RagResult {
  passages: string[];
  method: 'embedding' | 'lexical' | 'passthrough';
  text: string;
}

/** Split raw text into reasonably-sized passages for retrieval. */
export function chunkText(text: string): string[] {
  const byParagraph = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const para of byParagraph) {
    if (para.length <= MAX_CHUNK_CHARS) {
      chunks.push(para);
      continue;
    }
    // Long paragraph: split on sentence boundaries and regroup into windows.
    const sentences = para.match(/[^.!?]+[.!?]*\s*/g) ?? [para];
    let current = '';
    for (const sentence of sentences) {
      if ((current + sentence).length > MAX_CHUNK_CHARS && current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks;
}

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length > 2 && !STOPWORDS.has(t)
  );
}

/** Lexical relevance: distinct-term coverage + frequency, length-normalised. */
function lexicalRank(passages: string[], query: string, topK: number): string[] {
  const queryTerms = new Set(tokenize(query));
  if (queryTerms.size === 0) return passages.slice(0, topK);

  const scored = passages.map((passage) => {
    const tokens = tokenize(passage);
    if (tokens.length === 0) return { passage, score: 0 };

    let occurrences = 0;
    const matchedDistinct = new Set<string>();
    for (const token of tokens) {
      if (queryTerms.has(token)) {
        occurrences += 1;
        matchedDistinct.add(token);
      }
    }
    // Reward covering more distinct query terms; normalise by passage length so
    // long passages don't win purely on size.
    const score = (matchedDistinct.size * 2 + occurrences) / Math.sqrt(tokens.length);
    return { passage, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.passage);
}

async function embeddingRank(
  passages: string[],
  query: string,
  topK: number
): Promise<string[]> {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

  // Bound cost: if there are too many passages, lexically pre-filter first.
  const candidates =
    passages.length > MAX_PASSAGES_TO_EMBED
      ? lexicalRank(passages, query, MAX_PASSAGES_TO_EMBED)
      : passages;

  const { embeddings } = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: [query, ...candidates],
  });

  const queryEmbedding = embeddings[0];
  const passageEmbeddings = embeddings.slice(1);

  return candidates
    .map((passage, i) => ({
      passage,
      score: cosineSimilarity(queryEmbedding, passageEmbeddings[i]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.passage);
}

export async function retrieveRelevantPassages(
  text: string,
  query: string,
  topK = 3
): Promise<RagResult> {
  const k = Math.max(1, Math.min(topK || 3, 10));
  const trimmed = (text || '').trim();

  if (!trimmed) {
    return { passages: [], method: 'passthrough', text: '' };
  }

  const passages = chunkText(trimmed);

  // No query configured: retrieval is undefined, so return the first K passages
  // rather than dropping content. Honest, not a silent no-op.
  if (!query || !query.trim()) {
    const first = passages.slice(0, k);
    return { passages: first, method: 'passthrough', text: first.join('\n\n---\n\n') };
  }

  // Only one (or fewer) passage: nothing to rank.
  if (passages.length <= 1) {
    return { passages, method: 'passthrough', text: passages.join('\n\n---\n\n') };
  }

  let ranked: string[];
  let method: RagResult['method'];

  if (process.env.OPENAI_API_KEY) {
    try {
      ranked = await embeddingRank(passages, query, k);
      method = 'embedding';
    } catch {
      // Embedding call failed (bad key, quota, network) — fall back to lexical
      // rather than losing the retrieval step entirely.
      ranked = lexicalRank(passages, query, k);
      method = 'lexical';
    }
  } else {
    ranked = lexicalRank(passages, query, k);
    method = 'lexical';
  }

  // If ranking matched nothing (e.g. query terms absent), degrade to the first
  // K passages so downstream nodes still receive context.
  if (ranked.length === 0) {
    ranked = passages.slice(0, k);
    method = 'passthrough';
  }

  return { passages: ranked, method, text: ranked.join('\n\n---\n\n') };
}

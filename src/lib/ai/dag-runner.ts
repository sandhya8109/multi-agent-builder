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

// Universal helper to parse PDF buffers across all pdf-parse module versions
async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  // 1. Try direct CJS module path (bypasses Turbopack export wrappers)
  try {
    const pdfLib = require('pdf-parse/lib/pdf-parse.js');
    if (typeof pdfLib === 'function') {
      const res = await pdfLib(buffer);
      if (res?.text) return res.text;
    }
  } catch {}

  // 2. Try root module (handles both function and class exports)
  const pdfModule = require('pdf-parse');

  const fn = typeof pdfModule === 'function'
    ? pdfModule
    : pdfModule.default && typeof pdfModule.default === 'function'
      ? pdfModule.default
      : null;

  if (fn) {
    const res = await fn(buffer);
    if (res?.text) return res.text;
  }

  const PDFParseClass = pdfModule.PDFParse || (pdfModule.default && pdfModule.default.PDFParse);
  if (PDFParseClass) {
    const parser = new PDFParseClass({ data: buffer });
    const res = await parser.getText();
    if (parser.destroy) await parser.destroy();
    if (res?.text) return res.text;
  }

  throw new Error('Could not resolve a valid PDF parser function from pdf-parse.');
}

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

  const queue: string[] = Object.keys(inDegree).filter(
    (id) => inDegree[id] === 0
  );

  const outputs: Record<string, string> = {};

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) continue;

    await supabase.from('run_logs').insert({
      run_id: runId,
      node_id: node.id,
      node_label: node.data.label || node.type || 'Node',
      status: 'RUNNING',
      log_data: { parent_sources: parentMap[node.id] },
    });

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
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/pdf,application/json,text/html,*/*',
          },
        });

        if (!apiRes.ok) {
          throw new Error(`HTTP ${apiRes.status}: ${apiRes.statusText}`);
        }

        const contentType = (apiRes.headers.get('content-type') || '').toLowerCase();
        const isPdf = contentType.includes('application/pdf') || rawUrl.toLowerCase().includes('.pdf');

        if (isPdf) {
          const arrayBuffer = await apiRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          const fullText = (await parsePdfBuffer(buffer)).trim();

          if (!fullText) {
            outputText = 'No readable text content found in PDF.';
          } else {
            outputText = fullText.slice(0, 35000);
            if (fullText.length > 35000) {
              outputText += '\n\n---\n*[Note: Document truncated to first 35,000 characters to fit model context limit.]*';
            }
          }
        } else {
          const rawText = await apiRes.text();

          try {
            const parsed = JSON.parse(rawText);
            outputText = JSON.stringify(parsed, null, 2);
          } catch {
            if (contentType.includes('text/html') || rawText.trim().startsWith('<')) {
              let cleanText = rawText.replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '');
              cleanText = cleanText.replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '');
              cleanText = cleanText.replace(/<[^>]+>/g, ' ');
              cleanText = cleanText.replace(/\s+/g, ' ').trim();
              outputText = cleanText.slice(0, 20000);
            } else {
              outputText = rawText;
            }
          }
        }
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
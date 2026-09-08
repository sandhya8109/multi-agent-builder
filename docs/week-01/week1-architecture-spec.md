# Workflow Architecture Specification

**Project:** Multi-Agent Workflow Builder (Job Application Autopilot, Finance Analyzer, and Hook Master templates)
**Student:** Sandy Rimal
**Course:** [fill in — course name/number]
**Semester:** [fill in — e.g. Fall 2026]
**Week:** 1 of 12 — System Architecture & Workflow Schema Specification
**Date:** August 30, 2026

**Deliverable this document satisfies:** *Formal Workflow Architecture Specification Document & JSON Schema definition* (see accompanying `workflow-schema.json`).

**Adaptation note:** the 12-week roadmap this deliverable is scheduled against describes a generic Python/FastAPI backend with a Poetry-managed repo and a CLI-first execution engine. The system actually designed and built is a Next.js 16 (App Router) web application on Supabase, using React Flow for the canvas. This document describes the architecture as it was actually implemented, not the roadmap's original generic assumption — the roadmap's *phase structure and weekly cadence* (schema first, then a single-node PoC, then the execution engine, etc.) still applies and is what this document follows.

---

## 1. Overview & Scope

The system is a visual, node-based builder for chaining large-language-model reasoning steps into a directed graph — a workflow. A user drags nodes onto a canvas, wires them together with edges, and runs the graph; each node consumes whatever its upstream parents produced, does its own work (an LLM call, a URL fetch, a semantic-similarity filter, or a pass-through), and hands its output to whatever is wired downstream. The motivating design goal, restated from the project's own scope statement, is that a workflow built from small, single-purpose nodes is easier to inspect, tune, and reuse than one giant prompt: a failure is traceable to a specific node's output rather than buried inside one long completion.

Architecturally, this puts the project in the same family as node-based automation tools (n8n, Zapier) but scoped specifically to LLM reasoning steps rather than general app-to-app integration, and — as a deliberate scope boundary — with no in-graph conditional branching and no agentic tool-calling inside a single node (Section 9 records this as a documented constraint, not an oversight).

## 2. System Architecture

At a high level the system has four layers:

1. **Canvas UI** (`src/components/canvas/`) — a React Flow (`@xyflow/react`) canvas rendering one custom React component per node type (`AgentNode.tsx`, `InputNode.tsx`, `ApiNode.tsx`, `RAGNode.tsx`, `OutputNode.tsx`), backed by a Zustand store (`useCanvasStore.ts`) holding the canvas's live `nodes`/`edges` arrays and an `updateNodeData` action every node component calls to edit its own settings in place.
2. **Persistence & auth** (Supabase) — Google sign-in via Supabase Auth gates every route except `/login`; the workflow graph itself (`nodes`, `edges`, `name`, `user_id`) is stored as a row in `public.workflows`, read/written through `src/lib/supabase/{client,server}.ts`.
3. **API routes** (`src/app/api/workflows/...`, Next.js Route Handlers) — CRUD on workflows (`route.ts`, `[id]/route.ts`), a single-node test endpoint (`test-node/route.ts` — the "Play" button on `AgentNode.tsx`), and the run endpoint (`[id]/execute/route.ts`) that actually executes the graph server-side.
4. **DAG execution engine** (`src/lib/ai/dag-runner.ts`) — a pure function, `executeWorkflowDAG(nodes, edges, options)`, that topologically sorts the graph and executes each node in order, independent of any HTTP or UI concern. The execute route is a thin wrapper around it that also writes each node's result to `public.run_logs` as it happens, which the Execution Logs panel (`ExecutionLogsSheet.tsx`) subscribes to via Supabase Realtime — so a run is watched live, node by node, rather than waited on behind a single spinner.

Model access goes through the Vercel AI SDK (`ai`, `@ai-sdk/groq`, `@ai-sdk/openai`), with Groq as the default provider for Agent Node completions (fast, generously free-tiered) and OpenAI reserved specifically for the `text-embedding-3-small` embeddings model the RAG Filter node uses — the two providers are not interchangeable for every purpose in this codebase, only for agent text generation.

## 3. Workflow Graph Model

A workflow is a directed graph: an array of **nodes** (`WorkflowNode`) and an array of **edges** (`WorkflowEdge`), matching standard React Flow shapes so the canvas, the save API, and the execution engine share one representation with no translation layer between them.

- A **node** has an `id`, a `type` (which node kind it is), a canvas `position` (`{x, y}`, used only by the UI), and a `data` object holding both that node type's configuration and, after a run, its `status`/`output`.
- An **edge** has an `id`, a `source` node id, and a `target` node id, and represents "the target node receives the source node's output as part of its input." Edges carry no condition or label — routing is exactly what the user draws, which is the documented scope boundary against in-graph conditional branching noted in Section 1.

Execution order is not stored explicitly; it is derived every run by topologically sorting the node/edge list (Section 5), so reordering nodes on the canvas, or the array order they happen to be saved in, has no effect on execution order — only the edges do.

## 4. Node Type Specifications

The system has exactly five node types. Both a canonical long-form `type` string and one or more legacy short forms are accepted everywhere a node's kind is checked (`src/lib/ai/node-types.ts`'s `isAgentNode`/`isInputNode`/`isApiNode`/`isRagNode`/`isOutputNode` helpers), so a workflow saved before the current naming convention keeps executing correctly; new nodes are always created with the long form.

**Agent Node** (`agentNode` / `agent`) — the workhorse. Configuration: `instructions` (system prompt), `model` (a Groq model id such as `openai/gpt-oss-20b`/`openai/gpt-oss-120b`, or an OpenAI id such as `gpt-4o-mini`), `temperature` (0–1), and a display `label`. At run time it concatenates all upstream parent outputs (or its own `value` if it has none) as the prompt context and calls `generateText()` from the Vercel AI SDK against the resolved provider.

**User Input** (`inputNode` / `input` / `userInput`) — where real data enters the graph, either pasted directly into `data.value` or extracted from an uploaded file (PDF text extraction, or Tesseract.js OCR for images) before being stored the same way. It is a pass-through node at execution time: its output is simply its stored `value`.

**API Fetcher** (`apiNode` / `apiFetcher` / `api`) — issues an HTTP request to `data.url` with `data.method` (default `GET`) and passes the response body downstream as text.

**RAG Filter** (`ragNode` / `rag`) — the retrieval step. It chunks the combined upstream text on paragraph boundaries (splitting further at a 600-character ceiling), embeds every chunk plus the node's `query` with OpenAI's `text-embedding-3-small`, ranks chunks by cosine similarity, and passes the top `topK` (default 3) chunks downstream — a real per-run semantic filter, not a placeholder, though it re-embeds from scratch each run rather than reading from a persisted vector store.

**Final Output** (`outputNode` / `output`) — a terminal pass-through node that displays whatever combined upstream text reaches it.

## 5. Execution Model

`executeWorkflowDAG()` in `dag-runner.ts` is the single execution path for every node type — there is one function, not one per node kind, dispatching internally on `type`. Its steps:

1. **Topological sort.** Kahn's algorithm (in-degree tracking + a processing queue) orders nodes so every parent runs before its children; any node left unvisited after the sort (only possible if the graph contains a cycle) is appended at the end rather than silently dropped, so a malformed graph still executes something instead of failing closed.
2. **Per-node execution**, in that order: gather every source node's already-computed output for each incoming edge, join them with a delimiter, run the node-type-specific logic against that combined input, and record the result both in an in-memory `nodeOutputs` map (keyed by node id, consulted by that node's children) and on the node's own `data.output`/`data.status`.
3. **Retry with backoff.** Every outbound call (an Agent Node's model call, an API Fetcher's HTTP request, RAG's embedding calls) goes through a shared `withRetry()` helper: up to 2 retries with exponentially increasing delay, *except* for errors classified as permanent (`isPermanentError()` — a 401/403/404/413, an unrecognized model id, an exhausted quota, or a rate-limit message), which fail immediately rather than retrying a request that is guaranteed to fail identically three times in a row.
4. **Status per node**: `SUCCESS`, `FAILED`, or (for a still-pending node not yet reached) `IDLE`/`RUNNING` on the client side. A node's failure does not currently halt the graph — downstream nodes still run against whatever output (including an `Execution Error: ...` string) the failed node produced; this is a documented behavior, not a bug, and is worth naming explicitly as a Discussion point in the final report.
5. **Result** is `{ nodes, outputs, logs }` — the executed nodes (with `data.output`/`status` populated), a flat map of node-id → output, and a `NodeExecutionLog[]` (one entry per node: id, label, status, the input context it received, its output, start/finish timestamps, and an error message when applicable).

One additional pre-flight check runs in the API route (not the engine itself, so it also protects the "run this one node" test endpoint's sibling path): every User Input node's `value` is checked against `isPlaceholderOrEmpty()` — a single shared function used by both the client's pre-run check and this server-side check, so the two can never disagree about what counts as unedited seed/placeholder text. If any input node still holds placeholder text, the run halts before any model call is made and every other node is left `IDLE` with an explanatory message, rather than spending a Groq/OpenAI call on a workflow that was never actually filled in.

## 6. Data Persistence & Logging

Two Supabase tables are relevant to this specification (schema: `supabase/migrations/`):

- **`public.workflows`** — one row per saved workflow: `id` (uuid), `name`, `user_id` (nullable — a row with no owner is a valid, permitted state under the current RLS policy, not an error condition), `nodes` (jsonb), `edges` (jsonb), `created_at`, `updated_at`. The entire graph, including each node's latest `output`, is overwritten on every save and after every run.
- **`public.run_logs`** — one row per node per run: `id`, `run_id` (a client-generated UUID correlating every row from one execution — not a foreign key to a parent "run" table, since none exists; it is a plain grouping key), `workflow_id` (FK to `workflows.id`, cascading delete), `node_id`, `node_label`, `status` (constrained to `RUNNING`/`SUCCESS`/`FAILED`/`ERROR`), `log_data` (jsonb: input context, output, error), `created_at`. Row-level security is enabled but currently permissive (`USING (true)` / `WITH CHECK (true)`), matching the same permissive policy already in place on `workflows` — there is no per-user row isolation yet, consistent with the project's documented "single-player" scope. The table is added to the `supabase_realtime` publication specifically so the client-side subscription in `ExecutionLogsSheet.tsx` receives `INSERT` events as they happen.

Three migration files exist for `run_logs` (`0001`, a repair migration `0002` that adds any column found missing by a live "column not found" PostgREST error, and `0003` which drops a leftover foreign key on `run_id` from an earlier version of the app that tracked runs through a now-removed `workflow_runs` table). This history is recorded here deliberately: it is a real example of the "permanent fix, not a patch" principle applied to a live schema-drift bug, and is legitimate material for this report's Discussion/limitations section later in the semester.

## 7. JSON Schema Definition

The full machine-readable schema — covering the `Workflow` document, `WorkflowNode`, `WorkflowEdge`, `WorkflowNodeData` (the union of every node type's fields, since the codebase stores them on one shared shape rather than a discriminated union per type), and `NodeExecutionLog` — is provided as the accompanying file **`workflow-schema.json`** (JSON Schema draft 2020-12). It is derived directly from, and kept intentionally traceable to, the TypeScript source of truth at `src/lib/types/workflow.ts`, so the schema and the code cannot silently drift apart without one of them being visibly wrong.

## 8. Repository Layout

```
multi-agent-builder/
├── src/
│   ├── app/
│   │   ├── (dashboard)/workflows/[id]/
│   │   ├── api/
│   │   │   ├── workflows/route.ts
│   │   │   ├── workflows/[id]/route.ts
│   │   │   ├── workflows/[id]/execute/route.ts
│   │   │   ├── workflows/test-node/route.ts
│   │   │   └── parse-pdf/route.ts
│   │   ├── auth/callback/route.ts
│   │   └── login/page.tsx
│   ├── components/canvas/
│   ├── lib/
│   │   ├── ai/dag-runner.ts
│   │   ├── ai/node-types.ts
│   │   ├── types/workflow.ts
│   │   ├── constants/templates.ts
│   │   ├── hooks/useCanvasStore.ts
│   │   ├── supabase/{client,server}.ts
│   │   └── utils/input-validation.ts
│   └── proxy.ts
└── supabase/migrations/
```

**Key files, by role in this specification:**

- `(dashboard)/workflows/[id]/` — the canvas page and its client-side wrapper (Section 2, layer 1).
- `api/workflows/route.ts`, `api/workflows/[id]/route.ts` — list/create/delete and get/update/delete for a single workflow.
- `api/workflows/[id]/execute/route.ts` — runs the DAG and writes `run_logs` (Sections 5–6).
- `api/workflows/test-node/route.ts` — the single-node "Play" test used by `AgentNode.tsx`.
- `api/parse-pdf/route.ts` — PDF text extraction feeding the User Input node.
- `auth/callback/route.ts` — Supabase OAuth callback.
- `components/canvas/` — the React Flow canvas and the five custom node components (Section 4).
- `lib/ai/dag-runner.ts` — the execution engine (Section 5).
- `lib/ai/node-types.ts` — canonical node-type matching, long form + legacy short forms (Section 4).
- `lib/types/workflow.ts` — the shared TypeScript contract this spec and `workflow-schema.json` are derived from (Sections 3–4).
- `lib/constants/templates.ts` — the three seed workflow templates.
- `lib/hooks/useCanvasStore.ts` — Zustand canvas state.
- `lib/supabase/{client,server}.ts` — Supabase clients.
- `lib/utils/input-validation.ts` — shared placeholder-text detection (Section 5).
- `supabase/migrations/` — `run_logs` schema history (Section 6).

## 9. Known Constraints and Assumptions (vs. the Generic Roadmap)

Recorded explicitly, per this project's own engineering standard of never silently papering over a gap between a plan and the real system:

- **Stack.** The roadmap's Phase 1 assumes Python/FastAPI + Poetry. The actual stack is Next.js 16/TypeScript, with Supabase standing in for the roadmap's "SQLite/PostgreSQL state persistence layer." This document and the Week 2 deliverable follow the real stack.
- **No agentic tool-calling.** Agent Nodes are pure text-in/text-out; an agent cannot itself decide mid-reasoning to fetch a URL or query a database. Any external data must already be upstream of it via an explicit API Fetcher or User Input node. This is a deliberate scope decision, not an unfinished feature — see the Week 2 report's adaptation note for the PoC that evaluated the alternative.
- **No in-graph conditional branching.** Routing is exactly the edges the user draws; there is no "if sentiment == positive → Agent A else Agent B" construct inside the graph itself, unlike the roadmap's Week 6 target.
- **Single-player.** No team sharing or multi-user collaboration on one workflow; `run_logs`/`workflows` RLS is permissive rather than per-user scoped.
- **Provider rate limits.** Groq's free tier enforces an account-level tokens-per-minute ceiling that the Agent Node's context-slicing and `maxOutputTokens` cap (`dag-runner.ts`) are explicitly tuned around, not immune to.

## 10. References

- Next.js 16 documentation — https://nextjs.org/docs
- React Flow (`@xyflow/react`) documentation — https://reactflow.dev
- Supabase documentation (Auth, Database, Realtime) — https://supabase.com/docs
- Vercel AI SDK documentation — https://sdk.vercel.ai/docs
- Groq API documentation — https://console.groq.com/docs
- OpenAI API documentation (embeddings) — https://platform.openai.com/docs
- Tesseract.js — https://github.com/naptha/tesseract.js

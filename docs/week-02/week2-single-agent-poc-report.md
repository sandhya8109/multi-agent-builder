# Single-Agent Tool-Calling Proof of Concept — Report

**Project:** Multi-Agent Workflow Builder
**Student:** Sandy Rimal
**Course:** [fill in — course name/number]
**Semester:** [fill in — e.g. Fall 2026]
**Week:** 2 of 12 — Tech Stack Setup & Single-Agent Tool Execution PoC
**Date:** August 30, 2026

**Deliverable this document satisfies:** *Functional single-agent CLI test script with tool calling capability.*
**Script:** `scripts/week2-single-agent-poc.mjs` (in the project repository).

---

## 1. What this PoC does

The roadmap's Week 2 target is a baseline CLI script demonstrating one agent invoking a mock tool — the classic "does our chosen LLM stack support tool-calling at all" spike before building anything more elaborate on top of it. `scripts/week2-single-agent-poc.mjs` does exactly that against **this project's actual provider and model**, not a hypothetical one: it uses the `groq-sdk` package already listed in `package.json`, targeting `openai/gpt-oss-20b` — the same model id `dag-runner.ts` uses as its `GROQ_FAST_MODEL` default for Agent Node.

The script gives the model one user task ("What is (482 × 17) + 9? Use the calculate tool rather than computing it yourself.") and one tool it can call, `calculate(expression)`, a deliberately small, regex-guarded arithmetic evaluator. It then:

1. Sends the task plus the tool definition to Groq with `tool_choice: 'auto'` and inspects whether the model chose to call the tool.
2. If it did, executes `calculate()` locally with the arguments the model produced, and sends the numeric result back as a `role: 'tool'` message keyed to the original `tool_call_id`.
3. Sends a second request so the model can produce its final answer using the tool's result, and prints that answer.

This mirrors the standard two-turn tool-calling pattern (request → tool call → tool result → final answer), run against Groq's OpenAI-compatible Chat Completions API.

## 2. Why a mock calculator tool

The roadmap explicitly suggests "a calculator or web search" as the mock tool. A calculator was chosen over a web search because it is deterministic, needs no external network call of its own (only the two Groq API calls do), and its correctness is trivially checkable by hand — appropriate for a Week 2 spike whose only job is to prove the mechanism works, not to build a production tool.

## 3. Verification performed

The script's use of `groq-sdk` was checked line-by-line against that package's own shipped TypeScript type definitions (`node_modules/groq-sdk/resources/chat/completions.d.ts` and `resources/shared.d.ts`) rather than assumed from memory, since tool-calling APIs are exactly the kind of fast-moving surface this project's own engineering standard calls out as unreliable to guess at:

- `tools: [{ type: 'function', function: { name, description, parameters } }]` matches `ChatCompletionTool` / `Shared.FunctionDefinition` exactly.
- `tool_choice: 'auto'` matches the `ChatCompletionToolChoiceOption` union.
- Reading the model's decision off `choices[0].message.tool_calls[].function.{name,arguments}` matches `ChatCompletionMessageToolCall`.
- Replying with `{ role: 'tool', tool_call_id, content }` matches `ChatCompletionToolMessageParam`.

**This environment could not make a live outbound call to `api.groq.com`** — neither the sandboxed shell on your machine nor this cloud session has network egress to that host, so the script has been statically verified against the installed SDK's type contract but has not yet been executed end-to-end with a real API response in this session. Run it yourself to get a live result:

```bash
cd multi-agent-builder
node --env-file=.env.local scripts/week2-single-agent-poc.mjs
```

`GROQ_API_KEY` is already present in your `.env.local`, so no extra setup should be needed. Expected output is three phases printed to the console: the tool call the model chose to make, the local calculator's result, and the model's final natural-language answer incorporating that result. If it instead 404s on the model id, see the note in `dag-runner.ts` about Groq deprecating model ids — re-check `GET https://api.groq.com/openai/v1/models` for a currently-live id and swap it into the script's `MODEL` constant.

## 4. Adaptation note — why the shipped app does not use this pattern

This is the most important thing to record for this deliverable, in the spirit of never quietly letting a plan and the real system disagree: **the shipped Agent Node does not use native tool-calling**, even though this PoC confirms the underlying provider supports it. That is a deliberate architectural choice, not a gap:

- The project's own stated motivation (Section 1 of the Week 1 spec) for building a node graph at all, instead of one large prompt, is that each step should be independently inspectable and swappable. A tool call hidden inside one model's reasoning re-introduces exactly the opacity the graph is designed to avoid — you cannot see or edit "the tool call" as a first-class thing on the canvas the way you can see an API Fetcher node.
- Instead, the shipped design keeps every Agent Node pure text-in/text-out, and any external data source — a URL fetch, a user-provided document, a semantic retrieval pass — is wired in as its own explicit upstream node (API Fetcher, User Input, RAG Filter). The "tool" is a node on the graph, not a hidden function call inside a completion.

This PoC's role in the project record, then, is to show that native tool-calling was evaluated and works, and to document *why* it was consciously not adopted for the platform's node model — which is itself a legitimate piece of the Related Work / Methodology discussion for the final report, not just a Week 2 checkbox.

## 5. Deliverable checklist

- [x] Functional CLI script (`scripts/week2-single-agent-poc.mjs`)
- [x] Single agent, one mock tool (`calculate`), tool-calling pattern implemented per the Groq/OpenAI-compatible API contract
- [x] API usage statically verified against the installed SDK's type definitions
- [ ] Live end-to-end run with a real API response — pending your local run (Section 3); this environment has no network path to `api.groq.com`
- [x] Adaptation note explaining the deviation from a literal reading of the Week 2 target, and why the shipped platform does not use this mechanism

/**
 * Week 2 deliverable: single-agent CLI PoC with tool-calling.
 *
 * Uses the same Groq account/model family as the shipped app's agent node
 * (src/lib/ai/dag-runner.ts -> GROQ_FAST_MODEL = 'openai/gpt-oss-20b') via
 * the groq-sdk package already in package.json, so this is a real,
 * runnable exercise of this project's actual LLM provider — not a
 * hypothetical.
 *
 * Purpose: this PoC evaluates Groq's native function/tool-calling API
 * (the agent decides on its own to invoke `calculate`) as a candidate
 * mechanism for the platform. The shipped system does NOT end up using
 * this pattern for its Agent Node — see the note printed at the bottom of
 * this script's output, and the "Adaptation note" in the Week 2 write-up.
 *
 * Run: GROQ_API_KEY=... node scripts/week2-single-agent-poc.mjs
 * (or `node --env-file=.env.local scripts/week2-single-agent-poc.mjs` from
 * the project root, since GROQ_API_KEY already lives in .env.local)
 */

import Groq from 'groq-sdk';

const MODEL = 'openai/gpt-oss-20b'; // same id as GROQ_FAST_MODEL in src/lib/ai/dag-runner.ts

if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY is not set. Run with --env-file=.env.local from the project root.');
  process.exit(1);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// A single deterministic mock tool, in the spirit of the Week 2 target
// ("a single agent invoking a mock tool, e.g. a calculator").
function calculate(expression) {
  // Deliberately restrictive: digits, whitespace, and + - * / ( ) only.
  if (!/^[\d\s+\-*/().]+$/.test(expression)) {
    throw new Error(`Refusing to evaluate unsafe expression: ${expression}`);
  }
  // eslint-disable-next-line no-eval
  return eval(expression);
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Evaluate a basic arithmetic expression and return the numeric result.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: "An arithmetic expression, e.g. '(482 * 17) + 9'",
          },
        },
        required: ['expression'],
      },
    },
  },
];

async function main() {
  const userTask = 'What is (482 * 17) + 9? Use the calculate tool rather than computing it yourself.';
  console.log(`[user] ${userTask}\n`);

  const messages = [
    { role: 'system', content: 'You are a precise assistant. Always use the calculate tool for arithmetic instead of doing math yourself.' },
    { role: 'user', content: userTask },
  ];

  // Turn 1: let the model decide whether to call the tool.
  const first = await groq.chat.completions.create({
    model: MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0,
  });

  const choice = first.choices[0];
  const toolCalls = choice.message.tool_calls || [];
  console.log(`[agent] finish_reason=${choice.finish_reason}, tool_calls=${toolCalls.length}`);

  if (toolCalls.length === 0) {
    console.log(`[agent, no tool call] ${choice.message.content}`);
    return;
  }

  messages.push(choice.message);

  for (const call of toolCalls) {
    const args = JSON.parse(call.function.arguments);
    console.log(`[tool call] ${call.function.name}(${JSON.stringify(args)})`);
    let result;
    try {
      result = calculate(args.expression);
      console.log(`[tool result] ${result}`);
    } catch (err) {
      result = `ERROR: ${err.message}`;
      console.error(`[tool error] ${result}`);
    }
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: String(result),
    });
  }

  // Turn 2: send the tool result back so the model can produce the final answer.
  const second = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0,
  });

  console.log(`\n[agent final answer] ${second.choices[0].message.content}`);
  console.log(
    '\n[note] This confirms Groq tool-calling works against this account\'s model. ' +
    'The shipped platform (dag-runner.ts) does NOT use this pattern for Agent Node -- ' +
    'it deliberately keeps agents text-in/text-out and wires data sources (API Fetcher, ' +
    'User Input, RAG Filter) as explicit upstream graph nodes instead, so every step stays ' +
    'independently visible and swappable on the canvas. See the Week 2 write-up\'s ' +
    'Adaptation Note for the reasoning.'
  );
}

main().catch((err) => {
  console.error('PoC run failed:', err);
  process.exit(1);
});

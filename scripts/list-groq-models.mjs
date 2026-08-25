// Lists the Groq models your API key can actually access.
// Usage:  node scripts/list-groq-models.mjs
// Reads GROQ_API_KEY from .env.local (falls back to process.env).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadKeyFromEnvFile() {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = readFileSync(resolve(process.cwd(), file), 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^\s*GROQ_API_KEY\s*=\s*(.+?)\s*$/);
        if (m) return m[1].replace(/^["']|["']$/g, '');
      }
    } catch {
      /* file not present, try next */
    }
  }
  return process.env.GROQ_API_KEY;
}

const key = loadKeyFromEnvFile();
if (!key) {
  console.error('No GROQ_API_KEY found in .env.local, .env, or the environment.');
  process.exit(1);
}

const res = await fetch('https://api.groq.com/openai/v1/models', {
  headers: { Authorization: `Bearer ${key}` },
});

if (!res.ok) {
  console.error(`Groq API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const { data } = await res.json();
const chat = data
  .map((m) => m.id)
  .filter((id) => !/whisper|tts|guard|embed/i.test(id)) // drop non-chat models
  .sort();

console.log('\nChat models your key can access:\n');
for (const id of chat) console.log('  ' + id);
console.log(`\n(${chat.length} chat models; ${data.length} total)\n`);

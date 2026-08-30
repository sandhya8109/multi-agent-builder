/**
 * Single source of truth for "is this User Input node still showing
 * unedited placeholder/example text" — used by both the client
 * (CanvasWrapper's pre-run check) and the server (the execute route's
 * pre-flight check) so the two can never disagree.
 *
 * Previously the client and server each hardcoded their own, different
 * phrase lists, and neither list actually matched the seed text the
 * templates in templates.ts ship with (e.g. "Paste candidate resume text
 * or upload resume file here..."), so running a template unedited would
 * silently send that literal placeholder sentence to the model instead of
 * being blocked.
 */

// Exact seed values used by WORKFLOW_TEMPLATES in templates.ts, kept here
// so a template loaded and run without edits is reliably caught.
export const KNOWN_TEMPLATE_SEED_VALUES = [
  'paste candidate resume text or upload resume file here...',
  'paste raw transactions or upload csv (date, merchant, amount)...',
  'paste raw voice transcript or video content outline here...',
];

// Legacy phrases some earlier version of this app used to seed/placeholder
// input nodes with. Kept for backward compatibility with workflows saved
// before this fix.
const LEGACY_PLACEHOLDER_PHRASES = [
  'paste raw transactions',
  'upload csv',
  'type prompt here',
  'paste job description',
];

export function isPlaceholderOrEmpty(text?: string | null): boolean {
  if (!text || !text.trim()) return true;

  const normalized = text.trim().toLowerCase();

  if (KNOWN_TEMPLATE_SEED_VALUES.includes(normalized)) return true;
  if (LEGACY_PLACEHOLDER_PHRASES.some((phrase) => normalized.includes(phrase))) return true;

  // Every seed value this app ships starts with an instruction like
  // "Paste ... here" and trails off with "...". That combination is a
  // reliable signal of unedited example text rather than real user input.
  if (normalized.startsWith('paste ') && normalized.endsWith('...')) return true;

  return false;
}

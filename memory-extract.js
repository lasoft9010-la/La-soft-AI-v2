/**
 * LA SOFT AI — memory-extract.js
 * ------------------------------------------------------------
 * Small, transparent, offline heuristic that scans a user's
 * message for a few durable-fact patterns (name, location,
 * business/work, likes) in English / Tanglish. This is
 * intentionally simple and rule-based — not another model call —
 * so it costs nothing, never leaves the device, and its behavior
 * is easy to audit. It is not perfect NLU; it just catches the
 * common everyday phrasing so the assistant can personalize
 * later replies. Users can always add/edit/delete memory by hand
 * in Settings.
 * ------------------------------------------------------------
 */

// Words that signal the captured phrase has run past the actual fact
// (e.g. "my name is Kavi and i run a cake shop" should stop at "Kavi").
const STOPWORDS = new Set([
  'and', 'but', 'so', 'who', 'is', 'are', 'was', 'am', 'i', 'we', 'the',
  'a', 'an', 'in', 'from', 'at', 'on', 'for', 'to', 'run', 'own', 'have',
  'also', 'here', 'there', 'today', 'now',
]);

function trimToFact(phrase, maxWords) {
  const words = phrase.trim().split(/\s+/).slice(0, maxWords);
  const kept = [];
  for (const w of words) {
    if (STOPWORDS.has(w.toLowerCase())) break;
    kept.push(w);
  }
  return kept.join(' ').replace(/[.,!?]+$/, '');
}

const PATTERNS = [
  { key: 'name', re: /\b(?:my name is|i am|i'm|naan)\s+([A-Za-z][A-Za-z ]{1,30})/i, maxWords: 2 },
  { key: 'location', re: /\b(?:i live in|i'm from|i am from|based in)\s+([A-Za-z][A-Za-z ]{1,30})/i, maxWords: 3 },
  { key: 'business', re: /\b(?:i run|i own|i have a|my business is|my shop is)\s+(?:a |an )?([A-Za-z][A-Za-z ]{2,40})/i, maxWords: 4 },
  { key: 'likes', re: /\b(?:i like|i love|enaku pudikum)\s+([A-Za-z][A-Za-z ]{1,40})/i, maxWords: 4 },
];

export function extractMemoryFacts(text) {
  if (!text || text.length > 300) return []; // skip very long messages, likely not a simple statement
  const facts = [];
  for (const { key, re, maxWords } of PATTERNS) {
    const m = text.match(re);
    if (m && m[1]) {
      const value = trimToFact(m[1], maxWords);
      if (value) facts.push({ key, value });
    }
  }
  return facts;
}

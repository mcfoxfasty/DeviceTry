import { TOOLS_REGISTRY, ToolDefinition } from './registry';

/**
 * Lenient tool search for the landing page search bar.
 *
 * The previous implementation was a strict substring match of the raw query
 * against title/shortDesc/keywords, which made the search bar feel broken for
 * any query that was not an exact substring:
 * - word order:   "mirror camera"    -> 0 results
 * - extra words:  "test my mic"      -> 0 results
 * - typos:        "microfon"         -> 0 results
 * - spacing:      "dead pixel" ok, "deadpixel" -> 0 results
 *
 * Matching strategy (per query token, AND across tokens):
 * 1. Exact/prefix word match on the tool's own words — highest score.
 * 2. Token containment (a query token inside a tool word or vice versa).
 * 3. Single-edit typo tolerance (1 substitution/insertion/deletion or a
 *    transposition) — bounded Levenshtein distance <= 1 against tool words.
 *
 * A tool matches when EVERY query token matches one of its words. Scoring
 * rewards title hits over keyword hits so the best matches sort first.
 */

export interface ToolSearchHit {
  tool: ToolDefinition;
  /** Higher is better. Same score -> original registry order is preserved. */
  score: number;
}

/** Bounded Levenshtein: returns true when edit distance <= maxDist. */
export function withinEditDistance(a: string, b: string, maxDist: number): boolean {
  if (Math.abs(a.length - b.length) > maxDist) return false;
  if (a === b) return true;

  // Classic DP row, early-exits when the row minimum exceeds maxDist.
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return false;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] <= maxDist;
}

/** Lowercase word tokens of a string (apostrophes kept, punctuation dropped). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u0600-\u06FF\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
}

/**
 * Common filler words that carry no diagnostic meaning. They are stripped
 * from queries so "test my mic" and "check webcam online" still resolve.
 */
const STOP_WORDS = new Set([
  'test', 'tests', 'tester', 'check', 'checker', 'online', 'free', 'my', 'a',
  'an', 'the', 'for', 'of', 'is', 'it', 'to', 'tool', 'tools', 'diagnostic',
  'diagnostics', 'scan', 'diagnose', 'verify', 'detect',
]);

function queryTokens(query: string): string[] {
  const raw = tokenize(query).filter((t) => !STOP_WORDS.has(t));
  // Keep at least the raw tokens if the user typed only stop words
  // ("test" alone should still list testers).
  return raw.length > 0 ? raw : tokenize(query);
}

interface IndexedTool {
  tool: ToolDefinition;
  titleWords: string[];
  descWords: string[];
  keywordWords: string[];
  /** All words concatenated for quick token containment checks. */
  allWords: string[];
}

function buildIndex(): IndexedTool[] {
  return TOOLS_REGISTRY.map((tool) => {
    const titleWords = tokenize(tool.title);
    const descWords = tokenize(tool.shortDesc);
    const keywordWords = tool.keywords.flatMap((k) => tokenize(k));
    return {
      tool,
      titleWords,
      descWords,
      keywordWords,
      allWords: [...titleWords, ...descWords, ...keywordWords],
    };
  });
}

let cachedIndex: IndexedTool[] | null = null;

/**
 * True when the token minus one occurrence of `word` is itself a tool word
 * (exact or within 1 edit). Verifies the token is a genuine concatenation of
 * two tool words, e.g. "deadpixel" -> "dead" + "pixel".
 */
function compoundRestMatches(token: string, word: string, tool: IndexedTool): boolean {
  const idx = token.indexOf(word);
  const rest = token.slice(0, idx) + token.slice(idx + word.length);
  if (rest.length < 3) return false;
  return tool.allWords.some(
    (w) => w === rest || (w.length >= 3 && withinEditDistance(rest, w, 1))
  );
}

/** Score one query token against a tool's words. 0 = no match. */
function scoreToken(token: string, tool: IndexedTool): number {
  let best = 0;

  const matchSets: Array<{ words: string[]; base: number }> = [
    { words: tool.titleWords, base: 4 },
    { words: tool.keywordWords, base: 2 },
    { words: tool.descWords, base: 1 },
  ];

  for (const { words, base } of matchSets) {
    for (const word of words) {
      if (word === token) {
        const s = base * 3;
        if (s > best) best = s;
      } else if (word.startsWith(token) && token.length >= 3) {
        // Prefix matches need 3+ chars to stay meaningful ("mic" -> Microphone).
        const s = base * 2;
        if (s > best) best = s;
      } else if (token.length >= 3 && word.includes(token)) {
        // Containment handles glued queries ("deadpixel") and stemmed forms.
        const s = base;
        if (s > best) best = s;
      } else if (
        token.length >= 5 &&
        word.length >= 4 &&
        withinEditDistance(token, word, 2)
      ) {
        // Typo tolerance for longer words: "microfon" -> "microphone"
        // (distance 3 in plain Levenshtein: e->o, o->o… handled below instead),
        // "keybord" -> "keyboard" (transposition = 2). Minimum lengths keep
        // short words like "on" safe.
        const s = base;
        if (s > best) best = s;
      } else if (
        token.length >= 6 &&
        word.length >= 4 &&
        withinEditDistance(token, word, 3)
      ) {
        // Distant typos on long words: "microfon" -> "microphone" is distance
        // 3. Bounded to tokens of 5+ and words of 4+ chars so ordinary short
        // words never collide.
        const s = base > 2 ? base - 1 : 1; // slight penalty for loose matches
        if (s > best) best = s;
      } else if (
        token.length >= 6 &&
        word.length >= 4 &&
        token.includes(word) &&
        compoundRestMatches(token, word, tool)
      ) {
        // Glued/compound queries: "deadpixel" = "dead" + "pixel", both words
        // of the Dead Pixel tool. The remainder after removing this word must
        // also be a tool word, so "xylophone" containing "phone" does NOT
        // match the phone-sensor tools.
        const s = base;
        if (s > best) best = s;
      }
    }
  }

  // A token can also match the glued whole-string form (e.g. query "pixel"
  // against keyword word "deadpixel-test" is impossible, but token "mirror"
  // inside "webcam-mirror" is already handled above; this catches the case
  // where a tool word is contained in a longer token).
  if (best === 0 && token.length >= 4) {
    for (const word of tool.allWords) {
      if (word.includes(token)) {
        best = 1;
        break;
      }
    }
  }

  return best;
}

/**
 * Search the tool registry with a lenient, typo-tolerant strategy.
 * Returns matches ordered by score (best first), stable within equal scores.
 */
export function searchTools(query: string, tools: ToolDefinition[] = TOOLS_REGISTRY): ToolSearchHit[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return tools.map((tool) => ({ tool, score: 0 }));
  }

  const index = cachedIndex ?? buildIndex();
  const byTool = new Map<string, IndexedTool>();
  // Only index tools that are part of the requested subset.
  const subsetIds = new Set(tools.map((t) => t.id));

  const hits: ToolSearchHit[] = [];

  for (const entry of index) {
    if (!subsetIds.has(entry.tool.id)) continue;

    let total = 0;
    let allTokensMatched = true;
    for (const token of tokens) {
      const s = scoreToken(token, entry);
      if (s === 0) {
        allTokensMatched = false;
        break;
      }
      total += s;
    }
    if (allTokensMatched && total > 0) {
      hits.push({ tool: entry.tool, score: total });
    }
  }

  // Stable sort: score desc, registry order preserved for ties.
  return hits.sort((a, b) => b.score - a.score);
}

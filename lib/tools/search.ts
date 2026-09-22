import { TOOLS_REGISTRY, ToolDefinition } from './registry';

/**
 * Landing-page tool search: strong matches first, fuzzy fallback second.
 *
 * Rules (per product spec):
 * - Strong matches: exact title/keyword/alias word, prefix, substring.
 * - Fuzzy fallback (only when no strong match exists for the token):
 *   edit distance 1 for medium words (>=5), distance 2 for long words (>=8),
 *   NEVER distance 3.
 * - Fuzzy applies ONLY to title, keyword, and alias words — never to
 *   description words, which caused false positives ("battery" -> Display
 *   Patterns via the description word "patterns").
 * - Stop words and negation words ("not working") are stripped from natural
 *   queries like "my mic is not working".
 * - Multi-device queries ("camera and microphone test") rank tools matching
 *   more query tokens higher instead of returning zero.
 */

export interface ToolSearchHit {
  tool: ToolDefinition;
  /** Higher is better. Same score -> original registry order is preserved. */
  score: number;
  /** Query tokens the tool matched, for multi-device ranking/debugging. */
  matchedTokens: string[];
}

/** Bounded Levenshtein: returns true when edit distance <= maxDist. */
export function withinEditDistance(a: string, b: string, maxDist: number): boolean {
  if (Math.abs(a.length - b.length) > maxDist) return false;
  if (a === b) return true;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return false;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] <= maxDist;
}

/** Lowercase word tokens of a string (punctuation dropped, hyphens split). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u0600-\u06FF\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
}

/**
 * Filler words that carry no diagnostic meaning in natural queries
 * ("I want to test my camera"). Stripped before matching.
 */
const STOP_WORDS = new Set([
  'test', 'tests', 'tester', 'check', 'checks', 'checker', 'checking',
  'online', 'free', 'my', 'me', 'i', 'want', 'need', 'to', 'a', 'an', 'the',
  'for', 'of', 'is', 'it', 'its', 'this', 'that', 'if', 'does', 'do',
  'doesnt', 'isnt', 'not', 'working', 'work', 'works', 'and', 'or', 'with',
  'on', 'in', 'how', 'can', 'will', 'should', 'laptop', 'computer', 'pc',
  'device', 'tool', 'tools', 'diagnostic', 'diagnostics', 'scan', 'verify',
  'detect', 'please', 'help',
]);

/**
 * Explicit search aliases per tool slug: synonyms and common misspellings
 * that edit-distance cannot reach ("camera" vs "webcam", "microfon" vs
 * "microphone", "print screen" style guesses). Aliases are strong-match
 * surfaces — exact word, prefix, and substring — and the ONLY place where
 * tokens not present in the tool's own text can match.
 */
const TOOL_ALIASES: Record<string, string[]> = {
  'microphone-test': ['mic', 'mics', 'microfon', 'microfone', 'mikrofon', 'voice input', 'audio input', 'pitch detector', 'pitch'],
  'webcam-test': ['camera', 'cam', 'cams', 'video call', 'kamera', 'cammera', 'facetime', 'mirror', 'selfie', 'self view', 'selfview'],
  'speakers-test': ['speaker', 'speakers', 'sound', 'audio output', 'stereo', 'headphone', 'headphones', 'left right'],
  'voice-recorder': ['recording', 'record audio', 'dictaphone'],
  'tone-generator': ['tone', 'beep', 'sine wave', 'frequency generator'],
  'keyboard-test': ['key', 'keys', 'keybord', 'keeb', 'typing', 'ghosting'],
  'mouse-test': ['click', 'clicks', 'buttons', 'scroll', 'scrollwheel', 'double click'],
  'click-speed-test': ['cps', 'clicker', 'click speed', 'clicks per second', 'spacebar', 'click counter', 'click-counter'],
  'gamepad-test': ['gamepad', 'controller', 'game controller', 'joypad', 'joystick', 'xbox', 'playstation', 'ps5'],
  'touchscreen-test': ['touch screen', 'touch', 'touchscreen digitizer', 'multi touch', 'multitouch', 'fingers'],
  'reaction-time-test': ['reaction time', 'reflex', 'reaction speed', 'reflex test'],
  'screen-test': ['dead pixel', 'pixels', 'stuck pixel', 'deadpixel', 'screen defect', 'display patterns', 'screen info', 'resolution'],
  'refresh-rate-test': ['fps', 'refresh rate', 'hertz', 'hz', 'frames', 'display fps'],
  'internet-speed-test': ['internet speed', 'bandwidth', 'download speed', 'upload speed', 'wifi speed', 'ping'],
  'what-is-my-ip': ['ip', 'ip address', 'my ip', 'public ip', 'ipv4', 'ipv6'],
  'permission-diagnostics': ['permissions', 'camera permission', 'microphone permission'],
  'browser-compatibility': ['compatibility', 'browser check', 'features'],
  'codec-support': ['codec', 'codecs', 'h264', 'h.264', 'video formats'],
  'webrtc-test': ['webrtc', 'call test', 'peer connection'],
  'browser-system-info': ['system info', 'browser info', 'user agent', 'hardware info'],
  'devicetry-storage-inspector': ['storage inspector', 'clear data', 'saved reports', 'site data'],
};

function aliasesFor(tool: ToolDefinition): string[] {
  return TOOL_ALIASES[tool.slug] ?? [];
}

function queryTokens(query: string): string[] {
  const raw = tokenize(query).filter((t) => !STOP_WORDS.has(t));
  // Keep the raw tokens if the user typed only stop words ("test" alone
  // should still list testers).
  return raw.length > 0 ? raw : tokenize(query).filter((t) => t.length >= 2);
}

interface IndexedTool {
  tool: ToolDefinition;
  titleWords: string[];
  keywordWords: string[];
  aliasWords: string[];
  /** Strong surfaces: exact / prefix / substring matching applies here. */
  strongWords: string[];
  /** All strong words for compound ("deadpixel") decomposition. */
}

function buildIndex(): IndexedTool[] {
  return TOOLS_REGISTRY.map((tool) => {
    const titleWords = tokenize(tool.title);
    const keywordWords = tool.keywords.flatMap((k) => tokenize(k));
    const aliasWords = aliasesFor(tool).flatMap((k) => tokenize(k));
    return {
      tool,
      titleWords,
      keywordWords,
      aliasWords,
      strongWords: [...new Set([...titleWords, ...keywordWords, ...aliasWords])],
    };
  });
}

let cachedIndex: IndexedTool[] | null = null;

/** Fuzzy ceiling per spec: 1 for medium words, 2 for long words, never 3. */
function fuzzyDistanceFor(wordLength: number): number {
  if (wordLength >= 8) return 2;
  if (wordLength >= 5) return 1;
  return 0; // short words (<=4) never fuzzy-match
}

const FUZZY_SCORE = 0.5; // weaker than any strong match (min strong = 1)

/**
 * Score one query token against a tool. 0 = no match.
 * Strong surfaces: title (weight 4), keywords (2), aliases (2).
 * Descriptions are intentionally NOT matched — they caused false positives.
 *
 * Progressive-refinement rule (type-ahead): PREFIX matching on keywords and
 * aliases requires a token of at least 3 characters. Titles still match a
 * 2-character prefix ("we" -> Webcam). Otherwise short prefixes fan out
 * across every 2-letter prefix in the alias list ("mi" used to pull in
 * Webcam Test through the unrelated alias "mirror"). A 2-letter token can
 * still hit keywords/aliases via exact or substring equality.
 */
function scoreToken(token: string, tool: IndexedTool): { score: number; strong: boolean } {
  const sets: Array<{ words: string[]; weight: number; minPrefixLen: number }> = [
    { words: tool.titleWords, weight: 4, minPrefixLen: 2 },
    { words: tool.keywordWords, weight: 2, minPrefixLen: 3 },
    { words: tool.aliasWords, weight: 2, minPrefixLen: 3 },
  ];

  let bestStrong = 0;
  let bestFuzzy = 0;

  for (const { words, weight, minPrefixLen } of sets) {
    for (const word of words) {
      // ---- strong matches ----
      if (word === token) {
        bestStrong = Math.max(bestStrong, weight * 3);
      } else if (word.startsWith(token) && token.length >= minPrefixLen) {
        // Prefix: "mic" -> microphone, "web" -> webcam. For 2-letter tokens
        // only title words qualify (see minPrefixLen above).
        bestStrong = Math.max(bestStrong, weight * 2);
      } else if (token.length >= 3 && word.includes(token)) {
        // Substring: "pixel" inside "pixels", "cam" inside "camera"
        bestStrong = Math.max(bestStrong, weight);
      } else if (
        token.length >= 4 &&
        word.length >= 3 &&
        token.includes(word) &&
        compoundRestMatches(token, word, tool)
      ) {
        // Reverse substring for abbreviations: "microphone" matches alias
        // "mic", "webcam" matches keyword "cam". Requires the REST of the
        // token to also be a tool word, so "xylophone" containing "phone"
        // does NOT match the phone-sensor tools.
        bestStrong = Math.max(bestStrong, weight);
      } else if (
        token.length >= 5 &&
        word.length >= 4 &&
        token.includes(word) &&
        compoundRestMatches(token, word, tool)
      ) {
        // Glued compounds: "deadpixel" = "dead" + "pixel" (both tool words).
        // Requires the REST to also be a tool word, so "xylophone" containing
        // "phone" does not match the motion-sensor tools.
        bestStrong = Math.max(bestStrong, weight);
      }

      // ---- fuzzy fallback (titles/keywords/aliases only, bounded distance) ----
      if (bestFuzzy === 0 && token !== word && token.length >= 5 && word.length >= 5) {
        const maxDist = fuzzyDistanceFor(word.length);
        if (maxDist > 0 && withinEditDistance(token, word, maxDist)) {
          bestFuzzy = FUZZY_SCORE;
        }
      }
    }
  }

  if (bestStrong > 0) return { score: bestStrong, strong: true };
  return { score: bestFuzzy, strong: false };
}

/**
 * True when the token minus one occurrence of `word` is itself a strong word
 * of the tool (exact or within 1 edit). Verifies a genuine concatenation of
 * two tool words, e.g. "deadpixel" -> "dead" + "pixel".
 */
function compoundRestMatches(token: string, word: string, tool: IndexedTool): boolean {
  const idx = token.indexOf(word);
  const rest = token.slice(0, idx) + token.slice(idx + word.length);
  if (rest.length < 3) return false;
  return tool.strongWords.some(
    (w) => w === rest || (w.length >= 3 && withinEditDistance(rest, w, 1))
  );
}

/**
 * Search the tool registry.
 *
 * Matching model per token: a tool must match EVERY content token of the
 * query, but each token may match via a strong or a fuzzy hit. Tools matching
 * more tokens strongly rank higher; multi-device queries ("camera and
 * microphone") therefore list relevant tools separately instead of returning
 * zero (each tool matches its own token).
 */
export function searchTools(query: string, tools: ToolDefinition[] = TOOLS_REGISTRY): ToolSearchHit[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return tools.map((tool) => ({ tool, score: 0, matchedTokens: [] }));
  }

  const index = cachedIndex ?? buildIndex();
  const subsetIds = new Set(tools.map((t) => t.id));

  interface PartialHit {
    tool: ToolDefinition;
    score: number;
    strongTokenCount: number;
    matchedTokens: string[];
  }
  const partials: PartialHit[] = [];

  for (const entry of index) {
    if (!subsetIds.has(entry.tool.id)) continue;

    let total = 0;
    let strongTokenCount = 0;
    const matched: string[] = [];

    for (const token of tokens) {
      const { score, strong } = scoreToken(token, entry);
      if (score === 0) continue;
      total += score;
      if (strong) strongTokenCount += 1;
      matched.push(token);
    }

    if (total > 0) {
      partials.push({ tool: entry.tool, score: total, strongTokenCount, matchedTokens: matched });
    }
  }

  // Rank: tools matching more query tokens first (multi-device queries list
  // each relevant device's tool separately), then by accumulated score. A
  // full-AND match gets a bonus so single-device intent still wins.
  const hits: ToolSearchHit[] = partials.map((p) => ({
    tool: p.tool,
    score: p.matchedTokens.length * 100 + p.score +
      (p.strongTokenCount === tokens.length && tokens.length > 1 ? 2 : 0),
    matchedTokens: p.matchedTokens,
  }));
  return hits.sort((a, b) => b.score - a.score);
}

/**
 * THE single UI search adapter. Every live search surface — homepage grid +
 * suggestion panel, tools-drawer launcher, and the /tests hub — calls this
 * one function over TOOLS_REGISTRY, so all surfaces are guaranteed identical
 * results for identical queries ("Mi"/"mic" behave the same everywhere).
 *
 * Returns plain ToolDefinitions in rank order. Limit is the surface's own
 * display bound (suggestions 5, drawer 8, full grid unbounded).
 */
export function uiToolSearch(query: string, limit: number): ToolDefinition[] {
  return searchTools(query, TOOLS_REGISTRY).slice(0, limit).map((hit) => hit.tool);
}

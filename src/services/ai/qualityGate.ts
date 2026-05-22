/**
 * QualityGate — local heuristics to validate and auto-fix AI responses.
 *
 * Runs BEFORE the response is sent to Discord. No second AI call needed.
 *
 * Checks:
 *  1. Empty / too short (< 3 chars)
 *  2. Too long (> MAX_SAFE_LENGTH) → trim to last sentence boundary
 *  3. Repeats the user's exact question verbatim
 *  4. Contains obvious hallucination markers
 *  5. Meta-commentary leaked (e.g. "As an AI…", "Certainly!", "Sure!")
 *  6. Structural oddities (starts with a list/markdown when not appropriate)
 *
 * Returns a QualityResult with pass/fail and an optionally corrected text.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_SAFE_LENGTH   = 600;   // chars — hard cap before trimming
const MIN_SAFE_LENGTH   = 3;     // chars — too short = fail

// ─── Meta-commentary patterns that should never appear ───────────────────────

const META_PATTERNS = [
  /^(certainly|sure|of course|no problem|great question|good question|absolutely)[,!.]?\s/i,
  /\bas an (ai|language model|chatbot|bot|assistant)\b/i,
  /\bi (am|'m) an? (ai|language model|chatbot|bot|assistant)\b/i,
  /ich bin (ein[e]? )?(ki|chatbot|sprachmodell|assistent)/i,
  /\b(gerne helfe|helfe ich gerne|Natürlich helfe)\b/i,
];

// ─── Hallucination markers ────────────────────────────────────────────────────

const HALLUCINATION_PATTERNS = [
  /\[(source|citation|footnote|ref)\]/i,
  /lt\.\s*(wikipedia|wiki)\b/i,
  /laut\s*(wikipedia|wiki)\b/i,
];

// ─── Structural noise ─────────────────────────────────────────────────────────

const STRUCTURAL_NOISE = [
  /^\s*[\*\#]{2,}/m,   // starts with ** or ## (markdown headers/bold)
  /^\s*\d+\.\s/m,      // numbered list as first line
];

// ─── Result type ──────────────────────────────────────────────────────────────

export interface QualityResult {
  pass:      boolean;
  text:      string;   // original or corrected text
  reasons:   string[]; // human-readable list of issues found
}

// ─── Main function ────────────────────────────────────────────────────────────

export function runQualityGate(
  rawText:         string,
  currentQuestion: string,
): QualityResult {
  const reasons: string[] = [];
  let text = rawText.trim();

  // 1. Too short
  if (text.length < MIN_SAFE_LENGTH) {
    return { pass: false, text, reasons: ['too_short'] };
  }

  // 2. Meta-commentary → fail immediately
  for (const pat of META_PATTERNS) {
    if (pat.test(text)) {
      reasons.push(`meta_commentary: ${pat.source}`);
      return { pass: false, text, reasons };
    }
  }

  // 3. Hallucination markers → fail
  for (const pat of HALLUCINATION_PATTERNS) {
    if (pat.test(text)) {
      reasons.push(`hallucination_marker: ${pat.source}`);
      return { pass: false, text, reasons };
    }
  }

  // 4. Structural noise — strip leading markdown artifacts
  for (const pat of STRUCTURAL_NOISE) {
    if (pat.test(text)) {
      reasons.push(`structural_noise: stripped markdown`);
      // Attempt to strip and keep the rest
      text = text.replace(/^[\s\*#\-]+/, '').trim();
      if (text.length < MIN_SAFE_LENGTH) {
        return { pass: false, text, reasons };
      }
    }
  }

  // 5. Repeats user question verbatim (≥ 60% of question words appear at the start)
  const questionWords  = tokenize(currentQuestion);
  const responseStart  = tokenize(text.slice(0, 100));
  if (questionWords.size >= 4) {
    const overlap = [...questionWords].filter(w => responseStart.has(w)).length;
    if (overlap / questionWords.size > 0.6) {
      reasons.push('repeats_question');
      // Don't fail hard — just note it, the content may still be useful
    }
  }

  // 6. Too long → trim to last sentence ≤ MAX_SAFE_LENGTH
  if (text.length > MAX_SAFE_LENGTH) {
    reasons.push(`too_long: ${text.length} chars, trimming`);
    text = trimToSentence(text, MAX_SAFE_LENGTH);
  }

  return { pass: true, text, reasons };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-züöäß\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3),
  );
}

/** Trim text to last sentence ending (. ! ?) within `max` chars. */
function trimToSentence(text: string, max: number): string {
  const slice = text.slice(0, max);
  const lastEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('.\n'),
  );
  if (lastEnd > max * 0.5) {
    return slice.slice(0, lastEnd + 1).trim();
  }
  // Fallback: word boundary trim
  const wordCut = slice.lastIndexOf(' ');
  return (wordCut > 0 ? slice.slice(0, wordCut) : slice).trim() + '…';
}

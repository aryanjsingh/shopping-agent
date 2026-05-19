/**
 * Tiny deterministic PRNG + helpers — used by the agent registry to give each
 * chat a stable but per-chat-unique "personality" and product-ordering seed.
 *
 * Two callers must produce the same sequence given the same seed string,
 * so we go with mulberry32 over a 32-bit hash of the seed.
 */

export function hashStringToSeed(input: string): number {
  let hash = 0xdeadbeef ^ 0;
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 2654435761);
  }
  return (hash >>> 0) || 1;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickWithSeed<T>(items: T[], count: number, seed: number): T[] {
  return shuffleWithSeed(items, seed).slice(0, count);
}

/**
 * Stable per-chat agent personality. Chat-deterministic: same chat → same hint,
 * different chats → likely different hints. Drives intro phrasing and
 * recommendation ordering style without sacrificing factual grounding.
 */
const PERSONALITY_HINTS = [
  "Lead with the strongest match. Use crisp 1-line rationales.",
  "Start with a one-sentence read on the shopper's situation, then results.",
  "Open with the best-value pick, then the premium upgrade, then a wildcard.",
  "Frame picks as tradeoffs ('this vs this') rather than a ranked list.",
  "Cite the single feature that makes each product worth its price.",
  "Lead with what to AVOID in this category, then the safe pick.",
  "Highlight the under-the-radar option first, then the obvious flagship.",
  "Open with the deal of the bunch (best price-to-spec ratio).",
];

export function pickPersonalityHint(seed: number): string {
  const idx = seed % PERSONALITY_HINTS.length;
  return PERSONALITY_HINTS[idx];
}

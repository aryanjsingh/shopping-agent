export type AssistantResponsePayload = {
  responseText: string;
};

export function parseAssistantResponseText(text: string): {
  isJsonLike: boolean;
  responseText: string | null;
} {
  const cleaned = stripCodeFence(text).trim();
  if (!cleaned) {
    return { isJsonLike: false, responseText: "" };
  }

  const isJsonLike = cleaned.startsWith("{") || cleaned.startsWith("[");
  if (isJsonLike) {
    try {
      const parsed = JSON.parse(cleaned) as Partial<AssistantResponsePayload>;
      return {
        isJsonLike: true,
        responseText:
          typeof parsed.responseText === "string" ? parsed.responseText : null,
      };
    } catch {
      // Fall through to inline-wrapper extraction below.
    }
  }

  const inline = extractInlineResponseText(cleaned);
  if (inline) {
    const prefix = cleaned.slice(0, inline.start).trim();
    const suffix = cleaned.slice(inline.end).trim();
    const merged = [prefix, inline.value, suffix].filter(Boolean).join("\n\n");
    return { isJsonLike: true, responseText: merged };
  }

  return { isJsonLike, responseText: isJsonLike ? null : cleaned };
}

// Locate a {"responseText":"..."} object embedded in a larger text blob and
// return its boundaries plus the unwrapped value. Handles escaped quotes.
function extractInlineResponseText(
  source: string
): { start: number; end: number; value: string } | null {
  const marker = '{"responseText":"';
  const start = source.indexOf(marker);
  if (start === -1) {
    return null;
  }

  const valueStart = start + marker.length;
  let i = valueStart;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === '"') {
      break;
    }
    i++;
  }
  if (i >= source.length) {
    return null;
  }

  const raw = source.slice(start, i + 2); // includes closing "}
  if (!raw.endsWith('"}')) {
    // Tolerate trailing whitespace before the closing brace.
    const closeBrace = source.indexOf("}", i);
    if (closeBrace === -1) {
      return null;
    }
    try {
      const parsed = JSON.parse(source.slice(start, closeBrace + 1)) as Partial<AssistantResponsePayload>;
      if (typeof parsed.responseText !== "string") {
        return null;
      }
      return { start, end: closeBrace + 1, value: parsed.responseText };
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AssistantResponsePayload>;
    if (typeof parsed.responseText !== "string") {
      return null;
    }
    return { start, end: start + raw.length, value: parsed.responseText };
  } catch {
    return null;
  }
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
}

// Patterns the model uses to "think out loud" in user-facing text. The system
// prompt forbids these but free-tier models leak them anyway. Match a full
// sentence/line that starts with one of these cues — usually procedural
// narration like "Let me check sellers..." or "Now I'll normalize prices...".
const NARRATION_PREFIXES = [
  "let me",
  "let's",
  "now let me",
  "now let's",
  "now i'll",
  "now i will",
  "i'll now",
  "i will now",
  "i'll",
  "i will",
  "i need to",
  "need to",
  "first,? i",
  "next,? i",
  "then,? i",
  "allow me",
  "here'?s the straight read",
  "here'?s my read",
  "here'?s my take",
  "here'?s the breakdown",
  "here'?s the deal",
  "here'?s what i",
  "prices are across currencies so let me",
  "let me normalize",
  "let me show",
  "let me check",
  "let me compare",
  "let me find",
  "let me grab",
  "let me pull",
  "let me search",
  "let me look",
  "let me dig",
  "let me run",
  "let me verify",
  "let me see",
  "checking ",
  "searching ",
  "comparing ",
  "looking ",
  "thinking ",
];

const NARRATION_REGEX = new RegExp(
  `^\\s*(?:${NARRATION_PREFIXES.join("|")})\\b[^\\n]*$`,
  "i"
);

// Strips sentences/lines the model emitted as procedural narration. Run only on
// assistant prose, after JSON envelope and code-fence stripping.
export function stripNarration(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (NARRATION_REGEX.test(line)) {
      continue;
    }
    // Also strip leading narration sentence that runs into real content on the
    // same line, e.g. "Let me normalize prices. Here are the picks: ..."
    const cleaned = line.replace(NARRATION_REGEX, "").replace(
      new RegExp(
        `^\\s*(?:${NARRATION_PREFIXES.join("|")})\\b[^.!?\\n]*[.!?]\\s+`,
        "i"
      ),
      ""
    );
    kept.push(cleaned);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Strips markdown pipe tables (header | separator | rows) from assistant prose.
// The UI renders compareProducts/compareSellers as native components, so a raw
// markdown table is always duplicate noise.
export function stripMarkdownPipeTables(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const header = lines[i];
    const separator = lines[i + 1];
    const isHeader = /^\s*\|.*\|\s*$/.test(header);
    const isSeparator = /^\s*\|?\s*:?-{2,}.*\|.*$/.test(separator ?? "");
    if (isHeader && isSeparator) {
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        i++;
      }
      continue;
    }
    result.push(header);
    i++;
  }
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

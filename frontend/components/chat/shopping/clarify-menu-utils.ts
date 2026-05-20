export type ClarifyMenuOutput = {
  options?: { description?: string; label?: string; value?: string; searchHint?: string }[];
  question?: string;
  reason?: string;
  mode?: string;
};

export function isClarifyMenuRestatement(
  text: string,
  output?: ClarifyMenuOutput
) {
  const normalizedText = normalizeForMenuMatch(text);
  if (!output || normalizedText.length < 24) {
    return false;
  }

  const question = normalizeForMenuMatch(output.question ?? "");
  if (question && normalizedText.includes(question)) {
    return true;
  }

  const optionHits =
    output.options?.filter((option) => {
      const label = normalizeForMenuMatch(option.label ?? "");
      const description = normalizeForMenuMatch(option.description ?? "");
      return (
        (label.length > 0 && normalizedText.includes(label)) ||
        (description.length > 12 && normalizedText.includes(description))
      );
    }).length ?? 0;

  return optionHits >= Math.min(2, output.options?.length ?? 2);
}

/**
 * Salvage path: when a free-tier model emits the clarifyIntent JSON as text
 * instead of actually calling the tool, parse it and render the menu anyway.
 * Returns null if the text isn't recognisable as a clarify-intent payload.
 */
export function tryParseClarifyMenuFromText(
  text: string
): ClarifyMenuOutput | null {
  if (!text || text.length < 20 || text.length > 8000) return null;

  const candidates = extractJsonCandidates(text);
  for (const candidate of candidates) {
    const parsed = parseClarifyCandidate(candidate);
    if (parsed) return parsed;
  }

  return null;
}

export function looksLikeClarifyMenuJson(text: string) {
  const normalized = text.trim();
  if (!normalized) return false;

  const stripped = normalized
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  if (!(stripped.startsWith("{") || stripped.startsWith("["))) {
    return false;
  }

  return (
    /"?(clarifyIntent|question|options|searchHint|mode)"?\s*:/i.test(stripped) ||
    /"options"?\s*:\s*\[/i.test(stripped)
  );
}

function extractJsonCandidates(text: string) {
  const stripped = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const candidates = new Set<string>();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start >= 0 && end > start) {
    candidates.add(stripped.slice(start, end + 1));
  }

  for (const match of stripped.matchAll(/\{[\s\S]*?\}/g)) {
    candidates.add(match[0]);
  }

  return Array.from(candidates).filter(
    (candidate) =>
      candidate.includes("question") ||
      candidate.includes("options") ||
      candidate.includes("clarifyIntent")
  );
}

function parseClarifyCandidate(candidate: string): ClarifyMenuOutput | null {
  try {
    const parsed = JSON.parse(candidate) as ClarifyMenuOutput;
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .map((option) => ({
            description:
              typeof option.description === "string"
                ? option.description
                : undefined,
            label: typeof option.label === "string" ? option.label : undefined,
            searchHint:
              typeof option.searchHint === "string"
                ? option.searchHint
                : undefined,
            value:
              typeof option.value === "string"
                ? option.value
                : typeof option.label === "string"
                  ? option.label
                  : undefined,
          }))
          .filter((option) => Boolean(option.label && option.value))
          .map((option) => ({
            description: option.description,
            label: option.label ?? "",
            searchHint: option.searchHint,
            value: option.value ?? "",
          }))
      : [];

    if (options.length < 2) return null;

    return {
      mode: parsed.mode,
      options,
      question:
        typeof parsed.question === "string" ? parsed.question : "What matters most?",
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  } catch {
    return null;
  }
}

function normalizeForMenuMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[*_`#>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

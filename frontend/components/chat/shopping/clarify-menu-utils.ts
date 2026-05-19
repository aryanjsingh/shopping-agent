export type ClarifyMenuOutput = {
  options?: { description?: string; label?: string }[];
  question?: string;
  reason?: string;
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

function normalizeForMenuMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[*_`#>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

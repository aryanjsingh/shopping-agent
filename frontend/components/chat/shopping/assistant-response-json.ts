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
  if (!isJsonLike) {
    return { isJsonLike: false, responseText: cleaned };
  }

  try {
    const parsed = JSON.parse(cleaned) as Partial<AssistantResponsePayload>;
    return {
      isJsonLike: true,
      responseText:
        typeof parsed.responseText === "string" ? parsed.responseText : null,
    };
  } catch {
    return { isJsonLike: true, responseText: null };
  }
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
}

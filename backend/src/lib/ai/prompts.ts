export type RequestHints = {
  latitude?: string;
  longitude?: string;
  city?: string;
  country?: string;
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude ?? "unknown"}
- lon: ${requestHints.longitude ?? "unknown"}
- city: ${requestHints.city ?? "unknown"}
- country: ${requestHints.country ?? "unknown"}
`;

export function buildSystemPrompt({
  agentPrompt,
  requestHints,
}: {
  agentPrompt: string;
  requestHints: RequestHints;
}) {
  const istDateString = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const timestampPrompt = `\
Current System Time (IST): ${istDateString}
`;

  return `${agentPrompt}\n\n${timestampPrompt}\n${getRequestPromptFromHints(requestHints)}`;
}

// Legacy prompts retained so dormant artifact modules type-check.
export const codePrompt = "";
export const sheetPrompt = "";
export const updateDocumentPrompt = (
  _currentContent: string | null,
  _type: string
) => "";

export const titlePrompt = `Generate a short chat title (2-5 words) summarizing the user's shopping intent.

Output ONLY the title text. No prefixes, no formatting, no quotes.

Examples:
- "I need a phone under 30k with good camera" → Mobile under 30k
- "wireless headphones" → Wireless Headphones
- "hi" → New Chat`;

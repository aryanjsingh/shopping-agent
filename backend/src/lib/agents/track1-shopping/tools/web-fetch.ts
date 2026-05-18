import { tool } from "ai";
import { z } from "zod";

const MAX_CHARS = 8_000;

export const webFetch = tool({
  description:
    "Fetch the content of a web page and return its readable text. Use after webSearch when you need the full details from a specific URL (e.g. a product review page, a spec sheet, a news article). Strips HTML tags and returns plain text up to 8000 characters.",
  inputSchema: z.object({
    url: z.string().url().describe("Full URL to fetch"),
    focus: z
      .string()
      .optional()
      .describe(
        "Optional hint about what to look for in the page (e.g. 'price', 'specs', 'reviews')"
      ),
  }),
  execute: async ({ url, focus }) => {
    // Block non-http(s) schemes and private/local addresses
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { error: "Invalid URL", url };
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "Only http/https URLs are supported", url };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname === "0.0.0.0"
    ) {
      return { error: "Private/local URLs are not allowed", url };
    }

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ShoppingAgent/1.0; +https://kasparro.com)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(15_000),
        redirect: "follow",
      });

      if (!res.ok) {
        return { error: `HTTP ${res.status} ${res.statusText}`, url };
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain") &&
        !contentType.includes("application/xhtml")
      ) {
        return {
          error: `Unsupported content type: ${contentType}`,
          url,
        };
      }

      const html = await res.text();
      const text = extractText(html);
      const trimmed = text.slice(0, MAX_CHARS);

      return {
        url,
        focus: focus ?? null,
        length: trimmed.length,
        content: trimmed,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Fetch failed",
        url,
      };
    }
  },
});

function extractText(html: string): string {
  return html
    // Remove entire boilerplate blocks
    .replace(/<(script|style|noscript|svg|iframe|nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Replace block-level closing tags with newlines to preserve paragraph breaks
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|main|blockquote)>/gi, "\n")
    // Replace <br> with newline
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    // Collapse horizontal whitespace, then excessive blank lines
    .replace(/[ \t]+/g, " ")
    .replace(/^ +/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

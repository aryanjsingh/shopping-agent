import { tool } from "ai";
import { z } from "zod";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "playwright";

chromium.use(StealthPlugin());

let _fetchBrowser: Browser | null = null;

async function getFetchBrowser(): Promise<Browser> {
  if (_fetchBrowser && _fetchBrowser.isConnected()) return _fetchBrowser;

  _fetchBrowser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1366,768",
    ],
  });

  _fetchBrowser.on("disconnected", () => { _fetchBrowser = null; });
  return _fetchBrowser;
}

const MAX_CHARS = 10_000;

function isPrivateHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.16.") ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local")
  );
}

async function fetchWithPlaywright(url: string): Promise<string> {
  const browser = await getFetchBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-US",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    // Wait a bit for JS-rendered content
    await page.waitForTimeout(1200 + Math.random() * 600);

    // Try to get main content area first, fall back to full body
    const content = await page.evaluate(() => {
      // Remove noise elements
      for (const sel of ["script", "style", "noscript", "nav", "header", "footer", "aside", "iframe", "form", "svg", ".cookie-banner", "#cookie-notice", ".ad", ".advertisement"]) {
        document.querySelectorAll(sel).forEach((el) => el.remove());
      }

      const main =
        document.querySelector("main") ??
        document.querySelector("article") ??
        document.querySelector('[role="main"]') ??
        document.querySelector(".content") ??
        document.querySelector("#content") ??
        document.body;

      return main?.innerText ?? document.body.innerText ?? "";
    });

    return content;
  } finally {
    await context.close();
  }
}

function cleanText(raw: string): string {
  return raw
    .replace(/[ \t]+/g, " ")
    .replace(/^ +/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const webFetch = tool({
  description:
    "Fetch the content of a web page and return its readable text. Use after webSearch when you need the full details from a specific URL (e.g. a product review page, a spec sheet, a news article). Uses a real browser to handle JS-rendered pages. Returns plain text up to 10000 characters.",
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
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { error: "Invalid URL", url };
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "Only http/https URLs are supported", url };
    }

    if (isPrivateHost(parsed.hostname.toLowerCase())) {
      return { error: "Private/local URLs are not allowed", url };
    }

    try {
      const raw = await fetchWithPlaywright(url);
      const text = cleanText(raw);
      const trimmed = text.slice(0, MAX_CHARS);

      if (!trimmed) {
        return { error: "Page returned no readable content", url };
      }

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

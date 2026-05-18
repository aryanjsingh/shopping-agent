import { tool } from "ai";
import { z } from "zod";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "playwright";

chromium.use(StealthPlugin());

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;

  _browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--window-size=1280,800",
    ],
  });

  _browser.on("disconnected", () => { _browser = null; });
  return _browser;
}

interface SearchResult {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
}

async function googleSearch(query: string, num: number): Promise<SearchResult[]> {
  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-US",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });

  const page = await context.newPage();

  try {
    // Warm up with homepage to get cookies
    await page.goto("https://www.google.com/?hl=en", {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForTimeout(800 + Math.random() * 600);

    const params = new URLSearchParams({
      q: query,
      hl: "en",
      gl: "us",
      num: String(Math.min(num + 3, 10)),
    });

    await page.goto(`https://www.google.com/search?${params}`, {
      waitUntil: "networkidle",
      timeout: 25_000,
    });
    await page.waitForTimeout(1000 + Math.random() * 800);

    const html = await page.content();

    if (
      html.includes("detected unusual traffic") ||
      html.includes("/sorry/index") ||
      html.includes("recaptcha") ||
      (await page.title()).toLowerCase().includes("sorry")
    ) {
      return [];
    }

    const results: SearchResult[] = await page.evaluate((maxNum: number) => {
      const items: SearchResult[] = [];
      const seen = new Set<string>();

      document.querySelectorAll("h3").forEach((h3El) => {
        if (items.length >= maxNum) return;
        const h3 = h3El as HTMLElement;

        let a: HTMLAnchorElement | null = h3.closest("a");
        if (!a) a = h3.parentElement?.closest("a") ?? null;
        if (!a) return;

        const url = a.href;
        if (!url.startsWith("http") || url.includes("google.com") || seen.has(url)) return;
        seen.add(url);

        const title = h3.innerText.trim();
        if (!title) return;

        const container =
          h3.closest("[data-hveid]") ??
          h3.closest("div.g") ??
          h3.parentElement?.parentElement ??
          null;

        const snippetEl =
          (container?.querySelector("div[data-sncf]") as HTMLElement | null) ??
          (container?.querySelector("div[class*='VwiC']") as HTMLElement | null) ??
          (container?.querySelector("div[style*='-webkit-line-clamp']") as HTMLElement | null) ??
          (container?.querySelector("span[class*='st']") as HTMLElement | null) ??
          null;

        let displayUrl = url;
        try { displayUrl = new URL(url).hostname.replace(/^www\./, ""); } catch {}

        items.push({ title, url, displayUrl, snippet: snippetEl?.innerText?.trim() ?? "" });
      });

      return items;
    }, num);

    return results.slice(0, num);
  } finally {
    await context.close();
  }
}

export const webSearch = tool({
  description:
    "Search Google for real-time information about products, brands, reviews, or any topic the shopper asks about. Use when Shopify catalog results are insufficient or the shopper asks a research question (e.g. 'best running shoes 2025', 'is X brand reliable', 'compare X vs Y'). Returns organic results with title, link, and snippet.",
  inputSchema: z.object({
    query: z.string().min(2).describe("Google search query"),
    num: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of results to return (default 5)"),
  }),
  execute: async ({ query, num = 5 }) => {
    try {
      const results = await googleSearch(query, num);

      if (results.length === 0) {
        return {
          error: "Google returned no results or triggered a CAPTCHA. Try a different query.",
          query,
          results: [],
        };
      }

      return { query, count: results.length, results };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Search failed",
        query,
        results: [],
      };
    }
  },
});

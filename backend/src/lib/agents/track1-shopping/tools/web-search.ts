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
      "--disable-gpu",
      "--window-size=1366,768",
      "--disable-extensions",
      "--disable-infobars",
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

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function bingSearch(query: string, num: number): Promise<SearchResult[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: randomUA(),
    locale: "en-US",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  const page = await context.newPage();

  try {
    const params = new URLSearchParams({ q: query, count: String(Math.min(num + 2, 10)), setlang: "en", cc: "US" });
    await page.goto(`https://www.bing.com/search?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    await page.waitForTimeout(600 + Math.random() * 500);

    const html = await page.content();
    if (html.includes("captcha") || html.includes("blocked")) return [];

    const results: SearchResult[] = await page.evaluate((maxNum: number) => {
      const items: SearchResult[] = [];
      const seen = new Set<string>();

      document.querySelectorAll("li.b_algo").forEach((li) => {
        if (items.length >= maxNum) return;
        const h2 = li.querySelector("h2");
        const a = h2?.querySelector("a") as HTMLAnchorElement | null;
        if (!a) return;

        const url = a.href;
        if (!url.startsWith("http") || seen.has(url)) return;
        seen.add(url);

        const title = a.innerText.trim();
        if (!title) return;

        const snippetEl = li.querySelector(".b_caption p") as HTMLElement | null;
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

async function duckduckgoSearch(query: string, num: number): Promise<SearchResult[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: randomUA(),
    locale: "en-US",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  const page = await context.newPage();

  try {
    const params = new URLSearchParams({ q: query, kl: "us-en", kp: "-1" });
    await page.goto(`https://html.duckduckgo.com/html/?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    await page.waitForTimeout(500 + Math.random() * 400);

    const results: SearchResult[] = await page.evaluate((maxNum: number) => {
      const items: SearchResult[] = [];
      const seen = new Set<string>();

      document.querySelectorAll(".result").forEach((el) => {
        if (items.length >= maxNum) return;
        const titleEl = el.querySelector(".result__title a") as HTMLAnchorElement | null;
        if (!titleEl) return;

        // DDG uses redirect URLs; extract real URL from data-href or href
        const rawUrl = titleEl.getAttribute("data-href") ?? titleEl.href ?? "";
        let url = rawUrl;
        try {
          const u = new URL(rawUrl);
          url = u.searchParams.get("uddg") ?? u.searchParams.get("u") ?? rawUrl;
        } catch {}

        if (!url.startsWith("http") || seen.has(url)) return;
        seen.add(url);

        const title = titleEl.innerText.trim();
        if (!title) return;

        const snippetEl = el.querySelector(".result__snippet") as HTMLElement | null;
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

async function googleSearch(query: string, num: number): Promise<SearchResult[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: randomUA(),
    locale: "en-US",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  const page = await context.newPage();

  try {
    await page.goto("https://www.google.com/?hl=en", {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForTimeout(700 + Math.random() * 500);

    const params = new URLSearchParams({ q: query, hl: "en", gl: "us", num: String(Math.min(num + 3, 10)) });
    await page.goto(`https://www.google.com/search?${params}`, {
      waitUntil: "networkidle",
      timeout: 25_000,
    });
    await page.waitForTimeout(800 + Math.random() * 600);

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

        const container = h3.closest("[data-hveid]") ?? h3.closest("div.g") ?? h3.parentElement?.parentElement ?? null;
        const snippetEl =
          (container?.querySelector("div[data-sncf]") as HTMLElement | null) ??
          (container?.querySelector("div[class*='VwiC']") as HTMLElement | null) ??
          (container?.querySelector("div[style*='-webkit-line-clamp']") as HTMLElement | null) ??
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

async function multiEngineSearch(query: string, num: number): Promise<SearchResult[]> {
  // Try Bing first (less aggressive bot detection)
  try {
    const results = await bingSearch(query, num);
    if (results.length > 0) return results;
  } catch {}

  // Fall back to DuckDuckGo
  try {
    const results = await duckduckgoSearch(query, num);
    if (results.length > 0) return results;
  } catch {}

  // Last resort: Google
  try {
    const results = await googleSearch(query, num);
    if (results.length > 0) return results;
  } catch {}

  return [];
}

export const webSearch = tool({
  description:
    "Search the web for real-time information about products, brands, reviews, or any topic the shopper asks about. Use when Shopify catalog results are insufficient or the shopper asks a research question (e.g. 'best running shoes 2025', 'is X brand reliable', 'compare X vs Y'). Returns organic results with title, link, and snippet. Searches Bing first, falls back to DuckDuckGo then Google.",
  inputSchema: z.object({
    query: z.string().min(2).describe("Search query"),
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
      const results = await multiEngineSearch(query, num);

      if (results.length === 0) {
        return {
          error: "All search engines returned no results or triggered bot detection. Try a different query.",
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

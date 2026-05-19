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

  return [];
}

// Tiny TTL cache so repeated webSearch within a chat doesn't re-spawn chromium.
type CacheEntry = { results: SearchResult[]; expiresAt: number };
const SEARCH_CACHE = new Map<string, CacheEntry>();
const SEARCH_TTL_MS = 5 * 60 * 1000;

function cacheKey(query: string, num: number, kind: string) {
  return `${kind}::${num}::${query.toLowerCase().trim()}`;
}

function readCache(key: string): SearchResult[] | null {
  const hit = SEARCH_CACHE.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    SEARCH_CACHE.delete(key);
    return null;
  }
  return hit.results;
}

function writeCache(key: string, results: SearchResult[]) {
  SEARCH_CACHE.set(key, { results, expiresAt: Date.now() + SEARCH_TTL_MS });
}

const KIND_TEMPLATES: Record<string, (q: string) => string> = {
  reviews: (q) => `${q} review 2024 2025`,
  comparison: (q) => `${q} vs alternatives comparison`,
  brand_reputation: (q) => `${q} brand reliability complaints`,
  price_check: (q) => `${q} best price retailer`,
  generation_check: (q) => `${q} release year chipset specs`,
  general: (q) => q,
};

export const webSearch = tool({
  description:
    "Search the live web through local SERP scraping with stealth browser contexts. Uses Bing first and DuckDuckGo as a non-Google fallback. Use AFTER searchProducts when the shopper asks about brand reputation ('is X reliable'), expert opinion ('best X for Y'), spec/release-year clarity, or current-vs-old generation context. Set searchKind to focus the query: 'reviews' (expert reviews), 'comparison' (X vs Y), 'brand_reputation' (reliability), 'price_check' (cheapest seller), 'generation_check' (release year + chipset), 'general' (default). Cached for 5 min within the process.",
  inputSchema: z.object({
    query: z.string().min(2).describe("Search query"),
    num: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of results to return (default 5)"),
    searchKind: z
      .enum([
        "reviews",
        "comparison",
        "brand_reputation",
        "price_check",
        "generation_check",
        "general",
      ])
      .optional()
      .describe("Focus the search — defaults to 'general'"),
  }),
  execute: async ({ query, num = 5, searchKind = "general" }) => {
    const builder = KIND_TEMPLATES[searchKind] ?? KIND_TEMPLATES.general;
    const finalQuery = builder(query).trim();
    const key = cacheKey(finalQuery, num, searchKind);

    const cached = readCache(key);
    if (cached) {
      return {
        query: finalQuery,
        searchKind,
        cached: true,
        count: cached.length,
        results: cached,
      };
    }

    try {
      const results = await multiEngineSearch(finalQuery, num);

      if (results.length === 0) {
        return {
          error:
            "Bing and DuckDuckGo returned no results or triggered bot detection. Try a different query.",
          query: finalQuery,
          searchKind,
          results: [],
        };
      }

      writeCache(key, results);
      return {
        query: finalQuery,
        searchKind,
        cached: false,
        count: results.length,
        results,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Search failed",
        query: finalQuery,
        searchKind,
        results: [],
      };
    }
  },
});

import { tool } from "ai";
import { z } from "zod";
import { searchCatalog } from "@/lib/shopify/catalog";
import { hashStringToSeed, shuffleWithSeed } from "../seed";

type Seller = {
  shopId: string;
  shopName: string;
  shopUrl?: string;
  price: number;
  currency: string;
  checkoutUrl: string;
  productUrl: string;
  variantId: string;
  availableForSale: boolean;
};

export type ProductView = ReturnType<typeof buildProductView>;

export type SearchProductsContext = {
  /** Stable per-chat seed so a returning user sees consistent ordering. */
  chatSeed: number;
  /** Last-search memo used by showMore + refineSearch. */
  memo: SearchMemo;
};

export type SearchMemo = {
  lastQuery?: string;
  lastFilters?: { minPrice?: number; maxPrice?: number; shipsTo?: string };
  lastProductIds: string[];
  lastProducts?: ProductView[];
  updatedThisTurn?: boolean;
};

const CURRENT_GEN_QUERY_SUFFIX = "(2024 OR 2025 OR 2026)";

export function createSearchProductsTool(ctx: SearchProductsContext) {
  return tool({
    description:
      "Search Shopify Catalog MCP for real products only after the shopper's intent is specific enough to avoid guessy results. If an unanswered preference would materially change the product set, call clarifyIntent before this tool. Pass a tight keyword query. Translate non-USD budgets to USD whole cents before filling minPrice/maxPrice. Set currentGenOnly=true when the user wants the latest tech. Set sortMode='price_low' to surface affordable picks first, 'rating' to lead with best-reviewed, 'random' for variety. For device queries, search for the device itself, not accessories unless requested. Top 6 of 12 are returned, deterministically shuffled per chat so re-runs feel fresh.",
    inputSchema: z.object({
      query: z.string().min(2).describe("Keyword search string"),
      limit: z.number().int().min(1).max(12).optional(),
      minPrice: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Minimum price in cents (USD)"),
      maxPrice: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum price in cents (USD)"),
      shipsTo: z
        .string()
        .length(2)
        .optional()
        .describe("ISO 2-letter country code, defaults to US"),
      currentGenOnly: z
        .boolean()
        .optional()
        .describe("Bias the catalog query toward 2024+ products"),
      sortMode: z
        .enum(["relevance", "price_low", "price_high", "rating", "random"])
        .optional()
        .describe("How to order results — defaults to relevance"),
    }),
    execute: async (input) => {
      try {
        const limit = input.limit ?? 6;
        // Pull more than we return so we have variety to shuffle / re-rank from.
        const overscan = Math.min(12, Math.max(limit + 4, 8));
        const querySuffix = input.currentGenOnly ? ` ${CURRENT_GEN_QUERY_SUFFIX}` : "";
        const finalQuery = `${input.query}${querySuffix}`.trim();

        const products = await searchCatalog({
          query: finalQuery,
          limit: overscan,
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          shipsTo: input.shipsTo ?? "US",
        });

        const relevantProducts = filterAccessoryMismatches(products, input.query);
        const ratingFiltered = filterLowRated(relevantProducts);
        const ranked = rerank(ratingFiltered, input.sortMode ?? "relevance", ctx.chatSeed, finalQuery);
        const top = ranked.slice(0, limit);

        // Update memo so showMore / refineSearch can pick up the thread.
        ctx.memo.lastQuery = input.query;
        ctx.memo.lastFilters = {
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          shipsTo: input.shipsTo ?? "US",
        };
        ctx.memo.lastProductIds = top.map((p) => p.id);
        ctx.memo.lastProducts = top.map(buildProductView);
        ctx.memo.updatedThisTurn = true;

        return {
          query: input.query,
          sortMode: input.sortMode ?? "relevance",
          currentGenOnly: input.currentGenOnly ?? false,
          count: top.length,
          products: ctx.memo.lastProducts,
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Search failed",
          query: input.query,
          count: 0,
          products: [],
        };
      }
    },
  });
}

const MIN_RATING = 3.0;
const MIN_RATED_RESULTS = 3;

function filterLowRated(products: Awaited<ReturnType<typeof searchCatalog>>) {
  const passing = products.filter(
    (p) => p.rating == null || p.rating.rating >= MIN_RATING
  );
  // Fall back to unfiltered if too few survive (avoids empty/tiny result sets).
  return passing.length >= MIN_RATED_RESULTS ? passing : products;
}

function filterAccessoryMismatches(
  products: Awaited<ReturnType<typeof searchCatalog>>,
  query: string
) {
  if (!isDeviceIntent(query)) return products;
  const directMatches = products.filter((product) => !isAccessory(product.title));
  return directMatches.length >= 2 ? directMatches : products;
}

function isDeviceIntent(query: string) {
  return /\b(ipad|tablet|iphone|phone|laptop|macbook|kindle|camera|monitor|tv|watch|router|console|earbuds|headphones|airpods)\b/i.test(query);
}

function isAccessory(title: string) {
  return /\b(case|cover|sleeve|screen protector|protector|charger|charging cable|cable|adapter|stand|mount|holder|strap|band|skin|keyboard case|pouch|bag)\b/i.test(title);
}

function rerank(
  products: Awaited<ReturnType<typeof searchCatalog>>,
  mode: "relevance" | "price_low" | "price_high" | "rating" | "random",
  chatSeed: number,
  query: string
): typeof products {
  if (mode === "price_low") {
    return products
      .slice()
      .sort((a, b) => a.priceRange.min.amount - b.priceRange.min.amount);
  }
  if (mode === "price_high") {
    return products
      .slice()
      .sort((a, b) => b.priceRange.min.amount - a.priceRange.min.amount);
  }
  if (mode === "rating") {
    return products
      .slice()
      .sort((a, b) => (b.rating?.rating ?? 0) - (a.rating?.rating ?? 0));
  }
  if (mode === "random") {
    return shuffleWithSeed(products, chatSeed ^ hashStringToSeed(query));
  }
  // relevance — keep MCP order but lightly shuffle ties to avoid identical
  // ordering across reruns of the same query in different chats.
  const seed = chatSeed ^ hashStringToSeed(`relevance:${query}`);
  return lightShuffle(products, seed);
}

/**
 * Keeps top-of-list stable but shuffles the long tail. With overscan=12 and
 * limit=6, this means slot 1 always wins on relevance but the bottom half
 * varies per chat — enough freshness without breaking grounding.
 */
function lightShuffle<T>(items: T[], seed: number): T[] {
  if (items.length <= 3) return items;
  const head = items.slice(0, 2);
  const tail = items.slice(2);
  return [...head, ...shuffleWithSeed(tail, seed)];
}

function buildProductView(p: Awaited<ReturnType<typeof searchCatalog>>[number]) {
  const sellers = dedupeSellers(p.variants);
  const primarySeller = sellers.find((s) => s.checkoutUrl) ?? sellers[0];
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    uniqueSellingPoint: p.uniqueSellingPoint,
    topFeatures: p.topFeatures ?? [],
    techSpecs: p.techSpecs ?? [],
    media: p.media?.slice(0, 1) ?? [],
    priceRange: p.priceRange,
    rating: p.rating,
    sellers,
    productUrl: primarySeller?.checkoutUrl || primarySeller?.productUrl || "",
    primaryCheckoutUrl: primarySeller?.checkoutUrl ?? "",
    primaryVariantId: primarySeller?.variantId ?? "",
  };
}

function dedupeSellers(
  variants: {
    shop: { id: string; name: string; onlineStoreUrl?: string };
    price: { amount: number; currency: string };
    checkoutUrl: string;
    variantUrl: string;
    id: string;
    availableForSale: boolean;
  }[]
): Seller[] {
  const map = new Map<string, Seller>();
  for (const v of variants) {
    const existing = map.get(v.shop.id);
    if (
      !existing ||
      (v.availableForSale && !existing.availableForSale) ||
      (v.availableForSale === existing.availableForSale &&
        v.price.amount < existing.price)
    ) {
      map.set(v.shop.id, {
        shopId: v.shop.id,
        shopName: v.shop.name,
        shopUrl: v.shop.onlineStoreUrl,
        price: v.price.amount,
        currency: v.price.currency,
        checkoutUrl: v.checkoutUrl,
        productUrl: v.checkoutUrl || v.variantUrl || v.shop.onlineStoreUrl || "",
        variantId: v.id,
        availableForSale: v.availableForSale,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.availableForSale !== b.availableForSale) {
      return a.availableForSale ? -1 : 1;
    }
    return a.price - b.price;
  });
}

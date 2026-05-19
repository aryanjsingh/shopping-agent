import { tool } from "ai";
import { z } from "zod";
import { searchCatalog } from "@/lib/shopify/catalog";
import { hashStringToSeed, shuffleWithSeed } from "../seed";
import type { SearchMemo } from "./search-products";

export type ShowMoreContext = {
  chatSeed: number;
  memo: SearchMemo;
};

export function createShowMoreTool(ctx: ShowMoreContext) {
  return tool({
    description:
      "Show MORE products from the same query the shopper just saw. Use when the shopper says 'show me more', 'other options', 'what else', or rejects the first batch. Returns up to 6 products that were NOT in the previous result set.",
    inputSchema: z.object({
      count: z
        .number()
        .int()
        .min(1)
        .max(6)
        .optional()
        .describe("How many additional products to show, default 6"),
    }),
    execute: async ({ count }) => {
      const lastQuery = ctx.memo.lastQuery;
      if (!lastQuery) {
        return {
          error:
            "No previous search in this chat — call searchProducts first.",
        };
      }
      try {
        const products = await searchCatalog({
          query: lastQuery,
          limit: 12,
          minPrice: ctx.memo.lastFilters?.minPrice,
          maxPrice: ctx.memo.lastFilters?.maxPrice,
          shipsTo: ctx.memo.lastFilters?.shipsTo ?? "US",
        });

        const seenIds = new Set(ctx.memo.lastProductIds);
        const fresh = products.filter((p) => !seenIds.has(p.id));
        // shuffle within the unseen pool so re-asks vary
        const shuffled = shuffleWithSeed(
          fresh,
          ctx.chatSeed ^ hashStringToSeed(`more:${ctx.memo.lastProductIds.length}`)
        );
        const slice = shuffled.slice(0, count ?? 6);

        // Append IDs to memo so a second showMore doesn't repeat.
        ctx.memo.lastProductIds = [
          ...ctx.memo.lastProductIds,
          ...slice.map((p) => p.id),
        ];

        return {
          query: lastQuery,
          count: slice.length,
          products: slice.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            uniqueSellingPoint: p.uniqueSellingPoint,
            topFeatures: p.topFeatures ?? [],
            techSpecs: p.techSpecs ?? [],
            media: p.media?.slice(0, 1) ?? [],
            priceRange: p.priceRange,
            rating: p.rating,
            sellers: p.variants.map((v) => ({
              shopId: v.shop.id,
              shopName: v.shop.name,
              price: v.price.amount,
              currency: v.price.currency,
              checkoutUrl: v.checkoutUrl,
              variantId: v.id,
              availableForSale: v.availableForSale,
            })),
            productUrl: p.lookupUrl,
            primaryCheckoutUrl:
              p.variants.find((v) => v.checkoutUrl && v.availableForSale)
                ?.checkoutUrl ?? "",
            primaryVariantId:
              p.variants.find((v) => v.availableForSale)?.id ?? "",
          })),
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Show-more failed",
          query: lastQuery,
          count: 0,
          products: [],
        };
      }
    },
  });
}

import { tool } from "ai";
import { z } from "zod";
import { searchCatalog } from "@/lib/shopify/catalog";
import { hashStringToSeed, shuffleWithSeed } from "../seed";
import type { SearchMemo } from "./search-products";

export type RefineSearchContext = {
  chatSeed: number;
  memo: SearchMemo;
};

export function createRefineSearchTool(ctx: RefineSearchContext) {
  return tool({
    description:
      "Tighten the previous catalog search by adding a constraint the shopper just supplied (e.g. 'lighter than 1kg', 'in black', 'with USB-C', 'under $80'). Use this when the shopper says things like 'cheaper ones', 'something smaller', 'with [feature]'. Re-runs the original query with merged filters. Falls back to a fresh search if no prior query exists in this chat.",
    inputSchema: z.object({
      addedKeywords: z
        .string()
        .min(2)
        .describe(
          "Extra keywords to merge into the prior query (e.g. 'lightweight USB-C')"
        ),
      maxPrice: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Tighter max price in USD cents, replaces prior max"),
      minPrice: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Tighter min price in USD cents, replaces prior min"),
    }),
    execute: async (input) => {
      const lastQuery = ctx.memo.lastQuery;
      if (!lastQuery) {
        return {
          error:
            "No previous search to refine. Call searchProducts first with the user's intent.",
        };
      }
      const mergedQuery = `${lastQuery} ${input.addedKeywords}`.trim();
      const minPrice = input.minPrice ?? ctx.memo.lastFilters?.minPrice;
      const maxPrice = input.maxPrice ?? ctx.memo.lastFilters?.maxPrice;
      const shipsTo = ctx.memo.lastFilters?.shipsTo ?? "US";

      try {
        const products = await searchCatalog({
          query: mergedQuery,
          limit: 12,
          minPrice,
          maxPrice,
          shipsTo,
        });

        const seeded = shuffleWithSeed(
          products,
          ctx.chatSeed ^ hashStringToSeed(`refine:${mergedQuery}`)
        ).slice(0, 6);

        ctx.memo.lastQuery = mergedQuery;
        ctx.memo.lastFilters = { minPrice, maxPrice, shipsTo };
        ctx.memo.lastProductIds = seeded.map((p) => p.id);

        return {
          query: mergedQuery,
          appliedFilters: {
            minPrice,
            maxPrice,
            shipsTo,
            addedKeywords: input.addedKeywords,
          },
          count: seeded.length,
          products: seeded.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            uniqueSellingPoint: p.uniqueSellingPoint,
            topFeatures: p.topFeatures ?? [],
            techSpecs: p.techSpecs ?? [],
            media: p.media?.slice(0, 1) ?? [],
            priceRange: p.priceRange,
            rating: p.rating,
            sellers: dedupeSellers(p.variants),
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
          error: err instanceof Error ? err.message : "Refine failed",
          query: mergedQuery,
          count: 0,
          products: [],
        };
      }
    },
  });
}

function dedupeSellers(
  variants: {
    shop: { id: string; name: string };
    price: { amount: number; currency: string };
    checkoutUrl: string;
    id: string;
    availableForSale: boolean;
  }[]
) {
  const map = new Map<
    string,
    {
      shopId: string;
      shopName: string;
      price: number;
      currency: string;
      checkoutUrl: string;
      variantId: string;
      availableForSale: boolean;
    }
  >();
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
        price: v.price.amount,
        currency: v.price.currency,
        checkoutUrl: v.checkoutUrl,
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

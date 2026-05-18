import { tool } from "ai";
import { z } from "zod";
import { searchCatalog } from "@/lib/shopify/catalog";

export const searchProducts = tool({
  description:
    "Search Shopify Catalog MCP for real products that match the shopper's intent. Use whenever the shopper describes what they want to buy. Provide a concise, keyword-rich query (e.g. 'noise canceling wireless headphones'). Translate budgets in any currency into USD whole-cent amounts when filling minPrice/maxPrice.",
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
  }),
  execute: async (input) => {
    try {
      const products = await searchCatalog({
        query: input.query,
        limit: input.limit ?? 6,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        shipsTo: input.shipsTo ?? "US",
      });
      return {
        query: input.query,
        count: products.length,
        products: products.map((p) => {
          const sellers = dedupeSellers(p.variants);
          const primarySeller =
            sellers.find((s) => s.checkoutUrl) ?? sellers[0];

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
            productUrl: p.lookupUrl,
            primaryCheckoutUrl: primarySeller?.checkoutUrl ?? "",
            primaryVariantId: primarySeller?.variantId ?? "",
          };
        }),
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

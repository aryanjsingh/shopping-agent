import { tool } from "ai";
import { z } from "zod";
import { lookupProduct } from "@/lib/shopify/catalog";

export const compareProducts = tool({
  description:
    "Compare 2-4 products side by side on price, rating, features, and specs. Use when the shopper is choosing between options.",
  inputSchema: z.object({
    productIds: z
      .array(z.string())
      .min(2)
      .max(4)
      .describe("Catalog product ids to compare"),
  }),
  execute: async ({ productIds }) => {
    const products = await Promise.all(
      productIds.map((id) => lookupProduct(id))
    );
    const rows = products
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        id: p.id,
        title: p.title,
        image: p.media?.[0]?.url,
        priceMin: p.priceRange.min,
        priceMax: p.priceRange.max,
        rating: p.rating,
        topFeatures: (p.topFeatures ?? []).slice(0, 4),
        techSpecs: (p.techSpecs ?? []).slice(0, 4),
        bestCheckoutUrl:
          p.variants
            .filter((v) => v.availableForSale && v.checkoutUrl)
            .sort((a, b) => a.price.amount - b.price.amount)[0]?.checkoutUrl ??
          "",
      }));
    return { rows };
  },
});

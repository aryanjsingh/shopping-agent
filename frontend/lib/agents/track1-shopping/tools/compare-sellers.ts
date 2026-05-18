import { tool } from "ai";
import { z } from "zod";
import { lookupProduct } from "@/lib/shopify/catalog";

export const compareSellers = tool({
  description:
    "List all merchants offering one product, sorted by price. Use when the shopper wants to find the cheapest or most trustworthy seller for a specific product.",
  inputSchema: z.object({
    productId: z.string().describe("Catalog product id"),
  }),
  execute: async ({ productId }) => {
    const product = await lookupProduct(productId);
    if (!product) {
      return { error: "Product not found", productId };
    }
    const sellers = product.variants
      .map((v) => ({
        variantId: v.id,
        shopName: v.shop.name,
        shopUrl: v.shop.onlineStoreUrl,
        price: v.price,
        availableForSale: v.availableForSale,
        secondhand: v.secondhand,
        checkoutUrl: v.checkoutUrl,
        productUrl: v.variantUrl,
      }))
      .sort((a, b) => {
        if (a.availableForSale !== b.availableForSale) {
          return a.availableForSale ? -1 : 1;
        }
        return a.price.amount - b.price.amount;
      });
    return {
      productId: product.id,
      productTitle: product.title,
      sellers,
    };
  },
});

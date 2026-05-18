import { tool } from "ai";
import { z } from "zod";
import { lookupProduct } from "@/lib/shopify/catalog";

export const getProduct = tool({
  description:
    "Fetch full product detail for one product id from the Shopify catalog. Use after searchProducts when the shopper wants more info on a specific item.",
  inputSchema: z.object({
    productId: z
      .string()
      .describe("Catalog product id from a prior search result"),
  }),
  execute: async ({ productId }) => {
    const product = await lookupProduct(productId);
    if (!product) {
      return { error: "Product not found", productId };
    }
    return { product };
  },
});

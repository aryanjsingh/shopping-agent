import { tool } from "ai";
import { z } from "zod";

export const buyProduct = tool({
  description:
    "Present a checkout CTA for a specific variant the shopper has chosen. Use only after the shopper indicates intent to buy a specific product+seller.",
  inputSchema: z.object({
    productId: z.string(),
    variantId: z.string(),
    productTitle: z.string(),
    shopName: z.string(),
    price: z.object({
      amount: z.number(),
      currency: z.string(),
    }),
    image: z.string().url().optional(),
    checkoutUrl: z.string().url(),
  }),
  execute: async (input) => input,
});

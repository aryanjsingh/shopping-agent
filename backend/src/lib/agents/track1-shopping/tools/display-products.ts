import { tool } from "ai";
import { z } from "zod";
import type { ProductView, SearchMemo } from "./search-products";

export type DisplayProductsContext = {
  memo: SearchMemo;
};

export function createDisplayProductsTool(ctx: DisplayProductsContext) {
  return tool({
    description:
      "Render a product carousel UI from products found by prior catalog searches. Use this only when you are ready to show the shopper a curated subset. You may search, clarify, refine, or compare first; call this when the visible product UI should appear.",
    inputSchema: z.object({
      productIds: z
        .array(z.string())
        .min(1)
        .max(8)
        .optional()
        .describe(
          "Optional product IDs from prior search results to display. Omit to show the latest curated search results."
        ),
      queryLabel: z
        .string()
        .min(2)
        .max(80)
        .optional()
        .describe("Short label shown in the product carousel header"),
    }),
    execute: async ({ productIds, queryLabel }) => {
      const available = ctx.memo.lastProducts ?? [];
      const products = selectProducts(available, productIds);

      return {
        query: queryLabel ?? ctx.memo.lastQuery ?? "products",
        count: products.length,
        products,
      };
    },
  });
}

function selectProducts(products: ProductView[], productIds?: string[]) {
  if (!productIds?.length) {
    return products.slice(0, 6);
  }

  const byId = new Map(products.map((product) => [product.id, product]));
  return productIds
    .map((id) => byId.get(id))
    .filter((product): product is ProductView => Boolean(product));
}

import { track1SystemPrompt } from "./prompts";
import { buyProduct } from "./tools/buy-product";
import { clarifyIntent } from "./tools/clarify-intent";
import { compareProducts } from "./tools/compare-products";
import { compareSellers } from "./tools/compare-sellers";
import { getProduct } from "./tools/get-product";
import { searchProducts } from "./tools/search-products";

export const track1ShoppingAgent = {
  id: "track1-shopping" as const,
  name: "AI Shopping Agent",
  description: "Helps shoppers discover, compare, and buy across Shopify",
  systemPrompt: track1SystemPrompt,
  tools: {
    searchProducts,
    getProduct,
    compareProducts,
    compareSellers,
    buyProduct,
    clarifyIntent,
  },
  activeToolNames: [
    "searchProducts",
    "getProduct",
    "compareProducts",
    "compareSellers",
    "buyProduct",
    "clarifyIntent",
  ] as const,
};

export type Track1Tools = typeof track1ShoppingAgent.tools;

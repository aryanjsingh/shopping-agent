import { track1SystemPrompt } from "./prompts";
import { hashStringToSeed, pickPersonalityHint } from "./seed";
import { buyProduct } from "./tools/buy-product";
import { clarifyIntent } from "./tools/clarify-intent";
import { compareProducts } from "./tools/compare-products";
import { compareSellers } from "./tools/compare-sellers";
import { getProduct } from "./tools/get-product";
import {
  createSearchProductsTool,
  type SearchMemo,
} from "./tools/search-products";
import { createDisplayProductsTool } from "./tools/display-products";
import { createShowMoreTool } from "./tools/show-more";
import { createRefineSearchTool } from "./tools/refine-search";
import { webSearch } from "./tools/web-search";
import { webFetch } from "./tools/web-fetch";

export type Track1BuildContext = {
  /** Stable identifier for this chat — used for deterministic seed. */
  chatId: string;
  /** Search context recovered from previous persisted tool calls. */
  initialMemo?: SearchMemo;
};

export type Track1Build = {
  systemPrompt: string;
  tools: Record<string, unknown>;
  activeToolNames: readonly string[];
};

const ACTIVE_TOOL_NAMES = [
  "searchProducts",
  "displayProducts",
  "showMore",
  "refineSearch",
  "getProduct",
  "compareProducts",
  "compareSellers",
  "buyProduct",
  "clarifyIntent",
  "webSearch",
  "webFetch",
] as const;

export function buildTrack1Agent(ctx: Track1BuildContext): Track1Build {
  const chatSeed = hashStringToSeed(ctx.chatId || "default-chat");
  const memo: SearchMemo = {
    lastProductIds: ctx.initialMemo?.lastProductIds ?? [],
    lastProducts: ctx.initialMemo?.lastProducts,
    lastFilters: ctx.initialMemo?.lastFilters,
    lastQuery: ctx.initialMemo?.lastQuery,
  };
  const personality = pickPersonalityHint(chatSeed);

  const tools = {
    searchProducts: createSearchProductsTool({ chatSeed, memo }),
    displayProducts: createDisplayProductsTool({ memo }),
    showMore: createShowMoreTool({ chatSeed, memo }),
    refineSearch: createRefineSearchTool({ chatSeed, memo }),
    getProduct,
    compareProducts,
    compareSellers,
    buyProduct,
    clarifyIntent,
    webSearch,
    webFetch,
  };

  const systemPrompt = `${track1SystemPrompt}\n\n# This chat\nagentSeed: ${chatSeed}\nPersonality hint: ${personality}`;

  return {
    systemPrompt,
    tools,
    activeToolNames: ACTIVE_TOOL_NAMES,
  };
}

// Static "definition" used for legacy registry entries. The real per-chat build
// happens in buildTrack1Agent at request time.
export const track1ShoppingAgent = {
  id: "track1-shopping" as const,
  name: "AI Shopping Agent",
  description: "Helps shoppers discover, compare, and buy across Shopify",
  systemPrompt: track1SystemPrompt,
  tools: {} as Record<string, unknown>,
  activeToolNames: ACTIVE_TOOL_NAMES,
};

export type Track1Tools = ReturnType<typeof buildTrack1Agent>["tools"];

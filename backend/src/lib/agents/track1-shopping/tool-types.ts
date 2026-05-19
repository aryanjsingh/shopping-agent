/**
 * Static tool references used purely for type inference (InferUITool).
 * Per-chat instances are built fresh in buildTrack1Agent — but the schemas
 * are identical, so we can safely use these as type donors.
 */

import { buyProduct } from "./tools/buy-product";
import { clarifyIntent } from "./tools/clarify-intent";
import { compareProducts } from "./tools/compare-products";
import { compareSellers } from "./tools/compare-sellers";
import { getProduct } from "./tools/get-product";
import { createSearchProductsTool } from "./tools/search-products";
import { createShowMoreTool } from "./tools/show-more";
import { createRefineSearchTool } from "./tools/refine-search";
import { webSearch } from "./tools/web-search";
import { webFetch } from "./tools/web-fetch";

const _staticCtx = { chatSeed: 1, memo: { lastProductIds: [] } };

export const track1ToolTypes = {
  searchProducts: createSearchProductsTool(_staticCtx),
  showMore: createShowMoreTool(_staticCtx),
  refineSearch: createRefineSearchTool(_staticCtx),
  getProduct,
  compareProducts,
  compareSellers,
  buyProduct,
  clarifyIntent,
  webSearch,
  webFetch,
};

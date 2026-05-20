import "server-only";

import { backendJson } from "@/lib/backend/client";
import type {
  FeedRecommendationsResponse,
  FeedSearchResponse,
} from "./types";

/**
 * The recommendation/search caching is owned by the backend (Redis via
 * `getOrSet`). The frontend just calls the backend each render; the underlying
 * cache makes that nearly free. We pass `auth: false` because the feed isn't
 * user-scoped — only the backend's internal token is enforced.
 */

const FALLBACK_RECS: FeedRecommendationsResponse = {
  category: {
    slug: "headphones",
    label: "Wireless headphones",
    query: "wireless noise canceling headphones",
  },
  categories: [],
  products: [],
  cachedAt: new Date(0).toISOString(),
};

const FALLBACK_SEARCH = (query: string): FeedSearchResponse => ({
  query,
  products: [],
  cachedAt: new Date(0).toISOString(),
});

export async function fetchRecommendations(
  categorySlug?: string
): Promise<FeedRecommendationsResponse> {
  const search = categorySlug
    ? `?category=${encodeURIComponent(categorySlug)}`
    : "";
  try {
    return await backendJson<FeedRecommendationsResponse>(
      `/api/feed/recommendations${search}`,
      {},
      { auth: false }
    );
  } catch (error) {
    console.warn("[feed] recommendations request failed", error);
    return FALLBACK_RECS;
  }
}

export async function fetchSearch(query: string): Promise<FeedSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return FALLBACK_SEARCH("");
  }
  try {
    return await backendJson<FeedSearchResponse>(
      `/api/feed/search?q=${encodeURIComponent(trimmed)}`,
      {},
      { auth: false }
    );
  } catch (error) {
    console.warn("[feed] search request failed", error);
    return FALLBACK_SEARCH(trimmed);
  }
}

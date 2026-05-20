import { cacheGet, cacheSet } from "./cache";
import { searchCatalog, type CatalogProduct } from "./shopify/catalog";

/**
 * Recommendation feed for the homepage.
 *
 * Design notes:
 * - The homepage must NOT call the chat agent. It picks one Shopify category
 *   per day and caches the resulting product set in Redis.
 * - Search results are cached separately with a shorter TTL so popular queries
 *   stay snappy without going stale for too long.
 * - Cache values are minimal `FeedProduct` rows so the network payload is
 *   small and the frontend can render cards without further mapping.
 */

export const FEED_CATEGORIES = [
  {
    slug: "headphones",
    label: "Wireless headphones",
    query: "wireless noise canceling headphones",
  },
  {
    slug: "espresso",
    label: "Espresso machines",
    query: "compact espresso machine home",
  },
  {
    slug: "running-shoes",
    label: "Running shoes",
    query: "running shoes neutral lightweight",
  },
  {
    slug: "backpacks",
    label: "Everyday backpacks",
    query: "everyday backpack laptop commuter",
  },
  {
    slug: "smartwatches",
    label: "Smartwatches",
    query: "smartwatch fitness tracker",
  },
  {
    slug: "kitchen-knives",
    label: "Kitchen knives",
    query: "chef knife stainless steel",
  },
  {
    slug: "yoga-mats",
    label: "Yoga mats",
    query: "non slip yoga mat",
  },
  {
    slug: "earbuds",
    label: "Wireless earbuds",
    query: "bluetooth wireless earbuds",
  },
  {
    slug: "lamps",
    label: "Reading lamps",
    query: "modern desk reading lamp warm",
  },
  {
    slug: "houseplants",
    label: "Indoor plants",
    query: "potted indoor plant low maintenance",
  },
  {
    slug: "sunglasses",
    label: "Sunglasses",
    query: "polarized sunglasses unisex",
  },
  {
    slug: "speakers",
    label: "Bluetooth speakers",
    query: "portable bluetooth speaker waterproof",
  },
  {
    slug: "desk-chairs",
    label: "Office chairs",
    query: "ergonomic mesh office chair",
  },
  {
    slug: "cookware",
    label: "Cookware sets",
    query: "non stick cookware set",
  },
  {
    slug: "winter-boots",
    label: "Winter boots",
    query: "waterproof winter boots insulated",
  },
  {
    slug: "leather-jackets",
    label: "Leather jackets",
    query: "classic leather jacket",
  },
] as const;

export type FeedCategory = (typeof FEED_CATEGORIES)[number];
export type FeedCategorySlug = FeedCategory["slug"];

const FEED_RECS_TTL_SECONDS = 60 * 60; // 1 hour
const FEED_SEARCH_TTL_SECONDS = 5 * 60; // 5 minutes
const FEED_PRODUCT_LIMIT = 12;

export type FeedProduct = {
  id: string;
  title: string;
  description?: string;
  image?: { url: string; alt?: string };
  price: { amount: number; currency: string; formatted: string };
  url: string;
  shopName?: string;
  rating?: { value: number; count: number };
};

export type FeedRecommendationsResponse = {
  category: FeedCategory;
  categories: readonly FeedCategory[];
  products: FeedProduct[];
  cachedAt: string;
};

export type FeedSearchResponse = {
  query: string;
  products: FeedProduct[];
  cachedAt: string;
};

/** Daily rotation keeps the cache hot for everyone visiting on the same day. */
function pickDailyCategoryIndex(now = new Date()) {
  const epochDays = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return epochDays % FEED_CATEGORIES.length;
}

export function pickFeedCategory(slug?: string): FeedCategory {
  if (slug) {
    const match = FEED_CATEGORIES.find((entry) => entry.slug === slug);
    if (match) {
      return match;
    }
  }
  return FEED_CATEGORIES[pickDailyCategoryIndex()];
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

function pickHref(product: CatalogProduct): string {
  const variant =
    product.variants.find((entry) => entry.checkoutUrl || entry.variantUrl) ??
    product.variants[0];
  return (
    variant?.checkoutUrl ||
    variant?.variantUrl ||
    product.lookupUrl ||
    variant?.shop.onlineStoreUrl ||
    ""
  );
}

function toFeedProduct(product: CatalogProduct): FeedProduct {
  const cheapest = [...product.variants].sort(
    (a, b) => a.price.amount - b.price.amount
  )[0];
  const price = cheapest?.price ?? product.priceRange.min;
  const image = product.media[0] ?? cheapest?.media[0];

  return {
    id: product.id,
    title: product.title,
    description: product.description ? product.description.slice(0, 240) : undefined,
    image: image ? { url: image.url, alt: image.altText } : undefined,
    price: {
      amount: price.amount,
      currency: price.currency,
      formatted: formatMoney(price.amount, price.currency),
    },
    url: pickHref(product),
    shopName: cheapest?.shop.name,
    rating: product.rating
      ? { value: product.rating.rating, count: product.rating.count }
      : undefined,
  };
}

export async function getRecommendedFeed(
  slug?: string,
  options: { refresh?: boolean } = {}
): Promise<FeedRecommendationsResponse> {
  const category = pickFeedCategory(slug);
  const cacheKey = `feed:recs:v1:${category.slug}`;

  if (!options.refresh) {
    const cached = await cacheGet<Omit<FeedRecommendationsResponse, "categories">>(
      cacheKey
    );
    // Only trust the cache if it actually contains products. An empty list is
    // most likely a transient MCP failure that we don't want pinned for 1h.
    if (cached && cached.products.length > 0) {
      return { ...cached, categories: FEED_CATEGORIES };
    }
  }

  const products = await searchCatalog({
    query: category.query,
    limit: FEED_PRODUCT_LIMIT,
  }).catch((error) => {
    console.warn("[feed] recommendations fetch failed", error);
    return [] as CatalogProduct[];
  });

  const fresh = {
    category,
    products: products.map(toFeedProduct).filter((entry) => entry.image?.url),
    cachedAt: new Date().toISOString(),
  };

  if (fresh.products.length > 0) {
    await cacheSet(cacheKey, fresh, FEED_RECS_TTL_SECONDS);
  }

  return { ...fresh, categories: FEED_CATEGORIES };
}

export async function searchFeed(
  rawQuery: string,
  options: { refresh?: boolean } = {}
): Promise<FeedSearchResponse> {
  const query = rawQuery.trim().slice(0, 80);
  if (!query) {
    return { query: "", products: [], cachedAt: new Date().toISOString() };
  }

  const cacheKey = `feed:search:v1:${query.toLowerCase()}`;

  if (!options.refresh) {
    const cached = await cacheGet<FeedSearchResponse>(cacheKey);
    if (cached && cached.products.length > 0) {
      return cached;
    }
  }

  const products = await searchCatalog({
    query,
    limit: FEED_PRODUCT_LIMIT,
  }).catch((error) => {
    console.warn("[feed] search fetch failed", error);
    return [] as CatalogProduct[];
  });

  const fresh: FeedSearchResponse = {
    query,
    products: products.map(toFeedProduct).filter((entry) => entry.image?.url),
    cachedAt: new Date().toISOString(),
  };

  if (fresh.products.length > 0) {
    await cacheSet(cacheKey, fresh, FEED_SEARCH_TTL_SECONDS);
  }

  return fresh;
}

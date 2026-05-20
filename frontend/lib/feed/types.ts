export type FeedCategory = {
  slug: string;
  label: string;
  query: string;
};

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
  categories: FeedCategory[];
  products: FeedProduct[];
  cachedAt: string;
};

export type FeedSearchResponse = {
  query: string;
  products: FeedProduct[];
  cachedAt: string;
};

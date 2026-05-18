const MCP_ENDPOINT =
  process.env.SHOPIFY_CATALOG_MCP_URL ??
  "https://catalog.shopify.com/api/ucp/mcp";

const AGENT_PROFILE =
  process.env.SHOPIFY_UCP_AGENT_PROFILE ??
  "https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json";

type UcpMoney = { amount?: number; currency?: string };
type UcpText = string | { html?: string; plain?: string } | null | undefined;

type UcpMedia = {
  url?: string;
  alt_text?: string;
  altText?: string;
};

type UcpSeller = {
  id?: string;
  name?: string;
  url?: string;
  domain?: string;
};

type UcpVariant = {
  id?: string;
  product_id?: string;
  productId?: string;
  title?: string;
  display_name?: string;
  displayName?: string;
  available_for_sale?: boolean;
  availableForSale?: boolean;
  availability?: { available?: boolean; status?: string };
  price?: UcpMoney;
  media?: UcpMedia[];
  options?: { name?: string; label?: string; value?: string }[];
  seller?: UcpSeller;
  shop?: UcpSeller;
  url?: string;
  variant_url?: string;
  checkout_url?: string;
  condition?: string[];
};

type UcpProduct = {
  id?: string;
  title?: string;
  description?: UcpText;
  url?: string;
  uniqueSellingPoint?: string;
  unique_selling_point?: string;
  topFeatures?: string[];
  top_features?: string[];
  techSpecs?: string[];
  tech_specs?: string[];
  attributes?: { name?: string; value?: string }[];
  media?: UcpMedia[];
  price_range?: { min?: UcpMoney; max?: UcpMoney };
  priceRange?: { min?: UcpMoney; max?: UcpMoney };
  rating?: { rating?: number; value?: number; count?: number };
  variants?: UcpVariant[];
};

type McpResponse<T> = {
  result?: {
    structuredContent?: T;
    content?: { type?: string; text?: string }[];
  };
  error?: { code?: number; message?: string; data?: unknown };
};

type CatalogPayload = {
  products?: UcpProduct[];
  product?: UcpProduct;
  messages?: { type?: string; code?: string; content?: string }[];
};

export type CatalogMoney = { amount: number; currency: string };

export type CatalogShop = {
  id: string;
  name: string;
  onlineStoreUrl?: string;
};

export type CatalogVariant = {
  id: string;
  productId: string;
  displayName: string;
  availableForSale: boolean;
  price: CatalogMoney;
  media: { url: string; altText?: string }[];
  options: { name: string; value: string }[];
  shop: CatalogShop;
  variantUrl: string;
  checkoutUrl: string;
  secondhand: boolean;
  lookupUrl: string;
};

export type CatalogProduct = {
  id: string;
  title: string;
  description: string;
  uniqueSellingPoint?: string;
  topFeatures?: string[];
  techSpecs?: string[];
  attributes?: { name: string; value: string }[];
  media: { url: string; altText?: string }[];
  priceRange: { min: CatalogMoney; max: CatalogMoney };
  rating?: { rating: number; count: number };
  lookupUrl: string;
  variants: CatalogVariant[];
};

export type SearchOptions = {
  query: string;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  shipsTo?: string;
  queryPrefix?: string;
};

let requestId = 0;

async function callCatalogTool<T>(
  name: "search_catalog" | "lookup_catalog" | "get_product",
  catalog: Record<string, unknown>
): Promise<T> {
  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++requestId,
      method: "tools/call",
      params: {
        name,
        arguments: {
          meta: {
            "ucp-agent": {
              profile: AGENT_PROFILE,
            },
          },
          catalog,
        },
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Shopify Catalog MCP ${name} failed (${res.status}): ${body}`
    );
  }

  const payload = (await res.json()) as McpResponse<T>;

  if (payload.error) {
    throw new Error(
      `Shopify Catalog MCP ${name} failed: ${payload.error.message ?? "unknown error"}`
    );
  }

  if (!payload.result?.structuredContent) {
    const text = payload.result?.content?.map((item) => item.text).join("\n");
    throw new Error(text || `Shopify Catalog MCP ${name} returned no data`);
  }

  return payload.result.structuredContent;
}

export async function searchCatalog(
  opts: SearchOptions
): Promise<CatalogProduct[]> {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 12);
  const filters: Record<string, unknown> = { available: true };

  if (opts.minPrice !== undefined || opts.maxPrice !== undefined) {
    filters.price = {
      ...(opts.minPrice === undefined ? {} : { min: opts.minPrice }),
      ...(opts.maxPrice === undefined ? {} : { max: opts.maxPrice }),
    };
  }

  if (opts.shipsTo) {
    filters.ships_to = { country: opts.shipsTo };
  }

  const payload = await callCatalogTool<CatalogPayload>("search_catalog", {
    query: opts.queryPrefix ? `${opts.queryPrefix} ${opts.query}` : opts.query,
    context: {
      address_country: opts.shipsTo ?? "US",
      currency: "USD",
    },
    filters,
    pagination: { first: limit },
  });

  return (payload.products ?? [])
    .map(normalizeProduct)
    .filter((product): product is CatalogProduct => Boolean(product));
}

export async function lookupProduct(
  productId: string
): Promise<CatalogProduct | null> {
  const payload = await callCatalogTool<CatalogPayload>("get_product", {
    id: productId,
    context: { address_country: "US", currency: "USD" },
  }).catch(async () => {
    const lookupPayload = await callCatalogTool<CatalogPayload>(
      "lookup_catalog",
      {
        ids: [productId],
        context: { address_country: "US", currency: "USD" },
      }
    );
    return {
      ...lookupPayload,
      product: lookupPayload.products?.[0],
    };
  });

  return payload.product ? normalizeProduct(payload.product) : null;
}

function normalizeProduct(product: UcpProduct): CatalogProduct | null {
  if (!(product.id && product.title)) {
    return null;
  }

  const variants = (product.variants ?? [])
    .map((variant) => normalizeVariant(variant, product.id ?? ""))
    .filter((variant): variant is CatalogVariant => Boolean(variant));
  const priceRange = product.priceRange ?? product.price_range;
  const fallbackPrice = variants[0]?.price ?? { amount: 0, currency: "USD" };
  const ratingValue = product.rating?.rating ?? product.rating?.value;

  return {
    id: product.id,
    title: product.title,
    description: readText(product.description),
    uniqueSellingPoint:
      product.uniqueSellingPoint ?? product.unique_selling_point,
    topFeatures: product.topFeatures ?? product.top_features ?? [],
    techSpecs: product.techSpecs ?? product.tech_specs ?? [],
    attributes: (product.attributes ?? [])
      .filter((item) => item.name && item.value)
      .map((item) => ({ name: item.name ?? "", value: item.value ?? "" })),
    media: normalizeMedia(product.media),
    priceRange: {
      min: normalizeMoney(priceRange?.min, fallbackPrice),
      max: normalizeMoney(priceRange?.max, fallbackPrice),
    },
    rating:
      typeof ratingValue === "number"
        ? { rating: ratingValue, count: product.rating?.count ?? 0 }
        : undefined,
    lookupUrl: product.url ?? "",
    variants,
  };
}

function normalizeVariant(
  variant: UcpVariant,
  productId: string
): CatalogVariant | null {
  if (!variant.id) {
    return null;
  }

  const seller = variant.seller ?? variant.shop ?? {};
  const sellerName = seller.name ?? seller.domain ?? "Shopify merchant";
  const available =
    variant.availability?.available ??
    variant.availableForSale ??
    variant.available_for_sale ??
    true;

  return {
    id: variant.id,
    productId: variant.productId ?? variant.product_id ?? productId,
    displayName:
      variant.displayName ?? variant.display_name ?? variant.title ?? "Default",
    availableForSale: available,
    price: normalizeMoney(variant.price, { amount: 0, currency: "USD" }),
    media: normalizeMedia(variant.media),
    options: (variant.options ?? []).map((option) => ({
      name: option.name ?? "Option",
      value: option.value ?? option.label ?? "",
    })),
    shop: {
      id: seller.id ?? sellerName,
      name: sellerName,
      onlineStoreUrl: seller.url,
    },
    variantUrl: variant.variant_url ?? variant.url ?? seller.url ?? "",
    checkoutUrl: variant.checkout_url ?? "",
    secondhand: variant.condition?.includes("secondhand") ?? false,
    lookupUrl: variant.url ?? "",
  };
}

function normalizeMoney(
  value: UcpMoney | undefined,
  fallback: CatalogMoney
): CatalogMoney {
  return {
    amount: typeof value?.amount === "number" ? value.amount : fallback.amount,
    currency: value?.currency ?? fallback.currency,
  };
}

function normalizeMedia(media: UcpMedia[] | undefined) {
  return (media ?? [])
    .filter((item) => item.url)
    .map((item) => ({
      url: item.url ?? "",
      altText: item.altText ?? item.alt_text,
    }));
}

function readText(value: UcpText): string {
  if (typeof value === "string") {
    return value;
  }
  return value?.plain ?? value?.html?.replace(/<[^>]*>/g, " ") ?? "";
}

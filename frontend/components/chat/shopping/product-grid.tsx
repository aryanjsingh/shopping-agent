"use client";

import {
  ExternalLinkIcon,
  ShoppingCartIcon,
  StarIcon,
  StoreIcon,
} from "lucide-react";
import { formatMoney, formatRating } from "./format";

type Seller = {
  shopId: string;
  shopName: string;
  price: number;
  currency: string;
  checkoutUrl: string;
  variantId: string;
};

type Product = {
  id: string;
  title: string;
  description: string;
  uniqueSellingPoint?: string;
  topFeatures: string[];
  techSpecs: string[];
  media: { url: string; altText?: string }[];
  priceRange: {
    min: { amount: number; currency: string };
    max: { amount: number; currency: string };
  };
  rating?: { rating: number; count: number };
  sellers: Seller[];
  primaryCheckoutUrl: string;
};

export function ProductGrid({
  products,
  query,
}: {
  products: Product[];
  query: string;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-muted-foreground text-sm">
        No matches for <span className="font-medium">{query}</span>. Try a
        different keyword or relaxed budget.
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const cheapest = product.sellers[0];
  const image = product.media[0]?.url;
  const feature = product.topFeatures[0] ?? product.uniqueSellingPoint;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm transition hover:border-border">
      {image ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/40">
          {/* biome-ignore lint/performance/noImgElement: Shopify Catalog images must be rendered live, not cached through an optimizer. */}
          <img
            alt={product.media[0]?.altText ?? product.title}
            className="size-full object-contain p-2"
            src={image}
          />
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted/40">
          <ShoppingCartIcon className="size-8 text-muted-foreground" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="line-clamp-2 font-medium text-[13px] leading-snug">
          {product.title}
        </div>
        {product.rating ? (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <StarIcon className="size-3 fill-amber-400 text-amber-400" />
            {formatRating(product.rating.rating, product.rating.count)}
          </div>
        ) : null}
        {feature ? (
          <div className="line-clamp-2 text-[12px] text-muted-foreground">
            {feature}
          </div>
        ) : null}
        {product.sellers.length > 0 ? (
          <div className="inline-flex w-fit items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            <StoreIcon className="size-3" />
            {product.sellers.length} seller
            {product.sellers.length === 1 ? "" : "s"}
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex flex-col">
            <span className="font-semibold text-[14px]">
              {formatMoney(
                product.priceRange.min.amount,
                product.priceRange.min.currency
              )}
            </span>
            {cheapest ? (
              <span className="text-[10px] text-muted-foreground">
                via {cheapest.shopName}
              </span>
            ) : null}
          </div>
          {product.primaryCheckoutUrl ? (
            <a
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 font-medium text-[11px] text-primary-foreground transition hover:bg-primary/90"
              href={product.primaryCheckoutUrl}
              rel="noreferrer noopener"
              target="_blank"
            >
              Checkout
              <ExternalLinkIcon className="size-3" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

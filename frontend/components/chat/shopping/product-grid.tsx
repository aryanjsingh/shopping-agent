"use client";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  ShoppingCartIcon,
  StarIcon,
  StoreIcon,
} from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
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
  productUrl?: string;
  primaryCheckoutUrl: string;
};

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="w-full">
      <div className="rounded-lg border border-border/60 bg-background/95 p-2 shadow-[var(--shadow-float)] backdrop-blur">
        <div className="mb-2 flex items-center justify-between px-1">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: count }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
            <div
              key={i}
              className="w-[168px] shrink-0 overflow-hidden rounded-lg border border-border/60 bg-card"
            >
              <Skeleton className="h-[118px] w-full rounded-none" />
              <div className="flex flex-col gap-2 p-2.5">
                <Skeleton className="h-3.5 w-5/6 rounded-md" />
                <Skeleton className="h-3 w-1/2 rounded-md" />
                <Skeleton className="h-3 w-2/3 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  query,
}: {
  products: Product[];
  query: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-muted-foreground text-sm">
        No matches for <span className="font-medium">{query}</span>. Try a
        different keyword or relaxed budget.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="group/products overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-[var(--shadow-float)] backdrop-blur">
        <button
          aria-expanded={isOpen}
          className="flex h-10 w-full cursor-pointer items-center justify-between gap-3 px-3 text-left transition hover:bg-muted/50"
          onClick={() => setIsOpen((value) => !value)}
          type="button"
        >
          <span className="min-w-0 truncate font-medium text-[13px]">
            Explore products
            <span className="ml-2 font-normal text-muted-foreground">
              {products.length} for {query}
            </span>
          </span>
          {isOpen ? (
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        {isOpen ? (
          <div className="border-border/50 border-t p-2">
            <div className="flex snap-x gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] group-hover/products:[scrollbar-color:var(--muted-foreground)_transparent] group-focus-within/products:[scrollbar-color:var(--muted-foreground)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent group-hover/products:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 group-focus-within/products:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/35">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const cheapest = product.sellers[0];
  const image = product.media[0]?.url;
  const feature = product.topFeatures[0] ?? product.uniqueSellingPoint;
  const [imgLoaded, setImgLoaded] = useState(false);
  const href = product.productUrl || product.primaryCheckoutUrl;
  const CardElement = href ? "a" : "div";

  return (
    <CardElement
      className="group relative flex w-[168px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border/60 bg-card text-card-foreground shadow-sm outline-none transition hover:border-border hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring"
      {...(href
        ? {
            href,
            rel: "noreferrer noopener",
            target: "_blank",
          }
        : {})}
    >
      <div className="relative h-[118px] w-full overflow-hidden bg-muted/40">
        {image ? (
          <>
            {!imgLoaded && (
              <Skeleton className="absolute inset-0 rounded-none" />
            )}
            {/* biome-ignore lint/performance/noImgElement: Shopify Catalog images must be rendered live, not cached through an optimizer. */}
            <img
              alt={product.media[0]?.altText ?? product.title}
              className={`size-full object-contain p-2 transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              src={image}
            />
          </>
        ) : (
          <div className="flex size-full items-center justify-center">
            <ShoppingCartIcon className="size-8 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="line-clamp-2 font-medium text-[12px] leading-snug">
          {product.title}
        </div>
        {product.rating ? (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <StarIcon className="size-3 fill-amber-400 text-amber-400" />
            {formatRating(product.rating.rating, product.rating.count)}
          </div>
        ) : null}
        {feature ? (
          <div className="line-clamp-2 text-[11px] text-muted-foreground">
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
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
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
          {href ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1.5 font-medium text-[10px] text-primary-foreground transition group-hover:bg-primary/90">
              Open
              <ExternalLinkIcon className="size-3" />
            </span>
          ) : null}
        </div>
      </div>
    </CardElement>
  );
}

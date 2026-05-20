"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  ImageOffIcon,
  ShoppingCartIcon,
  StarIcon,
  StoreIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMoney, formatRating } from "./format";
import { getExternalHref } from "./link-utils";

type Seller = {
  shopId: string;
  shopName: string;
  shopUrl?: string;
  price: number;
  currency: string;
  checkoutUrl: string;
  productUrl?: string;
  variantId: string;
};

export type Product = {
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

function preserveChatScroll() {
  window.dispatchEvent(new Event("chat-preserve-scroll"));
}

export function getProductHref(product: Product) {
  const seller =
    product.sellers.find((item) =>
      getExternalHref(item.checkoutUrl, item.productUrl, item.shopUrl)
    ) ?? product.sellers[0];
  return getExternalHref(
    product.primaryCheckoutUrl,
    seller?.checkoutUrl,
    seller?.productUrl,
    product.productUrl,
    seller?.shopUrl
  );
}

function getSellerHref(seller: Seller) {
  return getExternalHref(seller.checkoutUrl, seller.productUrl, seller.shopUrl);
}

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  const skeletonKeys = Array.from(
    { length: count },
    (_, index) => `product-grid-skeleton-${count}-${index}`
  );

  return (
    <div className="w-full">
      <div className="rounded-lg border border-border/60 bg-background/95 p-2 shadow-[var(--shadow-float)] backdrop-blur">
        <div className="mb-2 flex items-center justify-between px-1">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {skeletonKeys.map((key) => (
            <div
              className="w-[168px] shrink-0 overflow-hidden rounded-lg border border-border/60 bg-card"
              key={key}
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
  defaultOpen = true,
  products,
  query,
}: {
  defaultOpen?: boolean;
  products: Product[];
  query: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [expandedProduct, setExpandedProduct] = useState<Product | null>(null);

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-muted-foreground text-sm">
        No matches for <span className="font-medium">{query}</span>. Try a
        different keyword or relaxed budget.
      </div>
    );
  }

  return (
    <div className="block w-full [overflow-anchor:none]">
      <div className="w-full">
        <div className="group/products overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-[var(--shadow-float)] backdrop-blur">
          <button
            aria-expanded={isOpen}
            className="flex h-10 w-full cursor-pointer items-center justify-between gap-3 px-3 text-left transition hover:bg-muted/50"
            onClick={() => {
              preserveChatScroll();
              setIsOpen((value) => !value);
            }}
            type="button"
          >
            <span className="min-w-0 truncate font-medium text-[13px]">
              Explore products
              <span className="ml-2 font-normal text-muted-foreground">
                {products.length} for {query}
              </span>
            </span>
            {isOpen ? (
              <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>

          {isOpen ? (
            <div className="block border-border/50 border-t p-2 [overflow-anchor:none]">
              <div className="flex snap-x gap-3 overflow-x-auto overscroll-x-contain pb-1 pr-2 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] group-hover/products:[scrollbar-color:var(--muted-foreground)_transparent] group-focus-within/products:[scrollbar-color:var(--muted-foreground)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent group-hover/products:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 group-focus-within/products:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/35">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    onExpand={() => setExpandedProduct(product)}
                    product={product}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {expandedProduct && (
        <ProductDetailOverlay
          onClose={() => setExpandedProduct(null)}
          product={expandedProduct}
        />
      )}
    </div>
  );
}

export function ProductHoverPreview({ product }: { product: Product }) {
  const image = product.media[0]?.url;
  const feature =
    product.topFeatures[0] ?? product.uniqueSellingPoint ?? product.description;
  const cheapest = product.sellers[0];

  return (
    <div className="grid gap-3">
      <div className="flex gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/50">
          {image ? (
            // biome-ignore lint/performance/noImgElement: Shopify Catalog images must render directly from live URLs.
            <img
              alt={product.media[0]?.altText ?? product.title}
              className="size-full object-contain p-1.5"
              src={image}
            />
          ) : (
            <ShoppingCartIcon className="size-6 text-muted-foreground/40" />
          )}
        </div>
        <div className="min-w-0">
          <div className="line-clamp-2 font-medium text-[13px] leading-snug">
            {product.title}
          </div>
          <div className="mt-1 font-semibold text-[13px]">
            {formatMoney(
              product.priceRange.min.amount,
              product.priceRange.min.currency
            )}
          </div>
          {cheapest ? (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              via {cheapest.shopName}
            </div>
          ) : null}
        </div>
      </div>
      {feature ? (
        <div className="line-clamp-3 text-[12px] text-muted-foreground">
          {feature}
        </div>
      ) : null}
      {product.topFeatures.length > 1 ? (
        <div className="grid gap-1">
          {product.topFeatures.slice(1, 3).map((item) => (
            <div
              className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
              key={item}
            >
              <CheckIcon className="mt-0.5 size-3 shrink-0 text-emerald-600" />
              <span className="line-clamp-2">{item}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductCard({
  product,
  onExpand,
}: {
  product: Product;
  onExpand: () => void;
}) {
  const cheapest = product.sellers[0];
  const image = product.media[0]?.url;
  const features =
    product.topFeatures.length > 0
      ? product.topFeatures.slice(0, 2)
      : product.uniqueSellingPoint
        ? [product.uniqueSellingPoint]
        : [];
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const href = getProductHref(product);
  const mediaContent = (
    <>
      {image && !imgFailed ? (
        <>
          {!imgLoaded && <Skeleton className="absolute inset-0 rounded-none" />}
          {/* biome-ignore lint/performance/noImgElement lint/a11y/noNoninteractiveElementInteractions: Shopify Catalog images must render live and update fallback state on load failure. */}
          <img
            alt={product.media[0]?.altText ?? product.title}
            className={`size-full object-contain p-2 transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onError={() => setImgFailed(true)}
            onLoad={() => setImgLoaded(true)}
            src={image}
          />
        </>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/45">
          <ImageOffIcon className="size-7" />
          <span className="text-[10px]">No image</span>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/10">
        <span className="translate-y-1 rounded-md bg-white/90 px-2 py-1 font-medium text-[10px] text-black opacity-0 shadow-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 dark:bg-black/80 dark:text-white">
          {href ? "View product" : "Product preview"}
        </span>
      </div>
    </>
  );

  return (
    <div className="group relative flex w-[168px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border/60 bg-card text-card-foreground shadow-sm transition-all duration-200 hover:border-border hover:shadow-md hover:-translate-y-0.5">
      {href ? (
        <a
          aria-label={`View ${product.title}`}
          className="relative block h-[118px] w-full overflow-hidden bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={href}
          rel="noreferrer noopener"
          target="_blank"
        >
          {mediaContent}
        </a>
      ) : (
        <div className="relative block h-[118px] w-full overflow-hidden bg-muted/40">
          {mediaContent}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div
          className="line-clamp-2 break-words font-medium text-[12px] leading-snug"
          title={product.title}
        >
          {truncateAtWord(product.title, 58)}
        </div>
        {product.rating ? (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <StarIcon className="size-3 fill-amber-400 text-amber-400" />
            {formatRating(product.rating.rating, product.rating.count)}
          </div>
        ) : null}
        {features.length > 0 ? (
          <div className="grid gap-1">
            {features.map((feature) => (
              <div
                className="flex min-w-0 items-start gap-1.5 text-[11px] text-muted-foreground"
                key={feature}
              >
                <CheckIcon className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                <span className="line-clamp-2">{feature}</span>
              </div>
            ))}
          </div>
        ) : null}
        {product.sellers.length > 0 ? (
          <div className="inline-flex w-fit items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            <StoreIcon className="size-3" />
            {product.sellers.length} seller
            {product.sellers.length === 1 ? "" : "s"}
          </div>
        ) : null}
        <div className="mt-auto flex flex-col gap-2 pt-1.5">
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-[14px]">
              {formatMoney(
                product.priceRange.min.amount,
                product.priceRange.min.currency
              )}
            </span>
            {cheapest ? (
              <span className="truncate text-[10px] text-muted-foreground" title={`via ${cheapest.shopName}`}>
                via {cheapest.shopName}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              aria-label={`See details for ${product.title}`}
              className={cn(
                "inline-flex items-center justify-center rounded-md bg-muted px-2 py-1.5 font-medium text-[10px] text-muted-foreground transition hover:bg-primary hover:text-primary-foreground",
                href ? "flex-1" : "w-full"
              )}
              onClick={(e) => {
                e.preventDefault();
                onExpand();
              }}
              type="button"
            >
              Details
            </button>
            {href ? (
              <a
                aria-label={`Buy ${product.title}`}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 font-medium text-[10px] text-primary-foreground transition hover:bg-primary/90"
                href={href}
                rel="noreferrer noopener"
                target="_blank"
              >
                Buy
                <ExternalLinkIcon className="size-3" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductDetailOverlay({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const image = product.media[0]?.url;
  const [imgFailed, setImgFailed] = useState(false);
  const href = getProductHref(product);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: overlay backdrop handles click-outside for mouse users; Escape handles keyboard close.
    <div
      aria-label={product.title}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
      ref={overlayRef}
      role="dialog"
    >
      <div
        className={cn(
          "relative w-full max-w-lg overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl",
          "animate-in slide-in-from-bottom-4 duration-300 sm:zoom-in-95"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/50 p-4">
          <div className="flex gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/50">
              {image && !imgFailed ? (
                // biome-ignore lint/performance/noImgElement lint/a11y/noNoninteractiveElementInteractions: Shopify Catalog images must render live and update fallback state on load failure.
                <img
                  alt={product.media[0]?.altText ?? product.title}
                  className="size-full object-contain p-1"
                  onError={() => setImgFailed(true)}
                  src={image}
                />
              ) : (
                <ImageOffIcon className="size-6 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[14px] leading-snug">
                {product.title}
              </div>
              <div className="mt-1 font-bold text-[16px]">
                {formatMoney(
                  product.priceRange.min.amount,
                  product.priceRange.min.currency
                )}
                {product.priceRange.max.amount !==
                  product.priceRange.min.amount && (
                  <span className="ml-1 font-normal text-[12px] text-muted-foreground">
                    –{" "}
                    {formatMoney(
                      product.priceRange.max.amount,
                      product.priceRange.max.currency
                    )}
                  </span>
                )}
              </div>
              {product.rating && (
                <div className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
                  <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                  {formatRating(product.rating.rating, product.rating.count)}
                </div>
              )}
            </div>
          </div>
          <button
            aria-label="Close"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {product.uniqueSellingPoint && (
            <p className="mb-3 text-[13px] text-muted-foreground leading-relaxed">
              {product.uniqueSellingPoint}
            </p>
          )}

          {product.topFeatures.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
                Top Features
              </div>
              <div className="grid gap-1.5">
                {product.topFeatures.map((f) => (
                  <div className="flex items-start gap-2 text-[13px]" key={f}>
                    <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.techSpecs.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
                Specs
              </div>
              <div className="grid gap-1">
                {product.techSpecs.map((s) => (
                  <div className="text-[12px] text-muted-foreground" key={s}>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.sellers.length > 0 && (
            <div className="mb-2">
              <div className="mb-2 font-semibold text-[12px] uppercase tracking-wide text-muted-foreground">
                Available from
              </div>
              <div className="grid gap-2">
                {product.sellers.map((seller, i) => {
                  const sellerHref = getSellerHref(seller);
                  const className = cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2.5 text-[13px] transition",
                    sellerHref ? "hover:bg-muted" : "",
                    i === 0
                      ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
                      : "border-border/50"
                  );
                  const content = (
                    <>
                      <div className="flex items-center gap-2">
                        <StoreIcon className="size-3.5 text-muted-foreground" />
                        <span className="font-medium">{seller.shopName}</span>
                        {i === 0 && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                            Best price
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {formatMoney(seller.price, seller.currency)}
                        </span>
                        {sellerHref ? (
                          <ExternalLinkIcon className="size-3 text-muted-foreground" />
                        ) : null}
                      </div>
                    </>
                  );

                  return sellerHref ? (
                    <a
                      className={className}
                      href={sellerHref}
                      key={seller.variantId}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      {content}
                    </a>
                  ) : (
                    <div className={className} key={seller.variantId}>
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {href && (
          <div className="border-t border-border/50 p-4">
            <a
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-[13px] text-primary-foreground transition hover:bg-primary/90"
              href={href}
              rel="noreferrer noopener"
              target="_blank"
            >
              Shop now
              <ExternalLinkIcon className="size-3.5" />
            </a>
            <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
              Prices shown are estimates and may vary on the merchant's site.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  const truncated = value.slice(0, maxLength + 1);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 24 ? lastSpace : maxLength).trim()}...`;
}

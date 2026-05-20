"use client";

import {
  CheckIcon,
  ExternalLinkIcon,
  ShoppingCartIcon,
  StarIcon,
  StoreIcon,
} from "lucide-react";
import { formatMoney, formatRating } from "./format";
import { getExternalHref } from "./link-utils";

type Variant = {
  id?: string;
  shop?: { name?: string; onlineStoreUrl?: string };
  price?: { amount?: number; currency?: string };
  availableForSale?: boolean;
  checkoutUrl?: string;
  variantUrl?: string;
  productUrl?: string;
};

export type DetailProduct = {
  id?: string;
  title?: string;
  description?: string;
  uniqueSellingPoint?: string;
  topFeatures?: string[];
  techSpecs?: string[];
  media?: { url?: string; altText?: string }[];
  priceRange?: {
    min?: { amount?: number; currency?: string };
    max?: { amount?: number; currency?: string };
  };
  rating?: { rating?: number; count?: number };
  variants?: Variant[];
  lookupUrl?: string;
};

function getVariantHref(variant?: Variant) {
  return getExternalHref(
    variant?.checkoutUrl,
    variant?.productUrl,
    variant?.variantUrl,
    variant?.shop?.onlineStoreUrl
  );
}

export function ProductDetailCard({ product }: { product: DetailProduct }) {
  if (!product?.title) {
    return null;
  }
  const image = product.media?.[0]?.url;
  const minAmount = product.priceRange?.min?.amount ?? 0;
  const minCurrency = product.priceRange?.min?.currency ?? "USD";
  const maxAmount = product.priceRange?.max?.amount ?? minAmount;
  const cheapest = (product.variants ?? [])
    .filter((v) => getVariantHref(v) && v.availableForSale)
    .sort((a, b) => (a.price?.amount ?? 0) - (b.price?.amount ?? 0))[0];
  const cheapestHref = getVariantHref(cheapest);
  const features = (product.topFeatures ?? []).slice(0, 4);
  const specs = (product.techSpecs ?? []).slice(0, 4);

  return (
    <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-border/50 bg-card shadow-[var(--shadow-card)]">
      <div className="flex gap-3 border-border/40 border-b p-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40">
          {image ? (
            // biome-ignore lint/performance/noImgElement: Shopify Catalog images render live
            <img
              alt={product.media?.[0]?.altText ?? product.title}
              className="size-full object-contain p-1.5"
              src={image}
            />
          ) : (
            <ShoppingCartIcon className="size-7 text-muted-foreground/40" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 font-semibold text-[13px] leading-snug">
            {product.title}
          </div>
          <div className="mt-1 font-bold text-[15px]">
            {formatMoney(minAmount, minCurrency)}
            {maxAmount > minAmount ? (
              <span className="ml-1 font-normal text-[12px] text-muted-foreground">
                –{" "}
                {formatMoney(
                  maxAmount,
                  product.priceRange?.max?.currency ?? minCurrency
                )}
              </span>
            ) : null}
          </div>
          {product.rating?.rating ? (
            <div className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
              <StarIcon className="size-3 fill-amber-400 text-amber-400" />
              {formatRating(product.rating.rating, product.rating.count ?? 0)}
            </div>
          ) : null}
        </div>
      </div>

      {(product.uniqueSellingPoint || features.length > 0) && (
        <div className="border-border/40 border-b p-3">
          {product.uniqueSellingPoint ? (
            <div className="mb-2 text-[12.5px] text-foreground/80 leading-relaxed">
              {product.uniqueSellingPoint}
            </div>
          ) : null}
          {features.length > 0 ? (
            <div className="grid gap-1">
              {features.map((f) => (
                <div className="flex items-start gap-1.5 text-[12px]" key={f}>
                  <CheckIcon className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                  <span className="line-clamp-2">{f}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {specs.length > 0 ? (
        <div className="border-border/40 border-b px-3 py-2.5">
          <div className="mb-1.5 font-semibold text-[10.5px] uppercase tracking-wide text-muted-foreground">
            Specs
          </div>
          <div className="grid gap-0.5">
            {specs.map((s) => (
              <div className="text-[11.5px] text-muted-foreground" key={s}>
                {s}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <StoreIcon className="size-3 shrink-0" />
          <span className="truncate">
            {cheapest?.shop?.name
              ? `Best price via ${cheapest.shop.name}`
              : `${product.variants?.length ?? 0} seller${(product.variants?.length ?? 0) === 1 ? "" : "s"}`}
          </span>
        </div>
        {cheapestHref ? (
          <a
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 font-medium text-[11px] text-primary-foreground transition hover:bg-primary/90"
            href={cheapestHref}
            rel="noreferrer noopener"
            target="_blank"
          >
            Buy
            <ExternalLinkIcon className="size-3" />
          </a>
        ) : null}
      </div>
      <div className="px-3 pb-2.5 text-[10px] text-muted-foreground/50">
        Prices are estimates and may vary on the merchant's site.
      </div>
    </div>
  );
}

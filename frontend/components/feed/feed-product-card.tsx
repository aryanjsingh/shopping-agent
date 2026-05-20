"use client";

import { ExternalLinkIcon, ImageOffIcon, MessageCircleIcon, StarIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { buildAskAgentHref } from "@/lib/feed/prompt";
import type { FeedProduct } from "@/lib/feed/types";

type FeedProductCardProps = {
  product: FeedProduct;
};

export function FeedProductCard({ product }: FeedProductCardProps) {
  const buyHref = product.url || undefined;
  const askAgentHref = buildAskAgentHref(product);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
        {buyHref ? (
          <a
            aria-label={`View ${product.title}`}
            className="block size-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={buyHref}
            rel="noreferrer noopener"
            target="_blank"
          >
            <CardImage product={product} />
          </a>
        ) : (
          <div className="block size-full">
            <CardImage product={product} />
          </div>
        )}

        <HoverActions askAgentHref={askAgentHref} buyHref={buyHref} />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {buyHref ? (
          <a
            className="line-clamp-2 break-words font-medium text-[13px] leading-snug outline-none transition-colors hover:text-primary focus-visible:text-primary"
            href={buyHref}
            rel="noreferrer noopener"
            target="_blank"
            title={product.title}
          >
            {product.title}
          </a>
        ) : (
          <div
            className="line-clamp-2 break-words font-medium text-[13px] leading-snug"
            title={product.title}
          >
            {product.title}
          </div>
        )}

        {product.rating ? (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <StarIcon className="size-3 fill-amber-400 text-amber-400" />
            <span>
              {product.rating.value.toFixed(1)} (
              {product.rating.count.toLocaleString()})
            </span>
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="font-semibold text-[15px]">
            {product.price.formatted}
          </span>
          {product.shopName ? (
            <span
              className="inline-flex items-center gap-1 truncate rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              title={product.shopName}
            >
              <StoreIcon className="size-3 shrink-0" />
              <span className="truncate">{product.shopName}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CardImage({ product }: { product: FeedProduct }) {
  if (!product.image?.url) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/45">
        <ImageOffIcon className="size-8" />
        <span className="text-[10px]">No image</span>
      </div>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: Shopify Catalog images render directly from live merchant URLs.
    <img
      alt={product.image.alt ?? product.title}
      className="size-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
      loading="lazy"
      src={product.image.url}
    />
  );
}

function HoverActions({
  buyHref,
  askAgentHref,
}: {
  buyHref?: string;
  askAgentHref: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center gap-2 bg-gradient-to-t from-black/65 via-black/25 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      <Link
        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-card px-2 py-1.5 font-medium text-[11px] text-foreground shadow-sm transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={askAgentHref}
        prefetch
      >
        <MessageCircleIcon className="size-3" />
        Ask agent
      </Link>
      {buyHref ? (
        <a
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 font-medium text-[11px] text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={buyHref}
          rel="noreferrer noopener"
          target="_blank"
        >
          Buy
          <ExternalLinkIcon className="size-3" />
        </a>
      ) : null}
    </div>
  );
}

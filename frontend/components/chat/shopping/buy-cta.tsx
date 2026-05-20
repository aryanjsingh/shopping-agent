"use client";

import { ExternalLinkIcon, ShieldCheckIcon } from "lucide-react";
import { formatMoney } from "./format";
import { getExternalHref } from "./link-utils";

export function BuyCta({
  productTitle,
  shopName,
  price,
  image,
  checkoutUrl,
}: {
  productTitle: string;
  shopName: string;
  price: { amount: number; currency: string };
  image?: string;
  checkoutUrl: string;
}) {
  const href = getExternalHref(checkoutUrl);

  return (
    <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-border/40 bg-card p-3 shadow-sm">
      {image ? (
        // biome-ignore lint/performance/noImgElement: Shopify Catalog images must be rendered live, not cached through an optimizer.
        <img
          alt={productTitle}
          className="size-16 shrink-0 rounded-md bg-muted/40 object-contain p-1"
          src={image}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="line-clamp-2 font-medium text-[13px] leading-snug">
          {productTitle}
        </div>
        <div className="text-[11px] text-muted-foreground">via {shopName}</div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <ShieldCheckIcon className="size-3" />
          Shop Pay checkout
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-semibold text-[14px]">
          {formatMoney(price.amount, price.currency)}
        </span>
        {href ? (
          <a
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground transition hover:bg-primary/90"
            href={href}
            rel="noreferrer noopener"
            target="_blank"
          >
            Checkout
            <ExternalLinkIcon className="size-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

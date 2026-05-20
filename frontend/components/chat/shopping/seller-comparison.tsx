"use client";

import { ExternalLinkIcon } from "lucide-react";
import { formatMoney } from "./format";
import { getExternalHref } from "./link-utils";

type Seller = {
  variantId: string;
  shopName: string;
  shopUrl?: string;
  price: { amount: number; currency: string };
  availableForSale: boolean;
  secondhand: boolean;
  checkoutUrl: string;
  productUrl: string;
};

export function SellerComparison({
  productTitle,
  sellers,
}: {
  productTitle: string;
  sellers: Seller[];
}) {
  if (sellers.length === 0) {
    return null;
  }
  const cheapest = sellers[0];
  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
      <div className="border-border/40 border-b bg-muted/40 px-3 py-2">
        <div className="font-medium text-[12px]">{productTitle}</div>
        <div className="text-[11px] text-muted-foreground">
          {sellers.length} merchant{sellers.length === 1 ? "" : "s"} selling
          this product
        </div>
      </div>
      <ul className="divide-y divide-border/30">
        {sellers.map((seller) => {
          const isBest = seller.variantId === cheapest.variantId;
          const href = getExternalHref(
            seller.checkoutUrl,
            seller.productUrl,
            seller.shopUrl
          );
          return (
            <li
              className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
              key={seller.variantId}
            >
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {seller.shopName}
                  </span>
                  {isBest ? (
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-medium text-[10px] text-emerald-600">
                      Best price
                    </span>
                  ) : null}
                  {seller.secondhand ? (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-medium text-[10px] text-amber-600">
                      Used
                    </span>
                  ) : null}
                  {seller.availableForSale ? null : (
                    <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 font-medium text-[10px] text-red-500">
                      Out of stock
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {formatMoney(seller.price.amount, seller.price.currency)}
                </span>
                {href ? (
                  <a
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 font-medium text-[11px] text-primary-foreground transition hover:bg-primary/90"
                    href={href}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    Buy
                    <ExternalLinkIcon className="size-3" />
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { ExternalLinkIcon, StarIcon, StoreIcon } from "lucide-react";
import { formatMoney, formatRating } from "./format";
import { getExternalHref } from "./link-utils";

type Row = {
  id: string;
  title: string;
  image?: string;
  priceMin: { amount: number; currency: string };
  priceMax: { amount: number; currency: string };
  rating?: { rating: number; count: number };
  topFeatures: string[];
  techSpecs: string[];
  bestCheckoutUrl: string;
  bestSellerName?: string;
  bestSellerPrice?: { amount: number; currency: string };
  sellerCount?: number;
};

export function ComparisonTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return null;
  }
  // Find the cheapest row to badge it.
  const anyRating = rows.some((row) => row.rating);
  const anyFeatures = rows.some((row) => row.topFeatures.length > 0);
  const anySpecs = rows.some((row) => row.techSpecs.length > 0);
  const cheapestId = rows.reduce(
    (best, row) =>
      row.bestSellerPrice &&
      (!best.price || row.bestSellerPrice.amount < best.price)
        ? { id: row.id, price: row.bestSellerPrice.amount }
        : best,
    {
      id: rows[0].id,
      price: rows[0].bestSellerPrice?.amount ?? rows[0].priceMin.amount,
    }
  ).id;
  return (
    <div className="overflow-x-auto rounded-xl border border-border/40 bg-card">
      <table className="w-full min-w-[480px] text-[12px]">
        <thead className="border-border/40 border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="p-3 text-left font-medium">Product</th>
            {rows.map((row) => (
              <th className="p-3 text-left font-medium" key={`h-${row.id}`}>
                <div className="flex items-center gap-1.5">
                  <span className="line-clamp-2 max-w-[180px]">
                    {row.title}
                  </span>
                  {row.id === cheapestId && rows.length > 1 ? (
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
                      Best price
                    </span>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:align-top [&_td]:p-3 [&_tr]:border-border/30 [&_tr]:border-b">
          <tr>
            <td className="font-medium text-muted-foreground">Image</td>
            {rows.map((row) => (
              <td key={`img-${row.id}`}>
                {row.image ? (
                  // biome-ignore lint/performance/noImgElement: Shopify Catalog images must be rendered live, not cached through an optimizer.
                  <img
                    alt={row.title}
                    className="size-20 rounded-md bg-muted/40 object-contain p-1"
                    src={row.image}
                  />
                ) : (
                  <div className="size-20 rounded-md bg-muted" />
                )}
              </td>
            ))}
          </tr>
          <tr>
            <td className="font-medium text-muted-foreground">Price</td>
            {rows.map((row) => (
              <td className="font-semibold" key={`p-${row.id}`}>
                {formatMoney(
                  row.bestSellerPrice?.amount ?? row.priceMin.amount,
                  row.bestSellerPrice?.currency ?? row.priceMin.currency
                )}
                {row.priceMax.amount > row.priceMin.amount ? (
                  <span className="ml-1 font-normal text-muted-foreground">
                    – {formatMoney(row.priceMax.amount, row.priceMax.currency)}
                  </span>
                ) : null}
              </td>
            ))}
          </tr>
          <tr>
            <td className="font-medium text-muted-foreground">Best seller</td>
            {rows.map((row) => (
              <td key={`s-${row.id}`}>
                {row.bestSellerName ? (
                  <span className="inline-flex items-center gap-1 text-foreground/80">
                    <StoreIcon className="size-3 text-muted-foreground" />
                    <span className="line-clamp-1">{row.bestSellerName}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {row.sellerCount && row.sellerCount > 1 ? (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {row.sellerCount} sellers total
                  </div>
                ) : null}
              </td>
            ))}
          </tr>
          {anyRating ? (
            <tr>
              <td className="font-medium text-muted-foreground">Rating</td>
              {rows.map((row) => (
                <td key={`r-${row.id}`}>
                  {row.rating ? (
                    <span className="inline-flex items-center gap-1">
                      <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                      {formatRating(row.rating.rating, row.rating.count)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ))}
            </tr>
          ) : null}
          {anyFeatures ? (
            <tr>
              <td className="font-medium text-muted-foreground">Top features</td>
              {rows.map((row) => (
                <td key={`f-${row.id}`}>
                  {row.topFeatures.length > 0 ? (
                    <ul className="ml-3 list-disc space-y-1">
                      {row.topFeatures.map((f) => (
                        <li className="line-clamp-2" key={f}>
                          {f}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ))}
            </tr>
          ) : null}
          {anySpecs ? (
            <tr>
              <td className="font-medium text-muted-foreground">Specs</td>
              {rows.map((row) => (
                <td key={`spec-${row.id}`}>
                  {row.techSpecs.length > 0 ? (
                    <ul className="ml-3 list-disc space-y-1">
                      {row.techSpecs.map((s) => (
                        <li className="line-clamp-2" key={s}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ))}
            </tr>
          ) : null}
          <tr>
            <td className="font-medium text-muted-foreground">Action</td>
            {rows.map((row) => {
              const href = getExternalHref(row.bestCheckoutUrl);
              return (
                <td key={`b-${row.id}`}>
                  {href ? (
                    <a
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 font-medium text-[11px] text-primary-foreground transition hover:bg-primary/90"
                      href={href}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      Buy
                      {row.bestSellerName ? ` from ${row.bestSellerName}` : ""}
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { ChevronDownIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type WebSearchResult = {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
};

const KIND_LABELS: Record<string, string> = {
  reviews: "expert reviews",
  comparison: "comparisons",
  brand_reputation: "brand reputation",
  price_check: "price check",
  generation_check: "release year check",
  general: "web search",
};

export function WebSearchResults({
  query,
  searchKind,
  results,
  cached,
}: {
  query: string;
  searchKind?: string;
  results: WebSearchResult[];
  cached?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (results.length === 0) return null;
  const label = KIND_LABELS[searchKind ?? "general"] ?? "web search";

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-[var(--shadow-card)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 px-3 text-left text-[12px] transition hover:bg-muted/40"
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <GlobeIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">
            Evidence — {label}
          </span>
          <span className="truncate font-normal text-muted-foreground">
            {results.length} sources for {query}
          </span>
          {cached ? (
            <span className="rounded-sm bg-muted px-1 text-[9px] text-muted-foreground">
              cached
            </span>
          ) : null}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <ul className="grid gap-1 border-border/40 border-t p-2">
          {results.map((r, i) => (
            <li key={`${r.url}-${i}`}>
              <a
                href={r.url}
                rel="noreferrer noopener"
                target="_blank"
                className="group block rounded-md p-2 transition hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="line-clamp-1 font-medium text-[12.5px] text-foreground">
                      {r.title}
                    </div>
                    <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                      {r.displayUrl}
                    </div>
                  </div>
                  <ExternalLinkIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
                {r.snippet ? (
                  <div className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground leading-snug">
                    {r.snippet}
                  </div>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FeedSearchBarProps = {
  defaultQuery?: string;
};

export function FeedSearchBar({ defaultQuery = "" }: FeedSearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultQuery);
  const [isPending, startTransition] = useTransition();

  // Keep the input in sync if the URL is changed externally (back/forward).
  useEffect(() => {
    setValue(defaultQuery);
  }, [defaultQuery]);

  function submit(query: string) {
    const trimmed = query.trim();
    const target = trimmed
      ? `/discovery?q=${encodeURIComponent(trimmed)}`
      : "/discovery";
    startTransition(() => {
      router.push(target);
    });
  }

  return (
    <form
      className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-2 shadow-sm backdrop-blur"
      onSubmit={(event) => {
        event.preventDefault();
        submit(value);
      }}
    >
      <div className="flex flex-1 items-center gap-2 px-2">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <Input
          aria-label="Search Shopify products"
          autoComplete="off"
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          name="q"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search Shopify products — e.g. ergonomic chair, espresso, running shoes"
          type="search"
          value={value}
        />
        {value ? (
          <button
            aria-label="Clear search"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => {
              setValue("");
              submit("");
            }}
            type="button"
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>
      <Button disabled={isPending} size="sm" type="submit">
        {isPending ? "Searching..." : "Search"}
      </Button>
    </form>
  );
}

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FeedGrid, FeedGridSkeleton } from "@/components/feed/feed-grid";
import { FeedSearchBar } from "@/components/feed/feed-search-bar";
import { fetchRecommendations, fetchSearch } from "@/lib/feed/api";

export const metadata = {
  title: "Discovery — Kasparro Shopper",
  description:
    "Browse curated Shopify products and ask the AI shopping agent for help.",
};

type SearchParams = {
  q?: string;
  category?: string;
};

type DiscoveryPageProps = {
  searchParams: Promise<SearchParams>;
};

export default function DiscoveryPage({ searchParams }: DiscoveryPageProps) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/30">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <Link className="font-semibold text-lg tracking-tight" href="/discovery">
          Kasparro Shopper · Discovery
        </Link>
        <Link
          className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1.5 font-medium text-[12px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          href="/"
        >
          Open chat
          <ArrowRightIcon className="size-3" />
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pt-12 pb-8 text-center sm:px-6 sm:pt-20">
        <h1 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
          Discover products you'll love
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground text-sm sm:text-base">
          Browse a fresh pick from Shopify merchants every day, or search for
          anything you have in mind.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <Suspense fallback={<FeedFallback />}>
          <FeedContents searchParamsPromise={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

async function FeedContents({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<SearchParams>;
}) {
  const params = await searchParamsPromise;
  const query = params.q?.trim();
  const slug = params.category?.trim();

  return (
    <div className="flex flex-col gap-8">
      <div className="mx-auto w-full max-w-3xl">
        <FeedSearchBar defaultQuery={query} />
      </div>
      <Suspense
        fallback={<FeedSection title="Loading products..."><FeedGridSkeleton /></FeedSection>}
        key={query ?? `cat:${slug ?? "default"}`}
      >
        {query ? (
          <SearchResults query={query} />
        ) : (
          <Recommendations slug={slug} />
        )}
      </Suspense>
    </div>
  );
}

function FeedFallback() {
  return (
    <div className="flex flex-col gap-8">
      <div className="mx-auto w-full max-w-3xl">
        <FeedSearchBar />
      </div>
      <FeedSection title="Loading products...">
        <FeedGridSkeleton />
      </FeedSection>
    </div>
  );
}

async function Recommendations({ slug }: { slug?: string }) {
  const data = await fetchRecommendations(slug);
  return (
    <FeedSection
      caption={`Showing ${data.products.length} products`}
      title={`Today's pick · ${data.category.label}`}
    >
      <FeedGrid
        emptyMessage="No products available right now. Try again in a few minutes."
        products={data.products}
      />
    </FeedSection>
  );
}

async function SearchResults({ query }: { query: string }) {
  const data = await fetchSearch(query);
  return (
    <FeedSection
      caption={
        data.products.length > 0
          ? `${data.products.length} matches`
          : "No matches"
      }
      title={`Results for "${query}"`}
    >
      <FeedGrid
        emptyMessage={`No matches for "${query}". Try a different keyword.`}
        products={data.products}
      />
    </FeedSection>
  );
}

function FeedSection({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg tracking-tight sm:text-xl">
            {title}
          </h2>
          {caption ? (
            <p className="mt-1 text-muted-foreground text-xs">{caption}</p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";
import type { FeedProduct } from "@/lib/feed/types";
import { FeedProductCard } from "./feed-product-card";

type FeedGridProps = {
  products: FeedProduct[];
  emptyMessage?: string;
};

export function FeedGrid({ products, emptyMessage }: FeedGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/30 p-8 text-center text-muted-foreground text-sm">
        {emptyMessage ?? "No products to show right now."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <FeedProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function FeedGridSkeleton({ count = 8 }: { count?: number }) {
  const keys = Array.from({ length: count }, (_, index) => `feed-skel-${index}`);
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {keys.map((key) => (
        <div
          className="overflow-hidden rounded-xl border border-border/60 bg-card"
          key={key}
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-5/6 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
            <Skeleton className="h-4 w-1/3 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

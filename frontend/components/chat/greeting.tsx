export const Greeting = () => {
  return (
    <div
      className="flex flex-col items-center px-4 animate-[fade-up_0.3s_cubic-bezier(0.22,1,0.36,1)]"
      key="overview"
    >
      <div className="text-balance text-center font-semibold text-2xl text-foreground md:text-3xl">
        What are you shopping for?
      </div>
      <div className="mt-3 max-w-xl text-center text-muted-foreground/80 text-pretty text-sm">
        Search Shopify merchants, compare real offers, and move to checkout when
        a product fits.
      </div>
    </div>
  );
};

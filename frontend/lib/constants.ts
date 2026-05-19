export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = "dummy-password-for-timing-safe-compare";

export const SUGGESTION_POOL: string[] = [
  "Find noise-canceling headphones under $250 for flights",
  "Compare compact espresso machines with easy cleaning",
  "I need a durable backpack for commuting with a laptop",
  "Find running shoes for flat feet under $150",
  "Best gaming phone under $500 — current generation only",
  "Compare iPhone 15 vs Pixel 8 for photography",
  "4K monitor for video editing under $700",
  "Cordless vacuum that handles pet hair",
  "Wireless earbuds with the best noise cancellation",
  "Gift for a coffee lover — under $200",
  "Mechanical keyboard for office use, quiet switches",
  "Smartwatch for tracking sleep — Android compatible",
  "Mid-range mirrorless camera for travel video",
  "Standing desk under $400 for a small apartment",
  "Air purifier for a 300 sqft bedroom",
  "Wi-Fi 6 mesh router for a 3-bedroom house",
  "Compare the new iPad Air vs older iPad Pro",
  "Lightweight carry-on suitcase under $200",
  "Cheapest place to buy AirPods Pro 2",
  "Show me current-gen gaming laptops under $1500",
];

export const suggestions = SUGGESTION_POOL.slice(0, 4);

const GREETING_TITLE = "What are you shopping for?";
const GREETING_SUBTITLE =
  "Search Shopify merchants, compare real offers, and move to checkout when a product fits.";

export function pickSuggestionsForChat(chatId: string, count = 4): string[] {
  void chatId;
  return SUGGESTION_POOL.slice(0, Math.min(count, SUGGESTION_POOL.length));
}

export function pickGreetingForChat(chatId: string): {
  title: string;
  subtitle: string;
} {
  void chatId;
  return {
    title: GREETING_TITLE,
    subtitle: GREETING_SUBTITLE,
  };
}

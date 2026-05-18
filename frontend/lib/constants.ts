export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = "dummy-password-for-timing-safe-compare";

export const suggestions = [
  "Find noise-canceling headphones under $250 for flights",
  "Compare compact espresso machines with easy cleaning",
  "I need a durable backpack for commuting with a laptop",
  "Find running shoes for flat feet under $150",
];

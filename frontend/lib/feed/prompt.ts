import type { FeedProduct } from "./types";

/**
 * Build the first user message we send to the chat agent when a shopper clicks
 * "Ask agent" from a feed product card. The goal is to give the agent enough
 * grounded context (title, price, seller, rating, link, description) to give
 * a useful first answer without an extra MCP round-trip — but the agent is
 * also free to call `getProduct`, `searchProducts`, etc. for more depth.
 */
export function buildAskAgentPrompt(product: FeedProduct): string {
  const lines: string[] = [
    "I'm looking at this Shopify product. Help me decide if it fits.",
    "",
    `**${product.title}**`,
    `- Price: ${product.price.formatted}`,
  ];

  if (product.shopName) {
    lines.push(`- Sold by: ${product.shopName}`);
  }

  if (product.rating) {
    lines.push(
      `- Rating: ${product.rating.value.toFixed(1)} (${product.rating.count.toLocaleString()} reviews)`
    );
  }

  if (product.url) {
    lines.push(`- Product link: ${product.url}`);
  }

  if (product.description) {
    lines.push("", product.description.trim());
  }

  lines.push(
    "",
    "Walk me through the strengths, any tradeoffs I should know, and one or two similar products worth comparing. If you need to know my use case, ask."
  );

  return lines.join("\n");
}

/** Hard cap so the URL stays well under common limits. */
const MAX_PREFILL_LENGTH = 1500;

export function buildAskAgentHref(product: FeedProduct): string {
  const prompt = buildAskAgentPrompt(product).slice(0, MAX_PREFILL_LENGTH);
  return `/?prefill=${encodeURIComponent(prompt)}`;
}

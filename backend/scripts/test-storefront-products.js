import { getShopDomain, loadEnv, requireEnv } from "./env.js";

loadEnv();

const query = `#graphql
  query ProductsPreview {
    products(first: 5) {
      nodes {
        id
        title
        handle
        featuredImage {
          url
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

try {
  const shopDomain = getShopDomain();
  const token = requireEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN");
  const response = await fetch(
    `https://${shopDomain}/api/2026-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query }),
    }
  );

  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(JSON.stringify(payload, null, 2));
  }

  console.log(JSON.stringify(payload.data.products.nodes, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

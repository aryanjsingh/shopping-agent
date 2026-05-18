import { loadEnv } from "./env.js";
import { shopifyAdminRequest } from "./shopify-admin.js";

loadEnv();

try {
  const title = `shopping-agent-${new Date().toISOString()}`;
  const payload = await shopifyAdminRequest(
    "/admin/api/2026-01/storefront_access_tokens.json",
    {
      method: "POST",
      body: JSON.stringify({
        storefront_access_token: {
          title,
        },
      }),
    }
  );

  const token = payload.storefront_access_token;
  console.log(JSON.stringify(token, null, 2));
  console.log("\nAdd this to backend/.env:");
  console.log(`SHOPIFY_STOREFRONT_ACCESS_TOKEN=${token.access_token}`);
} catch (error) {
  console.error(error.message);
  console.error(
    "\nIf this fails with ACCESS_DENIED, confirm the app is installed and has required unauthenticated Storefront API scopes, then reinstall the app."
  );
  process.exitCode = 1;
}

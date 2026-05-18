import { getShopDomain, requireEnv } from "./env.js";

export async function getAdminAccessToken() {
  const existingToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (existingToken) {
    return existingToken;
  }

  const shopDomain = getShopDomain();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: requireEnv("SHOPIFY_CLIENT_ID"),
    client_secret: requireEnv("SHOPIFY_CLIENT_SECRET"),
  });

  const response = await fetch(
    `https://${shopDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Shopify admin token exchange failed (${response.status}): ${JSON.stringify(
        payload
      )}`
    );
  }

  return payload.access_token;
}

export async function shopifyAdminRequest(path, options = {}) {
  const shopDomain = getShopDomain();
  const token = await getAdminAccessToken();

  const response = await fetch(`https://${shopDomain}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Shopify-Access-Token": token,
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Shopify Admin API request failed (${response.status}): ${JSON.stringify(
        payload
      )}`
    );
  }

  return payload;
}

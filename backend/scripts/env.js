import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");

  try {
    const content = readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = line.split("=");
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      process.env[key.trim()] ||= value;
    }
  } catch {
    // .env is optional so scripts can also run with shell-provided env vars.
  }
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to backend/.env.`);
  }
  return value;
}

export function getShopDomain() {
  const shop = requireEnv("SHOPIFY_SHOP")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/\.myshopify\.com$/, "");

  return `${shop}.myshopify.com`;
}

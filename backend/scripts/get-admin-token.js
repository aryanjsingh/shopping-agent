import { loadEnv } from "./env.js";
import { getAdminAccessToken } from "./shopify-admin.js";

loadEnv();

try {
  const token = await getAdminAccessToken();
  console.log(token);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

import "server-only";
import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

async function getClient(): Promise<RedisClientType | null> {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (client?.isOpen) {
    return client;
  }
  if (connecting) {
    return connecting;
  }
  connecting = (async () => {
    const c = createClient({ url: process.env.REDIS_URL }) as RedisClientType;
    c.on("error", (err) => {
      console.warn("[redis] error", err?.message ?? err);
    });
    await c.connect();
    client = c;
    return c;
  })();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const c = await getClient();
    if (!c) {
      return null;
    }
    const raw = await c.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.warn("[redis] get failed", err);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
) {
  try {
    const c = await getClient();
    if (!c) {
      return;
    }
    await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    console.warn("[redis] set failed", err);
  }
}

export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }
  const fresh = await fetcher();
  if (fresh !== undefined && fresh !== null) {
    await cacheSet(key, fresh, ttlSeconds);
  }
  return fresh;
}

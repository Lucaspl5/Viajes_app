// Supports both Upstash Redis (UPSTASH_REDIS_REST_URL) and legacy Vercel KV (KV_REST_API_URL)
export function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export async function getRedis() {
  const cfg = getRedisConfig();
  if (!cfg) return null;
  const { Redis } = await import("@upstash/redis");
  return new Redis(cfg);
}

// Only trip data keys ever get written by the client — anything else is rejected
// so the store endpoint can't be used as free-form key/value storage.
// Accepts both the legacy 3-letter/3-digit codes already issued to existing trips
// and the wider 4/4 codes new trips now generate (see genTripCode).
const KEY_PATTERN = /^(trip|ahorro|checklist|diario|documentos|equipaje|fotos|gastos|ideas|itin|mapa|reservas):[A-Z]{3,4}-[0-9]{3,4}$/;

export function isValidStoreKey(key: unknown): key is string {
  return typeof key === "string" && KEY_PATTERN.test(key);
}

/**
 * Fixed-window rate limit backed by Redis INCR+EXPIRE.
 * Fails open (allows the request) if Redis is unreachable/unconfigured,
 * since this is abuse mitigation, not a hard security boundary.
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<{ ok: boolean; remaining: number }> {
  try {
    const redis = await getRedis();
    if (!redis) return { ok: true, remaining: limit };
    const key = `rl:${bucket}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return { ok: true, remaining: limit };
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

import { getRedis } from "@/lib/redis";

// Single source of truth for "is this trip premium". Lives in its own key so
// clients (which write whole trip blobs through /api/store) can neither grant
// it for free nor wipe it with a stale copy.
export type PremiumRecord = { source: "stripe" | "play" | "legacy"; ref: string; granted_at: number };

const key = (code: string) => `premium:${code}`;
const parse = (raw: unknown) => (typeof raw === "string" ? JSON.parse(raw) : raw);

export async function getPremium(code: string): Promise<PremiumRecord | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const raw = await redis.get(key(code));
  return raw ? (parse(raw) as PremiumRecord) : null;
}

export async function grantPremium(code: string, source: PremiumRecord["source"], ref: string): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;
  if (!(await redis.get(`trip:${code}`))) return false;
  const record: PremiumRecord = { source, ref, granted_at: Date.now() };
  await redis.set(key(code), JSON.stringify(record));
  return true;
}

export async function revokePremium(code: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.del(key(code));
}

const tripCode = (storeKey: string) => (storeKey.startsWith("trip:") ? storeKey.slice(5) : null);

export async function withPremium(storeKey: string, value: unknown): Promise<unknown> {
  const code = tripCode(storeKey);
  if (!code || !value || typeof value !== "object") return value;
  const trip = parse(value) as Record<string, unknown>;
  return { ...trip, premium: (await getPremium(code)) !== null };
}

export function stripPremium(storeKey: string, value: unknown): unknown {
  if (!tripCode(storeKey) || !value || typeof value !== "object") return value;
  const { premium: _ignored, ...rest } = value as Record<string, unknown>;
  return rest;
}

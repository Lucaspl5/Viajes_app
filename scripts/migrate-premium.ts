// One-off: move `trip.premium === true` into the server-only `premium:<CODE>`
// key and strip the field from every trip blob.
// Run: npx tsx --env-file=.env.local scripts/migrate-premium.ts
// Run right after deploying Task 1 (the blob rewrite is a non-atomic read-modify-write).
type RedisLike = {
  scan(cursor: number, opts: { match: string; count?: number }): Promise<[number | string, string[]]>;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
};

const TRIP_CODE_REGEX = /^[A-Z]{3,4}-[0-9]{3,4}$/;

export async function migratePremium(redis: RedisLike) {
  const migrated: string[] = [];
  let cleaned = 0;
  const failed: string[] = [];
  let cursor: number | string = 0;
  do {
    const [next, keys] = await redis.scan(Number(cursor), { match: "trip:*", count: 200 });
    for (const key of keys) {
      try {
        const raw = await redis.get(key);
        const trip = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown> | null;
        if (!trip || !("premium" in trip)) continue;
        const code = key.slice(5);
        if (!TRIP_CODE_REGEX.test(code)) continue;
        if (trip.premium === true && !(await redis.get(`premium:${code}`))) {
          await redis.set(`premium:${code}`, JSON.stringify({ source: "legacy", ref: "migration-2026-09", granted_at: Date.now() }));
          migrated.push(code);
        }
        const { premium: _drop, ...rest } = trip;
        await redis.set(key, rest);
        cleaned++;
      } catch (err) {
        failed.push(key);
      }
    }
    cursor = next;
  } while (Number(cursor) !== 0);
  return { migrated, cleaned, failed };
}

if (process.argv[1]?.endsWith("migrate-premium.ts")) {
  const { getRedis } = await import("../lib/redis");
  const redis = await getRedis();
  if (!redis) throw new Error("Redis no configurado");
  console.log(await migratePremium(redis as unknown as RedisLike));
}

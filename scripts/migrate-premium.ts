// One-off: move `trip.premium === true` into the server-only `premium:<CODE>`
// key and strip the field from every trip blob.
// Run: npx tsx --env-file=.env.local scripts/migrate-premium.ts
type RedisLike = {
  scan(cursor: number, opts: { match: string; count?: number }): Promise<[number | string, string[]]>;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
};

export async function migratePremium(redis: RedisLike) {
  const migrated: string[] = [];
  let cleaned = 0;
  let cursor: number | string = 0;
  do {
    const [next, keys] = await redis.scan(Number(cursor), { match: "trip:*", count: 200 });
    for (const key of keys) {
      const raw = await redis.get(key);
      const trip = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown> | null;
      if (!trip || !("premium" in trip)) continue;
      const code = key.slice(5);
      if (trip.premium === true && !(await redis.get(`premium:${code}`))) {
        await redis.set(`premium:${code}`, JSON.stringify({ source: "legacy", ref: "migration-2026-09", granted_at: Date.now() }));
        migrated.push(code);
      }
      const { premium: _drop, ...rest } = trip;
      await redis.set(key, rest);
      cleaned++;
    }
    cursor = next;
  } while (Number(cursor) !== 0);
  return { migrated, cleaned };
}

if (process.argv[1]?.endsWith("migrate-premium.ts")) {
  const { getRedis } = await import("../lib/redis");
  const redis = await getRedis();
  if (!redis) throw new Error("Redis no configurado");
  console.log(await migratePremium(redis as unknown as RedisLike));
}

// Minimal in-memory stand-in for the Upstash client used in lib/redis.ts.
export function createFakeRedis() {
  const data = new Map<string, unknown>();
  return {
    data,
    async get(key: string) { return data.has(key) ? data.get(key) : null; },
    async set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) {
      if (opts?.nx && data.has(key)) return null;
      data.set(key, typeof value === "string" ? value : JSON.parse(JSON.stringify(value)));
      return "OK";
    },
    async del(key: string) { return data.delete(key) ? 1 : 0; },
    async incr(key: string) { const n = Number(data.get(key) ?? 0) + 1; data.set(key, n); return n; },
    async expire() { return 1; },
    async scan(cursor: number, opts: { match: string; count?: number }) {
      const re = new RegExp("^" + opts.match.replace(/\*/g, ".*") + "$");
      return [0, [...data.keys()].filter((k) => re.test(k))] as [number, string[]];
    },
  };
}
export type FakeRedis = ReturnType<typeof createFakeRedis>;

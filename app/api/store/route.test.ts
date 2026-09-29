import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeRedis, type FakeRedis } from "@/test/fakeRedis";

let redis: FakeRedis;
vi.mock("@/lib/redis", async (orig) => ({ ...(await orig<object>()), getRedis: async () => redis, checkRateLimit: async () => ({ ok: true, remaining: 99 }) }));
const { GET, POST } = await import("./route");

const post = (body: unknown) => POST(new NextRequest("http://x/api/store", { method: "POST", body: JSON.stringify(body) }));
const get = (key: string) => GET(new NextRequest(`http://x/api/store?key=${encodeURIComponent(key)}`));

beforeEach(() => { redis = createFakeRedis(); });

describe("/api/store premium hardening", () => {
  it("a client cannot grant itself premium", async () => {
    await post({ key: "trip:ABCD-1234", value: { name: "Viaje", premium: true } });
    expect(await (await get("trip:ABCD-1234")).json()).toEqual({ name: "Viaje", premium: false });
  });

  it("a stale client write cannot remove paid premium", async () => {
    await post({ key: "trip:ABCD-1234", value: { name: "Viaje" } });
    redis.data.set("premium:ABCD-1234", { source: "stripe", ref: "pi_1", granted_at: 1 });
    await post({ key: "trip:ABCD-1234", value: { name: "Viaje v2", premium: false } });
    expect(await (await get("trip:ABCD-1234")).json()).toEqual({ name: "Viaje v2", premium: true });
  });

  it("premium:* keys are not writable through the store", async () => {
    const res = await post({ key: "premium:ABCD-1234", value: { source: "play" } });
    expect(res.status).toBe(400);
  });
});

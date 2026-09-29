import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeRedis, type FakeRedis } from "@/test/fakeRedis";

let redis: FakeRedis;
vi.mock("@/lib/redis", async (orig) => ({
  ...(await orig<object>()),
  getRedis: async () => redis,
  checkRateLimit: async () => ({ ok: true, remaining: 99 }),
}));
const { POST } = await import("./route");

const ask = () =>
  POST(new NextRequest("http://x/api/ai", {
    method: "POST",
    body: JSON.stringify({ code: "ABCD-1234", system: "s", messages: [{ role: "user", content: "hola" }] }),
  }));

beforeEach(() => {
  redis = createFakeRedis();
  redis.data.set("trip:ABCD-1234", { name: "Viaje" }); // blob carries no premium field
  redis.data.set("ai:usage:ABCD-1234", 50); // well past the free quota
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("data: ok\n\n", { status: 200 })));
});

describe("/api/ai premium lookup", () => {
  it("a trip over the free quota is blocked without premium:<CODE>", async () => {
    expect((await ask()).status).toBe(402);
  });

  it("premium:<CODE> lifts the quota even though the blob has no premium field", async () => {
    redis.data.set("premium:ABCD-1234", { source: "play", ref: "GPA.1", granted_at: 1 });
    expect((await ask()).status).toBe(200);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeRedis, type FakeRedis } from "@/test/fakeRedis";

let redis: FakeRedis;
vi.mock("@/lib/redis", async (orig) => ({ ...(await orig<object>()), getRedis: async () => redis }));
const { getPremium, grantPremium, revokePremium, withPremium, stripPremium } = await import("./premium");

beforeEach(() => {
  redis = createFakeRedis();
  redis.data.set("trip:ABCD-1234", { name: "Navidad", premium: true });
});

describe("premium key", () => {
  it("grant writes premium:<CODE> and requires the trip to exist", async () => {
    expect(await grantPremium("ABCD-1234", "play", "GPA.1")).toBe(true);
    expect(await getPremium("ABCD-1234")).toMatchObject({ source: "play", ref: "GPA.1" });
    expect(await grantPremium("ZZZZ-9999", "play", "GPA.2")).toBe(false);
    expect(redis.data.has("premium:ZZZZ-9999")).toBe(false);
  });

  it("revoke removes it", async () => {
    await grantPremium("ABCD-1234", "stripe", "pi_1");
    await revokePremium("ABCD-1234");
    expect(await getPremium("ABCD-1234")).toBeNull();
  });

  it("GET ignores whatever premium the blob says and uses the key", async () => {
    expect(await withPremium("trip:ABCD-1234", { name: "Navidad", premium: true })).toEqual({ name: "Navidad", premium: false });
    await grantPremium("ABCD-1234", "stripe", "pi_1");
    expect(await withPremium("trip:ABCD-1234", { name: "Navidad", premium: false })).toEqual({ name: "Navidad", premium: true });
  });

  it("non-trip keys and null values pass through untouched", async () => {
    expect(await withPremium("gastos:ABCD-1234", [1, 2])).toEqual([1, 2]);
    expect(await withPremium("trip:ABCD-1234", null)).toBeNull();
  });

  it("POST strips premium from trip blobs only", () => {
    expect(stripPremium("trip:ABCD-1234", { name: "x", premium: true })).toEqual({ name: "x" });
    expect(stripPremium("gastos:ABCD-1234", { premium: true })).toEqual({ premium: true });
  });
});

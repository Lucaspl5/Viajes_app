import { describe, it, expect } from "vitest";
import { createFakeRedis } from "@/test/fakeRedis";
import { migratePremium } from "./migrate-premium";

describe("migratePremium", () => {
  it("moves premium:true into premium:<CODE> and cleans every trip blob", async () => {
    const r = createFakeRedis();
    r.data.set("trip:QYBB-4798", { name: "Navidad 2026", premium: true });
    r.data.set("trip:ABC-123", { name: "Viejo", premium: false });
    r.data.set("gastos:QYBB-4798", [{ premium: true }]);
    const out = await migratePremium(r);
    expect(out.migrated).toEqual(["QYBB-4798"]);
    expect(out.cleaned).toBe(2);
    expect(r.data.get("premium:QYBB-4798")).toMatch(/"source":"legacy"/);
    expect(r.data.get("trip:QYBB-4798")).toEqual({ name: "Navidad 2026" });
    expect(r.data.get("gastos:QYBB-4798")).toEqual([{ premium: true }]);
  });

  it("is idempotent", async () => {
    const r = createFakeRedis();
    r.data.set("trip:QYBB-4798", { name: "N", premium: true });
    await migratePremium(r);
    const again = await migratePremium(r);
    expect(again.migrated).toEqual([]);
    expect(r.data.has("premium:QYBB-4798")).toBe(true);
  });
});

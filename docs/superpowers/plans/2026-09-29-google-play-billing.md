# Bitácora en Google Play con Play Billing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar el premium por viaje (2,99 €) dentro de la app Android de Google Play con Play Billing, manteniendo Stripe en la web, y cerrar el agujero que hoy permite activarse premium gratis.

**Architecture:** La app Android es una TWA (Bubblewrap) que abre la web de Vercel. Dentro de la TWA el cliente cobra con la Digital Goods API + Payment Request (`https://play.google.com/billing`), el servidor verifica la compra con la Google Play Developer API y escribe una clave solo-servidor `premium:<CODE>` en Redis, que pasa a ser la única fuente de verdad del premium (Stripe también la usa). Un cron diario revoca compras anuladas.

**Tech Stack:** Next.js 14 (App Router, TS), Upstash Redis, Vitest (nuevo), `google-auth-library` (nuevo), Bubblewrap CLI (proyecto Android aparte).

**Spec:** `docs/superpowers/specs/2026-09-29-google-play-billing-design.md`

## Global Constraints

- Precio: 2,99 € pago único por viaje; producto Play `premium_viaje`, tipo in-app **consumible**.
- Package name Android: `es.fluxit.bitacora`. Firma con Play App Signing.
- Dentro de la TWA no se renderiza nada de Stripe ni enlaces a pagar fuera.
- El premium solo lo escribe el servidor, en `premium:<CODE>` con `{ source: "stripe" | "play" | "legacy", ref: string, granted_at: number }`.
- Códigos de viaje válidos: `/^[A-Z]{3,4}-[0-9]{3,4}$/` (legacy 3+3 y actuales 4+4).
- Secretos solo en variables de entorno de Vercel (nunca en el repo): `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME`, `CRON_SECRET`, `ANDROID_CERT_SHA256`.
- Avisos operativos al webhook de Telegram existente `https://n8n.fluxit.es/webhook/fluxit-tool-done` (POST JSON `{ tool, status, message }`).
- Rama de trabajo: `claude/review-deploy-vercel-iosite`. Commits en español, con la atribución estándar.

## Review Focus

1. **Un cliente reenvía el viaje entero con `premium: true` (o `false`) por `/api/store`** → no debe cambiar el premium real; el GET devuelve siempre el valor de `premium:<CODE>`. (Task 1)
2. **El mismo `purchaseToken` se envía para dos viajes distintos** → solo el primero se activa; el segundo recibe 409. (Task 4)
3. **La app se cierra entre el pago y la verificación** → al reabrir un viaje dentro de la TWA, la compra sin consumir se verifica y activa el viaje correcto (el guardado antes de pagar). (Task 6)
4. **Compra en estado pendiente (pago en efectivo)** → no se activa ni se consume; se muestra "Pago pendiente" y se reintenta al reabrir. (Tasks 4 y 6)
5. **Reembolso de Google** → el cron de anulados borra `premium:<CODE>` del viaje asociado, sin tocar otros viajes. (Task 5)

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `vitest.config.ts` (nuevo) | Tests con alias `@` |
| `test/fakeRedis.ts` (nuevo) | Redis en memoria para tests (`get/set/del/scan`) |
| `lib/payments/premium.ts` (nuevo) | Fuente de verdad del premium: `getPremium`, `grantPremium`, `revokePremium`, `withPremium`, `stripPremium` |
| `lib/payments/store.ts` (mod.) | `setTripPremium` desaparece; Stripe usa `grantPremium/revokePremium` |
| `lib/redis.ts` (mod.) | `isValidStoreKey` sigue igual (ya rechaza `premium:`) — test que lo fija |
| `app/api/store/route.ts` (mod.) | GET fusiona premium real; POST lo elimina |
| `app/api/webhook/stripe/route.ts` (mod.) | Usa `grantPremium/revokePremium` |
| `scripts/migrate-premium.ts` (nuevo) | Migración única de `trip.premium` → `premium:<CODE>` |
| `lib/payments/play.ts` (nuevo) | Cliente Google Play Developer API (token OAuth, get, consume, voided) |
| `app/api/play/verify/route.ts` (nuevo) | Verifica, deduplica, activa y consume |
| `app/api/play/voided/route.ts` (nuevo) | Cron diario de reembolsos |
| `lib/alerts.ts` (nuevo) | `sendAlert(message)` al webhook de Telegram |
| `components/viajes/billing/platform.ts` (nuevo) | Detección TWA, compra Play, reanudación de pendientes, precio |
| `components/viajes/premium.ts` (mod.) | `startPremiumPurchase` elige Play o Stripe |
| `components/viajes/PremiumGate.tsx` (mod.) | UI de compra según contexto |
| `app/.well-known/assetlinks.json/route.ts` (nuevo) | Digital Asset Links desde `ANDROID_CERT_SHA256` |
| `app/privacidad/page.tsx` (nuevo) | Política de privacidad pública (requisito de Play) |
| `~/viajes_app_android/` (nuevo, fuera del repo) | Proyecto Bubblewrap |

---

### Task 1: El premium pasa a una clave solo-servidor

**Files:**
- Create: `vitest.config.ts`, `test/fakeRedis.ts`, `lib/payments/premium.ts`, `lib/payments/premium.test.ts`, `app/api/store/route.test.ts`
- Modify: `package.json` (script `test`, devDeps), `app/api/store/route.ts`, `lib/payments/store.ts` (borrar `setTripPremium`), `app/api/webhook/stripe/route.ts:77,98`

**Interfaces:**
- Produces:
  - `type PremiumRecord = { source: "stripe" | "play" | "legacy"; ref: string; granted_at: number }`
  - `getPremium(code: string): Promise<PremiumRecord | null>`
  - `grantPremium(code: string, source: PremiumRecord["source"], ref: string): Promise<boolean>` (false si el viaje no existe)
  - `revokePremium(code: string): Promise<void>`
  - `withPremium(key: string, value: unknown): Promise<unknown>` (para GET de `/api/store`)
  - `stripPremium(key: string, value: unknown): unknown` (para POST)
  - `test/fakeRedis.ts`: `createFakeRedis()` con `get/set/del/scan` y `vi.mock("@/lib/redis")` helper

- [ ] **Step 1: Instalar Vitest y configurar**

```bash
npm i -D vitest@^3
npm pkg set scripts.test="vitest run"
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { include: ["**/*.test.ts"], exclude: ["node_modules/**"] },
});
```

`test/fakeRedis.ts`:
```ts
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
```

- [ ] **Step 2: Tests que fallan**

`lib/payments/premium.test.ts`:
```ts
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
```

`app/api/store/route.test.ts`:
```ts
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
```

- [ ] **Step 3: Verificar que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module './premium'` y los asserts del store fallan (hoy guarda `premium: true`).

- [ ] **Step 4: Implementar `lib/payments/premium.ts`**

```ts
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
```

- [ ] **Step 5: Conectar `/api/store`**

En `app/api/store/route.ts`:
- `import { withPremium, stripPremium } from "@/lib/payments/premium";`
- GET: `const value = await redis.get(key); return NextResponse.json(await withPremium(key, value ?? null));`
- POST: `await redis.set(key, stripPremium(key, value));`

- [ ] **Step 6: Stripe usa la nueva clave**

En `app/api/webhook/stripe/route.ts` sustituir el import de `setTripPremium` por `import { grantPremium, revokePremium } from "@/lib/payments/premium";`:
- `handleCheckoutCompleted`: `const granted = await grantPremium(tripCode, "stripe", paymentIntentId);`
- `handleChargeRefunded`: `await revokePremium(payment.tripCode);`

Borrar `setTripPremium` de `lib/payments/store.ts`. Comprobar que no queda uso: `grep -rn setTripPremium app lib components` → sin resultados.

- [ ] **Step 7: Tests en verde + build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: todos los tests PASS, build OK.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Premium como clave solo-servidor: el cliente ya no puede activarlo ni borrarlo"
```

---

### Task 2: Migración de los viajes premium existentes

**Files:**
- Create: `scripts/migrate-premium.ts`, `scripts/migrate-premium.test.ts`

**Interfaces:**
- Consumes: `PremiumRecord` (Task 1), `createFakeRedis` (Task 1)
- Produces: `migratePremium(redis): Promise<{ migrated: string[]; cleaned: number }>`

- [ ] **Step 1: Test que falla**

```ts
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
```

- [ ] **Step 2: Verificar que falla** — `npm test -- migrate-premium` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```ts
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
```

- [ ] **Step 4: Tests en verde** — `npm test` → PASS.

- [ ] **Step 5: Commit** — `git add scripts && git commit -m "Script de migración del premium a la clave premium:<CODE>"`

> Ejecución real contra producción: la hace Lucas (o Claude con su permiso) justo después de desplegar Task 1: `npx tsx --env-file=.env.local scripts/migrate-premium.ts`. Esperado: `migrated` incluye `QYBB-4798` (Navidad 2026).

---

### Task 3: Cliente de la Google Play Developer API

**Files:**
- Create: `lib/payments/play.ts`, `lib/payments/play.test.ts`
- Modify: `package.json` (dependencia `google-auth-library`)

**Interfaces:**
- Produces:
  - `const PLAY_PRODUCT_ID = "premium_viaje"`
  - `type PlayPurchase = { orderId: string; purchaseState: 0 | 1 | 2; consumptionState: 0 | 1; acknowledgementState: 0 | 1 }` (0 = comprado, 1 = cancelado, 2 = pendiente)
  - `getPurchase(token: string, deps?: PlayDeps): Promise<PlayPurchase>`
  - `consumePurchase(token: string, deps?: PlayDeps): Promise<void>`
  - `listVoided(sinceMs: number, deps?: PlayDeps): Promise<{ orderId: string; purchaseToken: string }[]>`
  - `type PlayDeps = { fetch: typeof fetch; accessToken: () => Promise<string>; packageName: string }`

- [ ] **Step 1: Instalar** — `npm i google-auth-library`

- [ ] **Step 2: Test que falla**

```ts
import { describe, it, expect, vi } from "vitest";
import { getPurchase, consumePurchase, listVoided, PLAY_PRODUCT_ID, type PlayDeps } from "./play";

function deps(responses: Record<string, unknown>, status = 200) {
  const calls: { url: string; method: string }[] = [];
  const d: PlayDeps = {
    packageName: "es.fluxit.bitacora",
    accessToken: async () => "tok",
    fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      const key = Object.keys(responses).find((k) => String(url).includes(k));
      return new Response(JSON.stringify(key ? responses[key] : {}), { status });
    }) as unknown as typeof fetch,
  };
  return { d, calls };
}

describe("play api", () => {
  it("gets a product purchase with the bearer token", async () => {
    const { d, calls } = deps({ [`/products/${PLAY_PRODUCT_ID}/tokens/abc`]: { orderId: "GPA.1", purchaseState: 0, consumptionState: 0, acknowledgementState: 0 } });
    const p = await getPurchase("abc", d);
    expect(p.orderId).toBe("GPA.1");
    expect(calls[0].url).toContain("/applications/es.fluxit.bitacora/purchases/products/premium_viaje/tokens/abc");
  });

  it("consume is a POST to :consume", async () => {
    const { d, calls } = deps({});
    await consumePurchase("abc", d);
    expect(calls[0]).toMatchObject({ method: "POST" });
    expect(calls[0].url).toMatch(/tokens\/abc:consume$/);
  });

  it("throws with the HTTP status on API errors", async () => {
    const { d } = deps({}, 410);
    await expect(getPurchase("gone", d)).rejects.toThrow(/410/);
  });

  it("lists voided purchases since a timestamp", async () => {
    const { d, calls } = deps({ voidedpurchases: { voidedPurchases: [{ orderId: "GPA.9", purchaseToken: "t9" }] } });
    expect(await listVoided(1000, d)).toEqual([{ orderId: "GPA.9", purchaseToken: "t9" }]);
    expect(calls[0].url).toContain("startTime=1000");
  });
});
```

- [ ] **Step 3: Verificar que falla** — `npm test -- play` → FAIL.

- [ ] **Step 4: Implementar**

```ts
import { GoogleAuth } from "google-auth-library";

// Thin client for the Google Play Developer API (androidpublisher v3). Deps are
// injectable so tests never hit Google.
export const PLAY_PRODUCT_ID = "premium_viaje";

export type PlayPurchase = { orderId: string; purchaseState: 0 | 1 | 2; consumptionState: 0 | 1; acknowledgementState: 0 | 1 };
export type PlayDeps = { fetch: typeof fetch; accessToken: () => Promise<string>; packageName: string };

const BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

function defaultDeps(): PlayDeps {
  const credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? "{}");
  const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/androidpublisher"] });
  return {
    fetch,
    packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "es.fluxit.bitacora",
    accessToken: async () => (await (await auth.getClient()).getAccessToken()).token ?? "",
  };
}

async function call<T>(d: PlayDeps, path: string, method = "GET"): Promise<T> {
  const res = await d.fetch(`${BASE}/${d.packageName}/${path}`, {
    method, headers: { Authorization: `Bearer ${await d.accessToken()}` },
  });
  if (!res.ok) throw new Error(`Google Play API ${res.status} on ${path}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export const getPurchase = (token: string, d = defaultDeps()) =>
  call<PlayPurchase>(d, `purchases/products/${PLAY_PRODUCT_ID}/tokens/${encodeURIComponent(token)}`);

export const consumePurchase = async (token: string, d = defaultDeps()) => {
  await call(d, `purchases/products/${PLAY_PRODUCT_ID}/tokens/${encodeURIComponent(token)}:consume`, "POST");
};

export async function listVoided(sinceMs: number, d = defaultDeps()) {
  const r = await call<{ voidedPurchases?: { orderId: string; purchaseToken: string }[] }>(d, `purchases/voidedpurchases?startTime=${sinceMs}`);
  return (r.voidedPurchases ?? []).map(({ orderId, purchaseToken }) => ({ orderId, purchaseToken }));
}
```

- [ ] **Step 5: Tests en verde** — `npm test` → PASS.
- [ ] **Step 6: Commit** — `git commit -am "Cliente de la Google Play Developer API"` (añadir los ficheros nuevos con `git add` antes).

---

### Task 4: `POST /api/play/verify`

**Files:**
- Create: `app/api/play/verify/route.ts`, `app/api/play/verify/route.test.ts`, `lib/alerts.ts`

**Interfaces:**
- Consumes: `grantPremium` (Task 1), `getPurchase`, `consumePurchase` (Task 3), `isValidTripCode` (`lib/payments/store.ts`)
- Produces: `POST /api/play/verify` body `{ code: string, purchaseToken: string }` → `200 { ok: true }` | `202 { ok: false, pending: true }` | `400` | `404 { reason: "trip_not_found" }` | `409 { reason: "token_used" }` | `502` | `503`. Redis: `play:purchase:<orderId> → { tripCode, purchaseToken }`, `play:token:<purchaseToken> → tripCode`.
- `sendAlert(message: string): Promise<void>` en `lib/alerts.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeRedis, type FakeRedis } from "@/test/fakeRedis";

let redis: FakeRedis;
const play = { state: 0 as 0 | 1 | 2, consumed: [] as string[] };
vi.mock("@/lib/redis", async (orig) => ({ ...(await orig<object>()), getRedis: async () => redis }));
vi.mock("@/lib/payments/play", () => ({
  getPurchase: async (t: string) => ({ orderId: `GPA.${t}`, purchaseState: play.state, consumptionState: 0, acknowledgementState: 0 }),
  consumePurchase: async (t: string) => { play.consumed.push(t); },
}));
vi.mock("@/lib/alerts", () => ({ sendAlert: async () => {} }));
const { POST } = await import("./route");

const verify = (body: unknown) => POST(new NextRequest("http://x/api/play/verify", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  redis = createFakeRedis();
  redis.data.set("trip:ABCD-1234", { name: "A" });
  redis.data.set("trip:WXYZ-5678", { name: "B" });
  play.state = 0; play.consumed = [];
});

describe("/api/play/verify", () => {
  it("grants premium and consumes a purchased token", async () => {
    const res = await verify({ code: "ABCD-1234", purchaseToken: "t1" });
    expect(res.status).toBe(200);
    expect(redis.data.get("premium:ABCD-1234")).toMatch(/"source":"play"/);
    expect(play.consumed).toEqual(["t1"]);
  });

  it("the same token cannot unlock a second trip", async () => {
    await verify({ code: "ABCD-1234", purchaseToken: "t1" });
    const res = await verify({ code: "WXYZ-5678", purchaseToken: "t1" });
    expect(res.status).toBe(409);
    expect(redis.data.has("premium:WXYZ-5678")).toBe(false);
  });

  it("replaying the same token for the same trip is harmless", async () => {
    await verify({ code: "ABCD-1234", purchaseToken: "t1" });
    expect((await verify({ code: "ABCD-1234", purchaseToken: "t1" })).status).toBe(200);
  });

  it("pending purchases are neither granted nor consumed", async () => {
    play.state = 2;
    const res = await verify({ code: "ABCD-1234", purchaseToken: "t2" });
    expect(res.status).toBe(202);
    expect(redis.data.has("premium:ABCD-1234")).toBe(false);
    expect(play.consumed).toEqual([]);
  });

  it("rejects bad input and unknown trips", async () => {
    expect((await verify({ code: "nope", purchaseToken: "t" })).status).toBe(400);
    expect((await verify({ code: "ABCD-1234" })).status).toBe(400);
    expect((await verify({ code: "QQQQ-0000", purchaseToken: "t3" })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `npm test -- play/verify` → FAIL.

- [ ] **Step 3: Implementar `lib/alerts.ts`**

```ts
// Operational alerts to Lucas through the existing n8n → Telegram webhook.
export async function sendAlert(message: string): Promise<void> {
  try {
    await fetch("https://n8n.fluxit.es/webhook/fluxit-tool-done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "bitacora-play", status: "info", message }),
    });
  } catch {
    // alerts are best-effort
  }
}
```

- [ ] **Step 4: Implementar la ruta**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { isValidTripCode } from "@/lib/payments/store";
import { grantPremium } from "@/lib/payments/premium";
import { getPurchase, consumePurchase } from "@/lib/payments/play";
import { sendAlert } from "@/lib/alerts";

export const runtime = "nodejs";

// Called by the TWA after the Play billing sheet returns a purchaseToken, and
// again on app open for purchases that were never confirmed.
export async function POST(req: NextRequest) {
  let body: { code?: unknown; purchaseToken?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { code, purchaseToken } = body;
  if (!isValidTripCode(code) || typeof purchaseToken !== "string" || !purchaseToken || purchaseToken.length > 2048) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ ok: false }, { status: 503 });
  if (!(await redis.get(`trip:${code}`))) return NextResponse.json({ ok: false, reason: "trip_not_found" }, { status: 404 });

  const boundTo = await redis.get(`play:token:${purchaseToken}`);
  if (boundTo && boundTo !== code) return NextResponse.json({ ok: false, reason: "token_used" }, { status: 409 });

  let purchase;
  try {
    purchase = await getPurchase(purchaseToken);
  } catch (e) {
    console.error("[play.verify] google error", String(e));
    return NextResponse.json({ ok: false }, { status: 502 });
  }
  if (purchase.purchaseState === 2) return NextResponse.json({ ok: false, pending: true }, { status: 202 });
  if (purchase.purchaseState !== 0) return NextResponse.json({ ok: false, reason: "cancelled" }, { status: 400 });

  // Bind token → trip atomically; a concurrent request for another trip loses.
  const bound = await redis.set(`play:token:${purchaseToken}`, code, { nx: true });
  if (bound === null && (await redis.get(`play:token:${purchaseToken}`)) !== code) {
    return NextResponse.json({ ok: false, reason: "token_used" }, { status: 409 });
  }
  await redis.set(`play:purchase:${purchase.orderId}`, JSON.stringify({ tripCode: code, purchaseToken }));
  await grantPremium(code, "play", purchase.orderId);

  if (purchase.consumptionState === 0) {
    try { await consumePurchase(purchaseToken); } catch (e) {
      // Premium is already granted; an unconsumed purchase only blocks buying
      // premium for another trip until the next retry.
      console.error("[play.verify] consume failed", String(e));
      await sendAlert(`Bitácora: compra ${purchase.orderId} activada pero no consumida (${code}).`);
    }
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Tests en verde** — `npm test` → PASS.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "Verificación de compras de Google Play con deduplicación por token"`

---

### Task 5: Cron de compras anuladas

**Files:**
- Create: `app/api/play/voided/route.ts`, `app/api/play/voided/route.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `listVoided` (Task 3), `revokePremium` (Task 1), `sendAlert` (Task 4), Redis `play:purchase:<orderId>` (Task 4)
- Produces: `GET /api/play/voided` con `Authorization: Bearer ${CRON_SECRET}` → `{ ok: true, revoked: string[] }`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeRedis, type FakeRedis } from "@/test/fakeRedis";

let redis: FakeRedis;
vi.mock("@/lib/redis", async (orig) => ({ ...(await orig<object>()), getRedis: async () => redis }));
vi.mock("@/lib/payments/play", () => ({ listVoided: async () => [{ orderId: "GPA.1", purchaseToken: "t1" }, { orderId: "GPA.unknown", purchaseToken: "tx" }] }));
vi.mock("@/lib/alerts", () => ({ sendAlert: async () => {} }));
const { GET } = await import("./route");

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  redis = createFakeRedis();
  redis.data.set("play:purchase:GPA.1", JSON.stringify({ tripCode: "ABCD-1234", purchaseToken: "t1" }));
  redis.data.set("premium:ABCD-1234", JSON.stringify({ source: "play", ref: "GPA.1", granted_at: 1 }));
  redis.data.set("premium:WXYZ-5678", JSON.stringify({ source: "stripe", ref: "pi", granted_at: 1 }));
});

const call = (auth?: string) => GET(new NextRequest("http://x/api/play/voided", { headers: auth ? { authorization: auth } : {} }));

describe("/api/play/voided", () => {
  it("requires the cron secret", async () => {
    expect((await call()).status).toBe(401);
  });
  it("revokes only the trip tied to the refunded order", async () => {
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ ok: true, revoked: ["ABCD-1234"] });
    expect(redis.data.has("premium:ABCD-1234")).toBe(false);
    expect(redis.data.has("premium:WXYZ-5678")).toBe(true);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `npm test -- voided` → FAIL.

- [ ] **Step 3: Implementar**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { listVoided } from "@/lib/payments/play";
import { revokePremium } from "@/lib/payments/premium";
import { sendAlert } from "@/lib/alerts";

export const runtime = "nodejs";

// Daily Vercel cron: Google refunds/chargebacks → remove premium from that trip.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const redis = await getRedis();
  if (!redis) return NextResponse.json({ ok: false }, { status: 503 });

  const voided = await listVoided(Date.now() - 2 * 86_400_000);
  const revoked: string[] = [];
  for (const v of voided) {
    const raw = await redis.get(`play:purchase:${v.orderId}`);
    if (!raw) continue;
    const { tripCode } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { tripCode: string };
    await revokePremium(tripCode);
    revoked.push(tripCode);
  }
  if (revoked.length) await sendAlert(`Bitácora: premium retirado por reembolso de Google en ${revoked.join(", ")}.`);
  return NextResponse.json({ ok: true, revoked });
}
```

`vercel.json` (añadir sin quitar el existente):
```json
{
  "crons": [
    { "path": "/api/push/daily-digest", "schedule": "0 7 * * *" },
    { "path": "/api/play/voided", "schedule": "30 7 * * *" }
  ]
}
```

- [ ] **Step 4: Tests en verde** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Cron diario que retira el premium de compras reembolsadas en Google Play"`

---

### Task 6: Cliente — comprar con Play dentro de la TWA, Stripe fuera

**Files:**
- Create: `components/viajes/billing/platform.ts`, `components/viajes/billing/platform.test.ts`
- Modify: `components/viajes/premium.ts`, `components/viajes/PremiumGate.tsx`, `components/viajes/App.tsx` (llamar a `resumePendingPurchases` al abrir un viaje)

**Interfaces:**
- Consumes: `POST /api/play/verify` (Task 4), `startPremiumCheckout` (existente, Stripe)
- Produces:
  - `getPlayBilling(): Promise<DigitalGoodsService | null>`
  - `playPrice(): Promise<string | null>` (precio localizado, ej. "2,99 €")
  - `buyWithPlay(code: string): Promise<"granted" | "pending" | "cancelled">`
  - `resumePendingPurchases(currentCode: string): Promise<boolean>` (true si activó algo)
  - En `premium.ts`: `startPremiumPurchase(code: string): Promise<"granted" | "pending" | "cancelled" | "redirected">`

- [ ] **Step 1: Test que falla** (lógica con `window` simulado)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyCalls: unknown[] = [];
let verifyStatus = 200;
beforeEach(() => {
  verifyCalls.length = 0; verifyStatus = 200;
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { verifyCalls.push(JSON.parse(String(init.body))); return new Response("{}", { status: verifyStatus }); }));
});

function stubPlay(opts: { purchases?: { purchaseToken: string }[]; showResult?: "ok" | "abort" }) {
  const service = {
    getDetails: async () => [{ itemId: "premium_viaje", price: { currency: "EUR", value: "2.99" } }],
    listPurchases: async () => opts.purchases ?? [],
  };
  vi.stubGlobal("window", { getDigitalGoodsService: async () => service });
  vi.stubGlobal("PaymentRequest", class {
    async show() {
      if (opts.showResult === "abort") throw Object.assign(new Error("cancel"), { name: "AbortError" });
      return { details: { purchaseToken: "tok-1" }, complete: async () => {} };
    }
  });
}

const load = async () => { vi.resetModules(); return import("./platform"); };

describe("billing platform", () => {
  it("outside the TWA there is no Play billing", async () => {
    vi.stubGlobal("window", {});
    const { getPlayBilling } = await load();
    expect(await getPlayBilling()).toBeNull();
  });

  it("buying remembers the trip before paying and verifies afterwards", async () => {
    stubPlay({});
    const { buyWithPlay } = await load();
    expect(await buyWithPlay("ABCD-1234")).toBe("granted");
    expect(verifyCalls).toEqual([{ code: "ABCD-1234", purchaseToken: "tok-1" }]);
  });

  it("cancelling the Play sheet is not an error", async () => {
    stubPlay({ showResult: "abort" });
    const { buyWithPlay } = await load();
    expect(await buyWithPlay("ABCD-1234")).toBe("cancelled");
  });

  it("pending payments report pending", async () => {
    stubPlay({}); verifyStatus = 202;
    const { buyWithPlay } = await load();
    expect(await buyWithPlay("ABCD-1234")).toBe("pending");
  });

  it("an unconfirmed purchase is resumed for the trip it was bought for", async () => {
    stubPlay({ purchases: [{ purchaseToken: "tok-old" }] });
    localStorage.setItem("play:pending:tok-old", "WXYZ-5678");
    const { resumePendingPurchases } = await load();
    await resumePendingPurchases("ABCD-1234");
    expect(verifyCalls).toEqual([{ code: "WXYZ-5678", purchaseToken: "tok-old" }]);
  });

  it("price comes localized from Play", async () => {
    stubPlay({});
    const { playPrice } = await load();
    expect(await playPrice()).toMatch(/2,99/);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `npm test -- platform` → FAIL.

- [ ] **Step 3: Implementar `components/viajes/billing/platform.ts`**

```ts
"use client";

// Google Play Billing from inside the Trusted Web Activity (Digital Goods API
// + Payment Request). Outside the TWA getPlayBilling() is null and the app
// falls back to Stripe (see premium.ts).
const PLAY_METHOD = "https://play.google.com/billing";
const SKU = "premium_viaje";

type DigitalGoodsService = {
  getDetails(ids: string[]): Promise<{ itemId: string; price: { currency: string; value: string } }[]>;
  listPurchases(): Promise<{ purchaseToken: string }[]>;
};

export async function getPlayBilling(): Promise<DigitalGoodsService | null> {
  const w = (typeof window !== "undefined" ? window : {}) as { getDigitalGoodsService?: (m: string) => Promise<DigitalGoodsService> };
  if (!w.getDigitalGoodsService) return null;
  try { return await w.getDigitalGoodsService(PLAY_METHOD); } catch { return null; }
}

export async function playPrice(): Promise<string | null> {
  const service = await getPlayBilling();
  const item = (await service?.getDetails([SKU]))?.[0];
  if (!item) return null;
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: item.price.currency }).format(Number(item.price.value));
}

const pendingKey = (token: string) => `play:pending:${token}`;

async function verify(code: string, purchaseToken: string): Promise<"granted" | "pending" | "failed"> {
  const res = await fetch("/api/play/verify", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, purchaseToken }),
  });
  if (res.status === 200) { localStorage.removeItem(pendingKey(purchaseToken)); return "granted"; }
  if (res.status === 202) return "pending";
  if (res.status === 409 || res.status === 404) localStorage.removeItem(pendingKey(purchaseToken));
  return "failed";
}

export async function buyWithPlay(code: string): Promise<"granted" | "pending" | "cancelled"> {
  const request = new PaymentRequest([{ supportedMethods: PLAY_METHOD, data: { sku: SKU } }], { total: { label: "Premium", amount: { currency: "EUR", value: "0" } } });
  let response: { details: { purchaseToken: string }; complete(r: "success" | "fail"): Promise<void> };
  try {
    response = await (request as unknown as { show(): Promise<typeof response> }).show();
  } catch (e) {
    if ((e as Error).name === "AbortError") return "cancelled";
    throw e;
  }
  const token = response.details.purchaseToken;
  localStorage.setItem(pendingKey(token), code);
  const result = await verify(code, token);
  await response.complete(result === "failed" ? "fail" : "success");
  if (result === "failed") throw new Error("No se pudo confirmar la compra. Se reintentará al abrir la app.");
  return result;
}

export async function resumePendingPurchases(currentCode: string): Promise<boolean> {
  const service = await getPlayBilling();
  if (!service) return false;
  let granted = false;
  for (const p of await service.listPurchases()) {
    const code = localStorage.getItem(pendingKey(p.purchaseToken)) ?? currentCode;
    if ((await verify(code, p.purchaseToken)) === "granted") granted = true;
  }
  return granted;
}
```

> Nota del paso: en el proyecto real `PaymentRequest` con Play exige `total` aunque Play lo ignora; el importe real lo fija Play Console.

- [ ] **Step 4: `components/viajes/premium.ts`**

Añadir debajo de `startPremiumCheckout` (que se queda para la web):
```ts
import { getPlayBilling, buyWithPlay } from "./billing/platform";

// Inside the Play app → Play Billing (store policy). Anywhere else → Stripe.
export async function startPremiumPurchase(code: string): Promise<"granted" | "pending" | "cancelled" | "redirected"> {
  if (await getPlayBilling()) return buyWithPlay(code);
  await startPremiumCheckout(code);
  return "redirected";
}
```
y actualizar el comentario "NOTE: this covers the web flow only…" para que diga que Play ya está en `billing/platform.ts`.

- [ ] **Step 5: `PremiumGate.tsx`**

- `import { isPremium, startPremiumPurchase } from "./premium";` y `import { playPrice } from "./billing/platform";`
- Estado `const [price, setPrice] = useState("2,99 €"); const [pending, setPending] = useState(false);` y `useEffect(() => { playPrice().then(p => p && setPrice(p)); }, []);`
- `unlock()`:
```ts
const r = await startPremiumPurchase(code);
if (r === "granted") onUnlock({ ...trip, premium: true });
else if (r === "pending") { setPending(true); setLoading(false); }
else if (r === "cancelled") setLoading(false);
// "redirected": Stripe navigation in progress
```
- Botón: `{loading ? "ACTIVANDO…" : `HAZTE PREMIUM · ${price}`}`; si `pending`, mostrar bajo el botón: "Pago pendiente: se activará cuando Google lo confirme."

- [ ] **Step 6: `App.tsx`** — tras cargar el viaje (donde hoy se hace `loadShared<Trip | null>(\`trip:${code}\`...)` en la línea ~84), añadir:
```ts
resumePendingPurchases(code).then(async granted => {
  if (granted) setTrip(await loadShared<Trip | null>(`trip:${code}`, null));
});
```
(usar el setter de viaje que ya existe en ese componente; importar `resumePendingPurchases` de `./billing/platform`).

- [ ] **Step 7: Tests + tipos + build** — `npm test && npx tsc --noEmit && npm run build` → PASS.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "Compra premium con Google Play dentro de la app y Stripe en la web"`

---

### Task 7: Digital Asset Links y política de privacidad

**Files:**
- Create: `app/.well-known/assetlinks.json/route.ts`, `app/.well-known/assetlinks.json/route.test.ts`, `app/privacidad/page.tsx`

**Interfaces:**
- Produces: `GET /.well-known/assetlinks.json` (JSON de Digital Asset Links a partir de `ANDROID_CERT_SHA256`, varias huellas separadas por coma); página `/privacidad`.

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect } from "vitest";
const { GET } = await import("./route");

describe("assetlinks", () => {
  it("publishes the package and every configured fingerprint", async () => {
    process.env.ANDROID_CERT_SHA256 = "AA:BB, CC:DD";
    const body = await (await GET()).json();
    expect(body).toEqual([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: "es.fluxit.bitacora", sha256_cert_fingerprints: ["AA:BB", "CC:DD"] },
    }]);
  });
  it("is an empty list until the fingerprint exists", async () => {
    delete process.env.ANDROID_CERT_SHA256;
    expect(await (await GET()).json()).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `npm test -- assetlinks` → FAIL.

- [ ] **Step 3: Implementar la ruta**

```ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Proves to Android that es.fluxit.bitacora may open this site full-screen
// (TWA without URL bar). Fingerprint comes from Play Console → App signing.
export async function GET() {
  const prints = (process.env.ANDROID_CERT_SHA256 ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (prints.length === 0) return NextResponse.json([]);
  return NextResponse.json([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "es.fluxit.bitacora", sha256_cert_fingerprints: prints },
  }]);
}
```

- [ ] **Step 4: `app/privacidad/page.tsx`** — página estática en castellano con el estilo de la app (`C`, `F` de `components/viajes/theme`), con estas secciones y contenido literal:
  - **Responsable:** Lucas Pariente (Fluxit), lucas.fluxit@gmail.com.
  - **Qué datos guardamos:** los que los miembros escriben en cada viaje (nombre visible, itinerario, gastos, fotos, documentos, notas), asociados solo al código del viaje; no pedimos email ni cuenta.
  - **Pagos:** los procesan Google Play o Stripe; Bitácora solo guarda el identificador del pedido y el viaje desbloqueado, nunca datos de tarjeta.
  - **Asistente IA:** el texto que se envía al asistente se procesa con la API de Anthropic para generar la respuesta y no se usa para entrenar modelos.
  - **Notificaciones:** si las activas, guardamos la suscripción push del navegador para avisarte del viaje.
  - **Conservación y borrado:** los datos del viaje se guardan mientras el viaje exista; puedes pedir su borrado escribiendo al email de contacto con el código del viaje.
  - **Fecha:** "Última actualización: septiembre de 2026".

- [ ] **Step 5: Tests + build** — `npm test && npm run build` → PASS.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "Digital Asset Links para la TWA y política de privacidad"`

---

### Task 8: Proyecto Android (Bubblewrap) y prueba interna

**Files:**
- Create (fuera del repo web): `~/viajes_app_android/twa-manifest.json` y proyecto generado

**Interfaces:**
- Consumes: `https://viajes-app-tau.vercel.app/manifest.json`, `/.well-known/assetlinks.json` (Task 7)
- Produces: `app-release-bundle.aab` para Play Console.

- [ ] **Step 1: Instalar Bubblewrap** — `npm i -g @bubblewrap/cli` (primera ejecución descarga JDK y Android SDK; aceptar las licencias del SDK lo hace Lucas).

- [ ] **Step 2: Generar el proyecto**

```bash
mkdir -p ~/viajes_app_android && cd ~/viajes_app_android
bubblewrap init --manifest https://viajes-app-tau.vercel.app/manifest.json
```
Respuestas: dominio `viajes-app-tau.vercel.app`, package `es.fluxit.bitacora`, nombre "Bitácora de Viaje", nombre corto "Bitácora", color de tema `#16223A`, fondo `#F4EFE2`, **Play Billing: sí**, notificaciones: sí. Clave de subida nueva en `~/viajes_app_android/upload.keystore` (la contraseña la elige y guarda Lucas en Vaultwarden).

- [ ] **Step 3: Comprobar `twa-manifest.json`** — debe contener `"packageId": "es.fluxit.bitacora"`, `"enableNotifications": true` y `"features": { "playBilling": { "enabled": true } }`. Si falta `playBilling`, añadirlo y `bubblewrap update`.

- [ ] **Step 4: Build** — `bubblewrap build` → Expected: `app-release-bundle.aab` y `app-release-signed.apk`.

- [ ] **Step 5: Git del proyecto Android** — `git init && echo "*.keystore" >> .gitignore && git add -A && git commit -m "Proyecto TWA de Bitácora"`.

- [ ] **Step 6 (Lucas, Play Console):** crear la app, subir el `.aab` a **Prueba interna**, crear el producto `premium_viaje` (consumible, 2,99 €), copiar la huella SHA-256 de *App signing* a `ANDROID_CERT_SHA256` en Vercel, crear la cuenta de servicio y ponerla en `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME=es.fluxit.bitacora`, `CRON_SECRET`; añadir su Gmail como **tester de licencia**. Redesplegar la web.

- [ ] **Step 7: Verificación manual en un Android real** (instalando desde el enlace de prueba interna):
  1. Abre sin barra de URL (asset links OK: `curl https://viajes-app-tau.vercel.app/.well-known/assetlinks.json` devuelve la huella).
  2. En un viaje sin premium, el botón muestra el precio de Play y abre la hoja de Google (no Stripe).
  3. Compra con la tarjeta de prueba de licencia → el viaje pasa a premium y otro miembro lo ve premium en la web.
  4. Cerrar la app a mitad de compra y reabrir → se activa sola.
  5. Reembolsar el pedido en Play Console → al día siguiente (o llamando al cron con el secreto) el viaje deja de ser premium.
  6. En el navegador normal (fuera de la app) el botón sigue yendo a Stripe.

- [ ] **Step 8: Prueba cerrada de 14 días** — con la verificación OK, promover a **Prueba cerrada** con los 12 testers; pasados 14 días, solicitar producción.

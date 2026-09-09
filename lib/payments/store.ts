import { getRedis } from "@/lib/redis";
import type { Trip } from "@/components/viajes/types";

// Bitácora de Viaje has no database — trips already live in Redis as
// `trip:<CODE>` JSON blobs (see lib/redis.ts / components/viajes/utils.ts).
// Payment bookkeeping reuses the same Redis instance instead of introducing
// a second storage layer for a single fixed-price product.

const TRIP_CODE_PATTERN = /^[A-Z]{3,4}-[0-9]{3,4}$/;

export function isValidTripCode(code: unknown): code is string {
  return typeof code === "string" && TRIP_CODE_PATTERN.test(code);
}

// Rule 9: event-id dedup. SETNX-with-TTL so a webhook retried by Stripe
// after a 200 timeout can never grant/revoke premium twice.
export async function markEventProcessedOnce(eventId: string): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return true; // fail open — matches checkRateLimit's stance in lib/redis.ts
  const key = `pagokit:event:${eventId}`;
  const result = await redis.set(key, "1", { nx: true, ex: 7 * 24 * 60 * 60 });
  return result !== null;
}

export async function recordPayment(paymentIntentId: string, data: {
  status: "succeeded" | "refunded";
  tripCode: string;
  amount: number;
  currency: string;
}): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.set(`pagokit:payment:${paymentIntentId}`, JSON.stringify({ ...data, updated_at: Date.now() }));
}

export async function getPaymentByIntentId(paymentIntentId: string): Promise<{
  status: string; tripCode: string; amount: number; currency: string;
} | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const value = await redis.get(`pagokit:payment:${paymentIntentId}`);
  if (!value) return null;
  return typeof value === "string" ? JSON.parse(value) : (value as any);
}

export async function setTripPremium(tripCode: string, premium: boolean): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;
  const key = `trip:${tripCode}`;
  const raw = await redis.get(key);
  if (!raw) return false;
  const trip = (typeof raw === "string" ? JSON.parse(raw) : raw) as Trip;
  trip.premium = premium;
  await redis.set(key, JSON.stringify(trip));
  return true;
}

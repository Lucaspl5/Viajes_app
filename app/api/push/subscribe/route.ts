import { NextRequest, NextResponse } from "next/server";
import { getRedis, checkRateLimit, clientIp } from "@/lib/redis";

export const runtime = "edge";

const LIMIT = { count: 20, windowSeconds: 3600 };

interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`push:sub:${clientIp(req)}`, LIMIT.count, LIMIT.windowSeconds);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  let body: { code?: string; subscription?: PushSubscriptionJSON };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { code, subscription } = body;
  if (typeof code !== "string" || !code.trim() || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ ok: false, reason: "no_kv" }, { status: 503 });

  const trip = await redis.get(`trip:${code}`);
  if (!trip) return NextResponse.json({ ok: false, reason: "invalid_trip_code" }, { status: 403 });

  const key = `push:${code}`;
  const existing = (await redis.get<PushSubscriptionJSON[]>(key)) ?? [];
  const next = [...existing.filter(s => s.endpoint !== subscription.endpoint), subscription];
  await redis.set(key, next);
  await redis.sadd("push:trips", code);

  return NextResponse.json({ ok: true });
}

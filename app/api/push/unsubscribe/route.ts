import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export const runtime = "edge";

interface PushSubscriptionJSON { endpoint: string; keys: { p256dh: string; auth: string } }

export async function POST(req: NextRequest) {
  let body: { code?: string; endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { code, endpoint } = body;
  if (typeof code !== "string" || !code.trim() || typeof endpoint !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ ok: false }, { status: 503 });

  const key = `push:${code}`;
  const existing = (await redis.get<PushSubscriptionJSON[]>(key)) ?? [];
  const next = existing.filter(s => s.endpoint !== endpoint);
  if (next.length) await redis.set(key, next);
  else { await redis.del(key); await redis.srem("push:trips", code); }

  return NextResponse.json({ ok: true });
}

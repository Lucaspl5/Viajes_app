import { NextRequest, NextResponse } from "next/server";
import { getRedis, isValidStoreKey, checkRateLimit, clientIp } from "@/lib/redis";

export const runtime = "edge";

const ACTIVE_WINDOW_MS = 90_000; // considered "here now" for this long after a heartbeat
const LIMIT = { count: 60, windowSeconds: 60 };

// GET /api/presence?key=trip:ABC-1234 — who's active on this trip right now
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!isValidStoreKey(key)) return NextResponse.json({ active: [] }, { status: 400 });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ active: [] }, { status: 503 });

  const hash = (await redis.hgetall<Record<string, number>>(`presence:${key}`)) ?? {};
  const now = Date.now();
  const active: string[] = [];
  const stale: string[] = [];
  for (const [name, ts] of Object.entries(hash)) {
    if (now - Number(ts) < ACTIVE_WINDOW_MS) active.push(name);
    else stale.push(name);
  }
  if (stale.length) redis.hdel(`presence:${key}`, ...stale).catch(() => {});

  return NextResponse.json({ active });
}

// POST /api/presence  body: { key: "trip:ABC-1234", name: "Lucas" } — heartbeat
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`presence:${clientIp(req)}`, LIMIT.count, LIMIT.windowSeconds);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  let body: { key?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { key, name } = body;
  if (!isValidStoreKey(key) || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ ok: false }, { status: 503 });

  await redis.hset(`presence:${key}`, { [name.trim().slice(0, 40)]: Date.now() });
  return NextResponse.json({ ok: true });
}

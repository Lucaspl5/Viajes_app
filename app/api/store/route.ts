import { NextRequest, NextResponse } from "next/server";
import { getRedis, isValidStoreKey, checkRateLimit, clientIp } from "@/lib/redis";

const MAX_BODY_BYTES = 4_000_000; // generous room for a photo album, still bounded
const READ_LIMIT = { count: 120, windowSeconds: 60 };
const WRITE_LIMIT = { count: 60, windowSeconds: 60 };

// GET /api/store?key=trip:ABC-123
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!isValidStoreKey(key)) return NextResponse.json(null, { status: 400 });

  const rl = await checkRateLimit(`store:read:${clientIp(req)}`, READ_LIMIT.count, READ_LIMIT.windowSeconds);
  if (!rl.ok) return NextResponse.json(null, { status: 429 });

  const redis = await getRedis();
  if (!redis) return NextResponse.json(null, { status: 503 });

  try {
    const value = await redis.get(key);
    return NextResponse.json(value ?? null);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}

// POST /api/store  body: { key, value }
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`store:write:${clientIp(req)}`, WRITE_LIMIT.count, WRITE_LIMIT.windowSeconds);
  if (!rl.ok) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, reason: "too_large" }, { status: 413 });
  }

  let body: { key?: string; value?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const { key, value } = body;
  if (!isValidStoreKey(key)) return NextResponse.json({ ok: false, reason: "invalid_key" }, { status: 400 });

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ ok: false, reason: "no_kv" }, { status: 503 });

  try {
    await redis.set(key, value);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

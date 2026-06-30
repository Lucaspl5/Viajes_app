import { NextRequest, NextResponse } from "next/server";

// Supports both Upstash Redis (UPSTASH_REDIS_REST_URL) and legacy Vercel KV (KV_REST_API_URL)
function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

// GET /api/store?key=trip:ABC
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json(null, { status: 400 });

  const cfg = getRedisConfig();
  if (!cfg) return NextResponse.json(null, { status: 503 });

  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis(cfg);
    const value = await redis.get(key);
    return NextResponse.json(value ?? null);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}

// POST /api/store  body: { key, value }
export async function POST(req: NextRequest) {
  let body: { key?: string; value?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const { key, value } = body;
  if (!key) return NextResponse.json({ ok: false }, { status: 400 });

  const cfg = getRedisConfig();
  if (!cfg) return NextResponse.json({ ok: false, reason: "no_kv" }, { status: 503 });

  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis(cfg);
    await redis.set(key, value);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

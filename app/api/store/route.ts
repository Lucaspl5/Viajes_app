import { NextRequest, NextResponse } from "next/server";

// GET /api/store?key=trip:ABC
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json(null, { status: 400 });

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json(null, { status: 503 });
  }

  try {
    const { kv } = await import("@vercel/kv");
    const value = await kv.get(key);
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

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({ ok: false, reason: "no_kv" }, { status: 503 });
  }

  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

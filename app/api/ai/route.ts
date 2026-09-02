import { NextRequest, NextResponse } from "next/server";
import { getRedis, checkRateLimit, clientIp } from "@/lib/redis";

export const runtime = "edge";

const TRIP_CODE_LIMIT = { count: 30, windowSeconds: 3600 }; // per trip, per hour
const IP_LIMIT = { count: 30, windowSeconds: 3600 }; // per IP, per hour

// Bounds on the client-controlled payload so a valid trip code can't be used
// to inflate the token cost billed to the personal Anthropic API key.
const MAX_BODY_BYTES = 60_000;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_SYSTEM_CHARS = 12_000;

// Requires a valid, existing trip code so this endpoint can't be hit for
// free by anyone who just finds the public URL — not real auth, but it
// stops anonymous abuse of the personal Anthropic API key behind it.
async function isValidTripCode(code: unknown): Promise<boolean> {
  if (typeof code !== "string" || !code.trim()) return false;
  try {
    const redis = await getRedis();
    if (!redis) return true; // KV not configured (e.g. local dev) — can't check, don't block
    const trip = await redis.get(`trip:${code}`);
    return trip !== null;
  } catch {
    return true; // Redis unreachable — fail open rather than break the feature
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_key" }, { status: 503 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let body: { messages: { role: string; content: string }[]; system: string; code?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!(await isValidTripCode(body.code))) {
    return NextResponse.json({ error: "invalid_trip_code" }, { status: 403 });
  }

  if (
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > MAX_MESSAGES ||
    body.messages.some((m) => typeof m?.content !== "string" || m.content.length > MAX_MESSAGE_CHARS) ||
    (typeof body.system === "string" && body.system.length > MAX_SYSTEM_CHARS)
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const ipLimit = await checkRateLimit(`ai:ip:${clientIp(req)}`, IP_LIMIT.count, IP_LIMIT.windowSeconds);
  if (!ipLimit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const tripLimit = await checkRateLimit(`ai:trip:${body.code}`, TRIP_CODE_LIMIT.count, TRIP_CODE_LIMIT.windowSeconds);
  if (!tripLimit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { messages, system } = body;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        stream: true,
        system,
        messages,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return NextResponse.json(
        { error: "upstream_error", detail: errText },
        { status: upstream.status }
      );
    }

    // Forward the SSE stream directly
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_error", detail: String(err) },
      { status: 500 }
    );
  }
}

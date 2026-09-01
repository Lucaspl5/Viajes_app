import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Supports both Upstash Redis (UPSTASH_REDIS_REST_URL) and legacy Vercel KV (KV_REST_API_URL)
function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

// Requires a valid, existing trip code so this endpoint can't be hit for
// free by anyone who just finds the public URL — not real auth, but it
// stops anonymous abuse of the personal Anthropic API key behind it.
async function isValidTripCode(code: unknown): Promise<boolean> {
  if (typeof code !== "string" || !code.trim()) return false;
  const cfg = getRedisConfig();
  if (!cfg) return true; // KV not configured (e.g. local dev) — can't check, don't block
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis(cfg);
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

  let body: { messages: { role: string; content: string }[]; system: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!(await isValidTripCode(body.code))) {
    return NextResponse.json({ error: "invalid_trip_code" }, { status: 403 });
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

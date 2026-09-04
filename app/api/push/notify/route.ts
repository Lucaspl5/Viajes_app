import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getRedis, checkRateLimit, clientIp } from "@/lib/redis";

interface PushSubscriptionJSON { endpoint: string; keys: { p256dh: string; auth: string } }

const LIMIT = { count: 30, windowSeconds: 3600 };

// POST /api/push/notify  body: { code, title, body }
// Fires an instant push to every subscriber of a trip — used for events that
// can't wait for the daily digest cron (e.g. someone just logged a big
// expense). Separate from /api/push/daily-digest, which only covers "what's
// on today" once a day.
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`push:notify:${clientIp(req)}`, LIMIT.count, LIMIT.windowSeconds);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  let payload: { code?: string; title?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { code, title, body } = payload;
  if (typeof code !== "string" || !code.trim() || typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return NextResponse.json({ ok: false, reason: "no_vapid_keys" }, { status: 503 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:lucas.fluxit@gmail.com", vapidPublic, vapidPrivate);

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ ok: false, reason: "no_kv" }, { status: 503 });

  const subs = (await redis.get<PushSubscriptionJSON[]>(`push:${code}`)) ?? [];
  if (!subs.length) return NextResponse.json({ ok: true, sent: 0 });

  const stillValid: PushSubscriptionJSON[] = [];
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title: title.trim().slice(0, 120), body: body.trim().slice(0, 220), code }));
      stillValid.push(sub);
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode !== 404 && statusCode !== 410) stillValid.push(sub); // transient failure — keep it
    }
  }
  if (stillValid.length !== subs.length) {
    if (stillValid.length) await redis.set(`push:${code}`, stillValid);
    else { await redis.del(`push:${code}`); await redis.srem("push:trips", code); }
  }

  return NextResponse.json({ ok: true, sent });
}

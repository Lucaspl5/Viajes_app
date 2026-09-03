import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getRedis } from "@/lib/redis";
import type { Trip, ItineraryDay } from "@/components/viajes/types";

interface PushSubscriptionJSON { endpoint: string; keys: { p256dh: string; auth: string } }

// Triggered once a day by Vercel Cron (see vercel.json). Sends every trip
// with active push subscriptions a heads-up about what's on today — either
// today's itinerary day, or a "your trip starts today" nudge.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "no_vapid_keys" }, { status: 503 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:lucas.fluxit@gmail.com", vapidPublic, vapidPrivate);

  const redis = await getRedis();
  if (!redis) return NextResponse.json({ error: "no_kv" }, { status: 503 });

  const codes = (await redis.smembers("push:trips")) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  let sent = 0, pruned = 0;

  for (const code of codes) {
    const [trip, itin, subs] = await Promise.all([
      redis.get<Trip>(`trip:${code}`),
      redis.get<ItineraryDay[]>(`itin:${code}`),
      redis.get<PushSubscriptionJSON[]>(`push:${code}`),
    ]);
    if (!trip || !subs?.length) continue;

    const todayDay = itin?.find(d => d.date === today);
    let title: string, body: string;
    if (todayDay && todayDay.items.length > 0) {
      title = `☀️ ${trip.name}`;
      body = `Hoy: ${todayDay.title} — ${todayDay.items.length} actividad${todayDay.items.length === 1 ? "" : "es"} planeada${todayDay.items.length === 1 ? "" : "s"}.`;
    } else if (trip.startDate === today) {
      title = `✈️ ¡Hoy empieza ${trip.name}!`;
      body = trip.destination ? `Buen viaje a ${trip.destination}.` : "Buen viaje.";
    } else {
      continue; // nothing relevant for this trip today
    }

    const stillValid: PushSubscriptionJSON[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, JSON.stringify({ title, body, code }));
        stillValid.push(sub);
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode !== 404 && statusCode !== 410) stillValid.push(sub); // transient failure — keep it
        else pruned++;
      }
    }
    if (stillValid.length !== subs.length) {
      if (stillValid.length) await redis.set(`push:${code}`, stillValid);
      else { await redis.del(`push:${code}`); await redis.srem("push:trips", code); }
    }
  }

  return NextResponse.json({ ok: true, sent, pruned, trips: codes.length });
}

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getRedis } from "@/lib/redis";
import type { Trip, ItineraryDay, Booking, TravelDocument } from "@/components/viajes/types";

interface PushSubscriptionJSON { endpoint: string; keys: { p256dh: string; auth: string } }

function daysUntil(dateStr: string, today: string) {
  return Math.round((new Date(dateStr + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86_400_000);
}

// Triggered once a day by Vercel Cron (see vercel.json). Sends every trip
// with active push subscriptions a heads-up combining: today's itinerary day
// (or a "your trip starts today" nudge), any travel document due within 3
// days, and a check-in reminder for a flight departing tomorrow.
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
    const [trip, itin, subs, docs, bookings] = await Promise.all([
      redis.get<Trip>(`trip:${code}`),
      redis.get<ItineraryDay[]>(`itin:${code}`),
      redis.get<PushSubscriptionJSON[]>(`push:${code}`),
      redis.get<TravelDocument[]>(`documentos:${code}`),
      redis.get<Booking[]>(`reservas:${code}`),
    ]);
    if (!trip || !subs?.length) continue;

    const messages: string[] = [];
    const todayDay = itin?.find(d => d.date === today);
    if (todayDay && todayDay.items.length > 0) {
      messages.push(`Hoy: ${todayDay.title} — ${todayDay.items.length} actividad${todayDay.items.length === 1 ? "" : "es"} planeada${todayDay.items.length === 1 ? "" : "s"}.`);
    } else if (trip.startDate === today) {
      messages.push(trip.destination ? `¡Hoy empieza! Buen viaje a ${trip.destination}.` : "¡Hoy empieza tu viaje! Buen viaje.");
    }

    for (const doc of docs ?? []) {
      if (!doc.dueDate) continue;
      const left = daysUntil(doc.dueDate, today);
      if (left >= 0 && left <= 3) {
        messages.push(`⚠️ ${doc.title || "Un documento"} vence en ${left === 0 ? "hoy" : `${left} día${left === 1 ? "" : "s"}`}.`);
      }
    }

    for (const b of bookings ?? []) {
      if (b.type !== "vuelo" || !b.startDate) continue;
      if (daysUntil(b.startDate, today) === 1) {
        messages.push(`🧳 Mañana sale "${b.title}" — recuerda hacer el check-in.`);
      }
    }

    if (messages.length === 0) continue; // nothing relevant for this trip today

    const title = `✈️ ${trip.name}`;
    const body = messages.join(" · ");

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

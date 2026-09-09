"use client";

import { useState, useEffect } from "react";
import { C, F } from "./theme";
import { Card, SectionLabel } from "./ui";


export const WMO: Record<number, string> = {
  0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",
  51:"🌦️",53:"🌦️",55:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",
  71:"🌨️",73:"🌨️",75:"❄️",80:"🌦️",81:"🌧️",82:"⛈️",
  95:"⛈️",96:"⛈️",99:"⛈️",
};

export function WeatherWidget({ destination, startDate, endDate }: { destination: string; startDate: string | null; endDate: string | null }) {
  type DayWeather = { date: string; max: number; min: number; code: number; rain: number };
  const [data, setData] = useState<DayWeather[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!destination || !startDate) return;
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() + 16 * 864e5).toISOString().slice(0, 10);
    if (startDate > cutoff) return; // too far in future, skip
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=es&format=json`).then(r => r.json());
        if (!geo.results?.length) return;
        const { latitude: lat, longitude: lon } = geo.results[0];
        const s = startDate < today ? today : startDate;
        const e = endDate && endDate <= cutoff ? endDate : cutoff;
        const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&start_date=${s}&end_date=${e}`).then(r => r.json());
        if (!cancelled && wx.daily) {
          setData(wx.daily.time.map((d: string, i: number) => ({
            date: d, max: Math.round(wx.daily.temperature_2m_max[i]),
            min: Math.round(wx.daily.temperature_2m_min[i]),
            code: wx.daily.weathercode[i], rain: Math.round(wx.daily.precipitation_sum[i] ?? 0),
          })));
        }
      } catch { /* silent — weather is optional */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [destination, startDate, endDate]);

  if (!destination || !startDate) return null;
  if (loading) return <div style={{ height: 80, borderRadius: 10 }} className="skeleton" />;
  if (!data?.length) return null;

  return (
    <Card>
      <SectionLabel>{`Tiempo en ${destination.split(",")[0]}`}</SectionLabel>
      <div className="flex gap-4 mt-3 overflow-x-auto no-scrollbar pb-1">
        {data.slice(0, 8).map(d => (
          <div key={d.date} style={{ textAlign: "center", minWidth: 48, flex: "0 0 48px" }}>
            <div style={{ fontSize: 24 }}>{WMO[d.code] ?? "🌡️"}</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginTop: 2 }}>{d.date.slice(5)}</div>
            <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.ink }}>{d.max}°</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{d.min}°</div>
            {d.rain > 0 && <div style={{ fontFamily: F.mono, fontSize: 9, color: C.sky }}>💧{d.rain}mm</div>}
          </div>
        ))}
      </div>
      <p style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginTop: 6 }}>Datos: Open-Meteo</p>
    </Card>
  );
}


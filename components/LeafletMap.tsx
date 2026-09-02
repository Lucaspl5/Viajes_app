"use client";

import { useEffect, useRef } from "react";
import type { Map, Marker, LeafletMouseEvent } from "leaflet";

export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  note: string;
}

interface LeafletMapProps {
  places: MapPlace[];
  onMapClick?: (lat: number, lon: number) => void;
  pendingLatLon?: { lat: number; lon: number } | null;
  initialCenter?: { lat: number; lon: number; zoom: number } | null;
  height?: string;
}

export default function LeafletMap({
  places,
  onMapClick,
  pendingLatLon,
  initialCenter,
  height = "380px",
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const pendingMarkerRef = useRef<Marker | null>(null);
  // We store the leaflet module after async import
  // Using a ref typed as unknown to avoid importing the full module at top-level
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const initialCenterRef = useRef(initialCenter);
  initialCenterRef.current = initialCenter;

  // Inject Leaflet CSS once
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      LRef.current = L;

      // Avoid double-init if map already exists
      if (mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e: LeafletMouseEvent) => {
        if (onMapClick) {
          const lat = parseFloat(e.latlng.lat.toFixed(6));
          const lon = parseFloat(e.latlng.lng.toFixed(6));
          onMapClick(lat, lon);
        }
      });

      if (initialCenterRef.current) {
        map.setView([initialCenterRef.current.lat, initialCenterRef.current.lon], initialCenterRef.current.zoom);
      }

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = [];
        pendingMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update onMapClick by re-attaching listener whenever callback changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handler = (e: LeafletMouseEvent) => {
      if (onMapClick) {
        const lat = parseFloat(e.latlng.lat.toFixed(6));
        const lon = parseFloat(e.latlng.lng.toFixed(6));
        onMapClick(lat, lon);
      }
    };

    map.off("click");
    map.on("click", handler);
  }, [onMapClick]);

  // Fly to the destination once geocoded, if the map hasn't been touched yet
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initialCenter) return;
    if (places.length > 0 || pendingLatLon) return;
    map.flyTo([initialCenter.lat, initialCenter.lon], initialCenter.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCenter]);

  // Update saved-place markers when places array changes
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (places.length === 0) return;

    const bounds: [number, number][] = [];

    places.forEach((p) => {
      const pinHtml = `
        <div style="
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
        ">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#F43F5E" stroke="#fff" stroke-width="1.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="#fff" stroke="none"/>
          </svg>
        </div>`;

      const icon = L.divIcon({
        html: pinHtml,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
      });

      const marker = L.marker([p.lat, p.lon], { icon })
        .addTo(map)
        .bindPopup(
          `<strong style="font-size:13px">${p.name}</strong>${
            p.note
              ? `<br/><span style="color:#64748b;font-size:12px">${p.note}</span>`
              : ""
          }`
        );

      markersRef.current.push(marker);
      bounds.push([p.lat, p.lon]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 10);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [places]);

  // Update pending (gold) marker
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    // Remove existing pending marker
    if (pendingMarkerRef.current) {
      pendingMarkerRef.current.remove();
      pendingMarkerRef.current = null;
    }

    if (!pendingLatLon) return;

    const pulseHtml = `
      <div style="
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        animation: leaflet-pulse 1.2s ease-in-out infinite;
        filter: drop-shadow(0 2px 6px rgba(245,158,11,0.6));
      ">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="#F59E0B" stroke="#fff" stroke-width="1.5">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5" fill="#fff" stroke="none"/>
        </svg>
      </div>`;

    const icon = L.divIcon({
      html: pulseHtml,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const marker = L.marker([pendingLatLon.lat, pendingLatLon.lon], { icon }).addTo(map);
    pendingMarkerRef.current = marker;
    map.flyTo([pendingLatLon.lat, pendingLatLon.lon], Math.max(map.getZoom(), 8));
  }, [pendingLatLon]);

  return (
    <>
      <style>{`
        @keyframes leaflet-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.75; }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(11,25,48,0.18);
        }
        .leaflet-popup-content { margin: 10px 12px; }
        .leaflet-popup-tip { box-shadow: 0 4px 10px rgba(11,25,48,0.1); }
        .leaflet-container { font-family: var(--font-body), system-ui, sans-serif; }
        .leaflet-control-zoom a {
          border-radius: 6px !important;
          color: #0E1726 !important;
        }
      `}</style>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height,
          borderRadius: 10,
          overflow: "hidden",
          zIndex: 0,
        }}
      />
    </>
  );
}

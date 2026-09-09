"use client";

// Matches the fixed subdomain LeafletMap.tsx uses for its tile layer —
// keep them in sync or prefetched tiles won't cache-hit for the live map.
const TILE_TEMPLATE = "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png";

function lonToTileX(lon: number, z: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function latToTileY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

export interface LatLonBounds { minLat: number; maxLat: number; minLon: number; maxLon: number; }

export function tileCountForBounds(bounds: LatLonBounds, zooms: number[]): number {
  let count = 0;
  for (const z of zooms) {
    const x1 = lonToTileX(bounds.minLon, z), x2 = lonToTileX(bounds.maxLon, z);
    const y1 = latToTileY(bounds.maxLat, z), y2 = latToTileY(bounds.minLat, z);
    count += (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1);
  }
  return count;
}

// Downloads the map tiles covering `bounds` at each zoom in `zooms`. Plain
// fetch() calls — the service worker's fetch handler intercepts and caches
// each one, so this needs no direct Cache Storage access from the page.
export async function prefetchMapTiles(
  bounds: LatLonBounds,
  zooms: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const urls: string[] = [];
  for (const z of zooms) {
    const x1 = lonToTileX(bounds.minLon, z), x2 = lonToTileX(bounds.maxLon, z);
    const y1 = latToTileY(bounds.maxLat, z), y2 = latToTileY(bounds.minLat, z);
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        urls.push(TILE_TEMPLATE.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
      }
    }
  }

  let done = 0;
  let idx = 0;
  const CONCURRENCY = 6;
  async function worker() {
    while (idx < urls.length) {
      const i = idx++;
      try { await fetch(urls[i]); } catch { /* one failed tile isn't fatal */ }
      done++;
      onProgress?.(done, urls.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  return urls.length;
}

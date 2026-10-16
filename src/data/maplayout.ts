export function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Distance from the middle, as a fraction of the map radius. Faster answers
 * sit closer to the middle; 400 ms and beyond sit at the edge.
 */
export function radiusFracFor(latency: number | null): number {
  if (latency == null) return 0.55;
  return Math.min(0.95, 0.3 + (0.65 * Math.log(Math.max(1, latency))) / Math.log(400));
}

export function placeEndpoint(host: string, latency: number | null): { angle: number; radiusFrac: number } {
  return { angle: 20 + (stableHash(host) % 320), radiusFrac: radiusFracFor(latency) };
}

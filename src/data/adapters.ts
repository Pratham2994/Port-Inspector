export interface AdapterStats {
  rx: number;
  tx: number;
}

/**
 * Sums cumulative byte counters across adapters from
 * `Get-NetAdapterStatistics | ConvertTo-Json` (an object for one adapter,
 * an array for several). Null when the payload holds no usable counters.
 */
export function parseAdapterStats(json: string): AdapterStats | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const list = Array.isArray(data) ? data : [data];
  let rx = 0;
  let tx = 0;
  let usable = 0;
  for (const a of list) {
    if (!a || typeof a !== "object") continue;
    const r = Number((a as Record<string, unknown>).ReceivedBytes);
    const t = Number((a as Record<string, unknown>).SentBytes);
    if (Number.isFinite(r) && Number.isFinite(t)) {
      rx += r;
      tx += t;
      usable++;
    }
  }
  return usable ? { rx, tx } : null;
}

/** Cumulative counters over dt seconds become KB/s. Resets read as zero. */
export function ratesFromDeltas(
  prev: AdapterStats | null,
  next: AdapterStats,
  dt: number,
): { down: number; up: number } {
  if (!prev || dt <= 0) return { down: 0, up: 0 };
  const kb = (delta: number) => (delta <= 0 ? 0 : Math.round((delta / dt / 1e3) * 10) / 10);
  return { down: kb(next.rx - prev.rx), up: kb(next.tx - prev.tx) };
}

const REFRESH_MS = 10_000;
const NULL_TTL_MS = 30_000;

/** Reads ping.exe output: `time=12ms` → 12, `time<1ms` → 0, anything else → null. */
export function parsePing(out: string): number | null {
  const m = out.match(/time([=<])(\d+)ms/i);
  if (!m) return null;
  return m[1] === "<" ? 0 : Number(m[2]);
}

/**
 * Remembers ping results per host: hits live 10s, failures 30s, and
 * concurrent asks for the same host share one in-flight ping.
 */
export class LatencyCache {
  private values = new Map<string, { value: number | null; at: number }>();
  private inflight = new Map<string, Promise<number | null>>();

  constructor(
    private pingFn: (ip: string) => Promise<number | null>,
    private now: () => number = Date.now,
  ) {}

  get(ip: string): Promise<number | null> {
    const cur = this.values.get(ip);
    if (cur) {
      const ttl = cur.value == null ? NULL_TTL_MS : REFRESH_MS;
      if (this.now() - cur.at < ttl) return Promise.resolve(cur.value);
    }
    const existing = this.inflight.get(ip);
    if (existing) return existing;

    const p = this.pingFn(ip)
      .catch(() => null)
      .then((value) => {
        this.values.set(ip, { value, at: this.now() });
        this.inflight.delete(ip);
        return value;
      });
    this.inflight.set(ip, p);
    return p;
  }
}

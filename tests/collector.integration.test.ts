import { describe, expect, test } from "vitest";
import { startCollector } from "../src/data/collector";
import type { Snapshot } from "../src/data/types";

// Real-machine integration check: runs netstat on this Windows PC and proves
// the collector emits live, process-resolved connections.
describe("startCollector against the real machine", () => {
  test(
    "emits a snapshot with connections",
    async () => {
      const snap = await new Promise<Snapshot>((resolve, reject) => {
        const stop = startCollector((s) => {
          resolve(s);
          stop();
        }, { intervalMs: 500 });
        setTimeout(() => {
          stop();
          reject(new Error("collector emitted nothing in 10s"));
        }, 10_000);
      });

      expect(snap.conns.length).toBeGreaterThan(0);
      expect(snap.totals.conns + snap.totals.listening).toBe(snap.conns.length);
      for (const c of snap.conns) {
        expect(c.procName.length).toBeGreaterThan(0);
        expect(c.key.length).toBeGreaterThan(0);
        expect(c.firstSeen).toBeLessThanOrEqual(snap.t);
      }
      // at least one process name must have resolved beyond the pid fallback
      expect(snap.conns.some((c) => !c.procName.startsWith("pid "))).toBe(true);
    },
    15_000,
  );
});

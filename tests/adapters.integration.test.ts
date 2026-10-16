import { describe, expect, test } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";

const run = promisify(execFile);

// Evidence harness: how slow is a PowerShell adapter-stats spawn, and does it
// succeed with a bare "powershell" name at all?
describe("adapter stats spawn timing", () => {
  test(
    "powershell resolves and answers within a usable time",
    async () => {
      const times: number[] = [];
      for (let i = 0; i < 3; i++) {
        const started = Date.now();
        const { stdout } = await run(
          "powershell",
          ["-NoProfile", "-Command", "Get-NetAdapterStatistics | ConvertTo-Json"],
          { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
        );
        const took = Date.now() - started;
        times.push(took);
        expect(stdout).toMatch(/ReceivedBytes/);
      }
      console.log("spawn times ms:", times.join(", "));
      expect(Math.min(...times)).toBeLessThan(3_500);
    },
    30_000,
  );
});

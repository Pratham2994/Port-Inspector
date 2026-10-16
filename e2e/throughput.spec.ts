import { test, expect, _electron as electron } from "@playwright/test";

test("header shows live throughput under real load", async () => {
  const app = await electron.launch({ args: ["out/main/index.js"] });
  const win = await app.firstWindow();
  await win.waitForSelector(".stats", { timeout: 10_000 });

  // Pull ~60 MB over several seconds so any working rate meter must read > 0.
  const ctrl = new AbortController();
  const load = (async () => {
    for (let i = 0; i < 4; i++) {
      const res = await fetch("https://speed.cloudflare.com/__down?bytes=15000000", { signal: ctrl.signal });
      await res.arrayBuffer();
    }
  })().catch(() => {});

  let seen = "";
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    seen = await win.locator(".stats").innerText();
    if (/[1-9]\d*\.\d\s*MB\/s|0\.[1-9]\d*\s*MB\/s/.test(seen)) break;
    await win.waitForTimeout(400);
  }
  ctrl.abort();
  await load;
  await app.close();

  expect(seen).toMatch(/[1-9]\d*\.\d\s*MB\/s|0\.[1-9]\d*\s*MB\/s/);
});

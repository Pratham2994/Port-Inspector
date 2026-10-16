import { test, expect, _electron as electron } from "@playwright/test";

test("the window opens with live rows", async () => {
  const app = await electron.launch({ args: ["out/main/index.js"] });
  const win = await app.firstWindow();

  await expect(win).toHaveTitle("Port Inspector");
  await win.waitForSelector(".wordmark", { timeout: 10_000 });
  await expect(win.locator(".wordmark")).toHaveText(/PORT\s+INSPECTOR/);

  await win.waitForSelector(".row", { timeout: 10_000 });
  const rows = await win.locator(".row").count();
  expect(rows).toBeGreaterThan(0);

  expect(await win.locator(".tooltip").count()).toBe(1);

  await win.screenshot({ path: "e2e/out/smoke.png" });
  await app.close();
});

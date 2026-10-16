import { describe, expect, test } from "vitest";
import { procInfo } from "../src/data/processes";

describe("procInfo", () => {
  test("knows svchost and says the many doors are normal", () => {
    const p = procInfo("svchost.exe");
    expect(p?.what).toBe("Windows' shared helper");
    expect(p?.verdict).toBe("windows");
    expect(p?.why).toMatch(/normal/i);
  });

  test("knows the kernel pseudo-process", () => {
    expect(procInfo("System")?.verdict).toBe("windows");
  });

  test("knows browsers as things you installed", () => {
    expect(procInfo("chrome.exe")?.verdict).toBe("known");
    expect(procInfo("msedge.exe")?.verdict).toBe("known");
  });

  test("unknown names are marked unknown with honest advice", () => {
    const p = procInfo("totally_mystery_app.exe");
    expect(p?.verdict).toBe("unknown");
    expect(p?.verdictText).toMatch(/Task Manager/);
  });

  test("no em dashes in any copy", () => {
    for (const name of ["svchost.exe", "System", "chrome.exe", "x.exe"]) {
      const p = procInfo(name)!;
      for (const s of [p.what, p.why ?? "", p.verdictText]) {
        expect(s).not.toContain("\u2014");
      }
    }
  });
});

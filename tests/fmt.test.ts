import { describe, expect, test } from "vitest";
import { fmtRate, shortAddr } from "../src/fmt";

describe("fmtRate", () => {
  test("small rates read in KB/s", () => {
    expect(fmtRate(21.5)).toBe("22 KB/s");
    expect(fmtRate(342)).toBe("342 KB/s");
    expect(fmtRate(999.94)).toBe("1000 KB/s");
  });

  test("large rates read in MB/s with one decimal", () => {
    expect(fmtRate(1000)).toBe("1.0 MB/s");
    expect(fmtRate(4200)).toBe("4.2 MB/s");
  });
});

describe("shortAddr", () => {
  test("IPv6 shows its first groups and an ellipsis", () => {
    expect(shortAddr("2a00:1450:4001:81f::200e")).toBe("2a00:1450:4001...");
    expect(shortAddr("2401:db00::1")).toBe("2401:db00...");
  });

  test("short IPv6 stays whole", () => {
    expect(shortAddr("::1")).toBe("::1");
  });

  test("IPv4 stays whole", () => {
    expect(shortAddr("142.250.185.78")).toBe("142.250.185.78");
  });
});

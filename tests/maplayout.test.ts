import { describe, expect, test } from "vitest";
import { placeEndpoint } from "../src/data/maplayout";

describe("placeEndpoint", () => {
  test("an unknown latency sits at the default radius", () => {
    expect(placeEndpoint("a", null).radiusFrac).toBe(0.55);
  });

  test("12 ms lands just inside the first ring", () => {
    expect(placeEndpoint("a", 12).radiusFrac).toBeCloseTo(0.57, 2);
  });

  test("400 ms caps at the outer edge", () => {
    expect(placeEndpoint("a", 400).radiusFrac).toBe(0.95);
  });

  test("same host always gets the same angle", () => {
    expect(placeEndpoint("1.2.3.4", 5).angle).toBe(placeEndpoint("1.2.3.4", 999).angle);
  });

  test("angles stay in the 20..339 degree band", () => {
    for (const host of ["a", "b", "1.2.3.4", "::1", "255.255.255.255", "142.250.185.78"]) {
      const a = placeEndpoint(host, null).angle;
      expect(a).toBeGreaterThanOrEqual(20);
      expect(a).toBeLessThan(340);
    }
  });
});

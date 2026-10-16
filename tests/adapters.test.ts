import { describe, expect, test } from "vitest";
import { parseAdapterStats, ratesFromDeltas } from "../src/data/adapters";

describe("parseAdapterStats", () => {
  test("sums counters across adapters in an array", () => {
    const json = JSON.stringify([
      { Name: "Ethernet", ReceivedBytes: 1_000_000, SentBytes: 2_000_000 },
      { Name: "Wi-Fi", ReceivedBytes: 500_000, SentBytes: 100_000 },
    ]);
    expect(parseAdapterStats(json)).toEqual({ rx: 1_500_000, tx: 2_100_000 });
  });

  test("reads a single adapter object", () => {
    const json = JSON.stringify({ Name: "Ethernet", ReceivedBytes: 42, SentBytes: 7 });
    expect(parseAdapterStats(json)).toEqual({ rx: 42, tx: 7 });
  });

  test("an empty object is null", () => {
    expect(parseAdapterStats("{}")).toBeNull();
  });

  test("garbage is null", () => {
    expect(parseAdapterStats("not json")).toBeNull();
  });
});

describe("ratesFromDeltas", () => {
  test("deltas become KB/s rounded to one decimal", () => {
    expect(ratesFromDeltas({ rx: 0, tx: 0 }, { rx: 1_000_000, tx: 500_000 }, 1)).toEqual({ down: 1000, up: 500 });
    expect(ratesFromDeltas({ rx: 0, tx: 0 }, { rx: 21_500, tx: 0 }, 1)).toEqual({ down: 21.5, up: 0 });
  });

  test("the first poll is quiet", () => {
    expect(ratesFromDeltas(null, { rx: 1_000_000, tx: 1_000_000 }, 1)).toEqual({ down: 0, up: 0 });
  });

  test("a counter reset reads as zero", () => {
    expect(ratesFromDeltas({ rx: 5_000_000, tx: 5_000_000 }, { rx: 100, tx: 100 }, 1)).toEqual({ down: 0, up: 0 });
  });
});

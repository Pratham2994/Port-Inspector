import { describe, expect, test } from "vitest";
import { LatencyCache, parsePing } from "../src/data/latency";

describe("parsePing", () => {
  test("reads a millisecond time", () => {
    expect(parsePing("Reply from 142.250.185.78: bytes=32 time=12ms TTL=118")).toBe(12);
  });

  test("reads sub-millisecond replies as 0", () => {
    expect(parsePing("Reply from 192.168.1.1: bytes=32 time<1ms TTL=128")).toBe(0);
  });

  test("timeout is null", () => {
    expect(parsePing("Request timed out.")).toBeNull();
  });

  test("unreachable host is null", () => {
    expect(parsePing("Destination host unreachable.")).toBeNull();
  });

  test("empty output is null", () => {
    expect(parsePing("")).toBeNull();
  });
});

describe("LatencyCache", () => {
  test("caches a value for 10 seconds", async () => {
    let calls = 0;
    let t = 0;
    const cache = new LatencyCache(async () => {
      calls++;
      return 12;
    }, () => t);

    expect(await cache.get("1.2.3.4")).toBe(12);
    expect(await cache.get("1.2.3.4")).toBe(12);
    expect(calls).toBe(1);

    t = 9_999;
    await cache.get("1.2.3.4");
    expect(calls).toBe(1);

    t = 10_001;
    await cache.get("1.2.3.4");
    expect(calls).toBe(2);
  });

  test("dedups in-flight pings for the same ip", async () => {
    let calls = 0;
    let resolve!: (v: number) => void;
    const cache = new LatencyCache(() => {
      calls++;
      return new Promise<number>((r) => (resolve = r));
    });

    const p1 = cache.get("8.8.8.8");
    const p2 = cache.get("8.8.8.8");
    expect(calls).toBe(1);
    resolve(30);
    expect(await p1).toBe(30);
    expect(await p2).toBe(30);
  });

  test("caches a failure for 30 seconds", async () => {
    let calls = 0;
    let t = 0;
    const cache = new LatencyCache(async () => {
      calls++;
      return null;
    }, () => t);

    expect(await cache.get("10.0.0.1")).toBeNull();
    t = 29_000;
    await cache.get("10.0.0.1");
    expect(calls).toBe(1);

    t = 30_001;
    await cache.get("10.0.0.1");
    expect(calls).toBe(2);
  });

  test("a rejected ping counts as null, not a crash", async () => {
    const cache = new LatencyCache(async () => {
      throw new Error("ping exploded");
    });
    expect(await cache.get("10.0.0.2")).toBeNull();
  });
});

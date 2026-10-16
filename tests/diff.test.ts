import { describe, expect, test } from "vitest";
import { connKey, diffSnapshots } from "../src/data/diff";

describe("connKey", () => {
  test("joins proto, local, remote and state", () => {
    const key = connKey({
      proto: "tcp",
      localAddr: "192.168.1.24",
      localPort: 53128,
      remoteAddr: "142.250.185.78",
      remotePort: 443,
      state: "ESTABLISHED",
    });
    expect(key).toBe("tcp|192.168.1.24:53128|142.250.185.78:443|ESTABLISHED");
  });

  test("renders absent remotes as null", () => {
    const key = connKey({
      proto: "udp",
      localAddr: "0.0.0.0",
      localPort: 5353,
      remoteAddr: null,
      remotePort: null,
      state: "LISTENING",
    });
    expect(key).toBe("udp|0.0.0.0:5353|null:null|LISTENING");
  });
});

describe("diffSnapshots", () => {
  test("empty to three keys gives three arrivals", () => {
    const r = diffSnapshots(new Set(), new Set(["a", "b", "c"]));
    expect([...r.arrivals].sort()).toEqual(["a", "b", "c"]);
    expect(r.departures).toEqual([]);
  });

  test("same set gives nothing", () => {
    const r = diffSnapshots(new Set(["a", "b", "c"]), new Set(["a", "b", "c"]));
    expect(r.arrivals).toEqual([]);
    expect(r.departures).toEqual([]);
  });

  test("one removed gives one departure", () => {
    const r = diffSnapshots(new Set(["a", "b", "c"]), new Set(["a", "c"]));
    expect(r.arrivals).toEqual([]);
    expect(r.departures).toEqual(["b"]);
  });

  test("a state change is a departure and an arrival", () => {
    const before = connKey({ proto: "tcp", localAddr: "1.2.3.4", localPort: 5000, remoteAddr: "5.6.7.8", remotePort: 443, state: "ESTABLISHED" });
    const after = connKey({ proto: "tcp", localAddr: "1.2.3.4", localPort: 5000, remoteAddr: "5.6.7.8", remotePort: 443, state: "TIME_WAIT" });
    const r = diffSnapshots(new Set([before]), new Set([after]));
    expect(r.arrivals).toEqual([after]);
    expect(r.departures).toEqual([before]);
  });

  test("500-key churn counts exactly", () => {
    const before = new Set(Array.from({ length: 500 }, (_, i) => `k${i}`));
    const after = new Set(Array.from({ length: 500 }, (_, i) => `k${i + 100}`));
    const r = diffSnapshots(before, after);
    expect(r.arrivals).toHaveLength(100);
    expect(r.departures).toHaveLength(100);
  });
});

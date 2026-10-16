import { describe, expect, test } from "vitest";
import type { Connection } from "../src/data/types";
import { listenerDoors, othersCount, remoteClusters, talkerGroups } from "../src/data/clusters";

function conn(p: Partial<Connection> & Pick<Connection, "procName" | "pid" | "remoteAddr" | "remotePort">): Connection {
  return {
    key: `${p.procName}|${p.pid}|${p.remoteAddr}:${p.remotePort}|${p.state}|${Math.random()}`,
    proto: "tcp",
    localAddr: "192.168.1.24",
    localPort: 50000 + Math.floor(Math.random() * 10000),
    remotePort: null,
    state: "established",
    firstSeen: Date.now() - 1000,
    ...(p as object),
  } as Connection;
}

describe("remoteClusters", () => {
  test("hosts in the same /24 merge into one cluster", () => {
    const conns = [
      conn({ procName: "chrome.exe", pid: 1, remoteAddr: "142.250.185.78", remotePort: 443 }),
      conn({ procName: "chrome.exe", pid: 1, remoteAddr: "142.250.185.200", remotePort: 443 }),
      conn({ procName: "chrome.exe", pid: 1, remoteAddr: "142.250.185.99", remotePort: 443 }),
    ];
    const clusters = remoteClusters(conns, {});
    expect(clusters).toHaveLength(1);
    expect(clusters[0].net).toBe("142.250.185");
    expect(clusters[0].hosts).toBe(3);
    expect(clusters[0].sockets).toBe(3);
    expect(clusters[0].ports).toEqual([443]);
  });

  test("different processes to the same network cluster together", () => {
    const conns = [
      conn({ procName: "chrome.exe", pid: 1, remoteAddr: "20.42.65.10", remotePort: 443 }),
      conn({ procName: "chrome.exe", pid: 1, remoteAddr: "20.42.65.11", remotePort: 443 }),
      conn({ procName: "Code.exe", pid: 2, remoteAddr: "20.42.65.12", remotePort: 443 }),
      conn({ procName: "Code.exe", pid: 2, remoteAddr: "20.42.65.13", remotePort: 7443 }),
    ];
    const clusters = remoteClusters(conns, {});
    expect(clusters).toHaveLength(1);
    expect(clusters[0].sockets).toBe(4);
    expect(clusters[0].dominantProc).toBe("chrome.exe");
    expect(clusters[0].procs).toEqual(["chrome.exe", "Code.exe"]);
  });

  test("loopback remotes never appear as places elsewhere", () => {
    const conns = [conn({ procName: "Discord.exe", pid: 1, remoteAddr: "127.0.0.1", remotePort: 54550 })];
    expect(remoteClusters(conns, {})).toHaveLength(0);
  });

  test("picks up the fastest known latency in the cluster", () => {
    const conns = [
      conn({ procName: "a.exe", pid: 1, remoteAddr: "8.8.8.8", remotePort: 443 }),
      conn({ procName: "a.exe", pid: 1, remoteAddr: "8.8.8.9", remotePort: 443 }),
    ];
    const clusters = remoteClusters(conns, { "8.8.8.9": 14, "8.8.8.8": null });
    expect(clusters[0].minLatency).toBe(14);
  });

  test("caps rendered clusters and reports the rest", () => {
    const conns = Array.from({ length: 20 }, (_, i) =>
      conn({ procName: "a.exe", pid: 1, remoteAddr: `10.${i}.0.1`, remotePort: 443 }),
    );
    expect(remoteClusters(conns, {}, 12)).toHaveLength(12);
    expect(othersCount(conns, {}, 12)).toBe(8);
  });

  test("empty conns give nothing", () => {
    expect(remoteClusters([], {})).toHaveLength(0);
  });
});

describe("listenerDoors", () => {
  test("merges sockets on the same port and reports the total", () => {
    const conns = [
      conn({ procName: "svchost.exe", pid: 1028, remoteAddr: null, remotePort: null, state: "listening", localPort: 135 }),
      conn({ procName: "svchost.exe", pid: 1028, remoteAddr: null, remotePort: null, state: "listening", localPort: 135 }),
      conn({ procName: "svchost.exe", pid: 1028, remoteAddr: null, remotePort: null, state: "listening", localPort: 49670 }),
    ];
    const { doors, total } = listenerDoors(conns);
    expect(total).toBe(3);
    expect(doors).toHaveLength(2);
    expect(doors.find((d) => d.port === 135)?.sockets).toBe(2);
  });

  test("known ports sort first", () => {
    const conns = [
      conn({ procName: "app.exe", pid: 1, remoteAddr: null, remotePort: null, state: "listening", localPort: 49670 }),
      conn({ procName: "svchost.exe", pid: 1028, remoteAddr: null, remotePort: null, state: "listening", localPort: 135 }),
    ];
    const { doors } = listenerDoors(conns);
    expect(doors[0].port).toBe(135);
    expect(doors[0].info?.name).toBe("RPC");
  });
});

describe("talkerGroups", () => {
  test("merges a process' connections with places and earliest first-seen", () => {
    const old = Date.now() - 60_000;
    const conns = [
      { ...conn({ procName: "chrome.exe", pid: 8, remoteAddr: "142.250.185.78", remotePort: 443 }), firstSeen: old },
      conn({ procName: "chrome.exe", pid: 8, remoteAddr: "142.250.185.200", remotePort: 443 }),
      conn({ procName: "chrome.exe", pid: 8, remoteAddr: "142.250.185.78", remotePort: 2196 }),
    ];
    const { talkers, finished } = talkerGroups(conns);
    expect(finished).toBe(0);
    expect(talkers).toHaveLength(1);
    const t = talkers[0];
    expect(t.procName).toBe("chrome.exe");
    expect(t.sockets).toBe(3);
    expect(t.firstSeen).toBe(old);
    expect(t.places).toHaveLength(2);
    expect(t.places.find((p) => p.host === "142.250.185.78")?.ports).toEqual([443, 2196]);
  });

  test("counts closed connections separately and keeps loopback places", () => {
    const conns = [
      conn({ procName: "a.exe", pid: 1, remoteAddr: "142.250.1.1", remotePort: 443, state: "wait" }),
      conn({ procName: "Discord.exe", pid: 2, remoteAddr: "127.0.0.1", remotePort: 54550 }),
    ];
    const { talkers, finished } = talkerGroups(conns);
    expect(finished).toBe(1);
    expect(talkers).toHaveLength(1);
    expect(talkers[0].places[0].host).toBe("127.0.0.1");
  });

  test("carries the process verdict with it", () => {
    const conns = [conn({ procName: "svchost.exe", pid: 1028, remoteAddr: "1.2.3.4", remotePort: 443 })];
    const { talkers } = talkerGroups(conns);
    expect(talkers[0].proc.verdict).toBe("windows");
  });
});

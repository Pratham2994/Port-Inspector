import type { Connection, Snapshot } from "./types";

const NOW = Date.now();

function mk(procName: string, pid: number, localPort: number, remoteAddr: string | null, remotePort: number | null, state: Connection["state"], firstSeen: number, n = 1, localAddr = "192.168.1.24"): Connection[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `${procName}|${localAddr}:${localPort + i}|${remoteAddr ?? "*"}:${remotePort ?? "*"}|${state}|${i}`,
    proto: "tcp" as const,
    localAddr,
    localPort: remoteAddr != null ? localPort + i : localPort,
    remoteAddr,
    remotePort,
    state,
    pid,
    procName,
    firstSeen,
  }));
}

const MIN = 60_000, HOUR = 60 * MIN;

export const mockConnections: Connection[] = [
  ...mk("chrome.exe", 812, 53_128, "142.250.185.78", 443, "established", NOW - 2 * HOUR - 6 * MIN, 8),
  ...mk("steam.exe", 3_204, 50_112, "23.45.11.90", 443, "established", NOW - 41 * MIN, 2),
  ...mk("docker-proxy", 5_180, 2_375, null, null, "listening", NOW - 6 * 24 * HOUR, 1, "0.0.0.0"),
  ...mk("svchost.exe", 1_028, 135, null, null, "listening", NOW - 3 * 24 * HOUR - 14 * HOUR, 4, "0.0.0.0"),
  ...mk("spotify.exe", 9_044, 52_300, "35.186.224.25", 57_621, "established", NOW - 1 * HOUR - 22 * MIN, 3),
  ...mk("Code.exe", 12_144, 51_776, "20.42.65.92", 443, "established", NOW - 18 * MIN, 6),
];

export const demoArrival: Connection = {
  key: "onedrive|192.168.1.24:53001|13.107.42.12:443|established",
  proto: "tcp",
  localAddr: "192.168.1.24",
  localPort: 53_001,
  remoteAddr: "13.107.42.12",
  remotePort: 443,
  state: "established",
  pid: 7_780,
  procName: "onedrive.exe",
  firstSeen: NOW,
};

export function mockSnapshot(t: number, extra: Connection[] = []): Snapshot {
  const conns = [...mockConnections, ...extra];
  return {
    t,
    conns,
    totals: {
      conns: conns.filter((c) => c.state !== "listening").length + 32,
      listening: conns.filter((c) => c.state === "listening").length + 10,
      down: 4.2,
      up: 1.1,
    },
  };
}

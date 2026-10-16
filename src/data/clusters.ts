import type { Connection } from "./types";
import { procInfo, type ProcInfo } from "./processes";
import { portInfo, type PortEntry } from "./ports";

export interface Place {
  host: string;
  ports: number[];
  sockets: number;
  firstSeen: number;
}

export interface TalkerGroup {
  key: string;
  pid: number;
  /** How many separate processes share this name (Electron apps run many). */
  pids: number;
  procName: string;
  proc: ProcInfo;
  sockets: number;
  /** Connections that stay inside this PC: parts of programs talking to each other. */
  localSockets: number;
  places: Place[];
  firstSeen: number;
}

export interface RemoteCluster {
  net: string;
  hosts: number;
  sockets: number;
  procs: string[];
  ports: number[];
  dominantProc: string;
  dominantPid: number;
  minLatency: number | null;
}

export interface ListenerDoor {
  port: number;
  pid: number;
  procName: string;
  proc: ProcInfo;
  sockets: number;
  bindAddr: string;
  info: PortEntry | null;
}

const netOf = (addr: string): string => {
  if (addr.includes(":")) {
    const parts = addr.split(":").filter(Boolean);
    return parts.slice(0, 2).join(":");
  }
  const octets = addr.split(".");
  return octets.length === 4 ? octets.slice(0, 3).join(".") : addr;
};

const isLoopback = (addr: string | null): boolean =>
  addr != null && (addr === "::1" || addr.startsWith("127."));

/**
 * Groups established connections into remote networks (a /24 for IPv4, a /48
 * for IPv6), so the map shows "places", not one dot per socket. Loopback
 * never counts: it is inside this PC, not somewhere else.
 */
export function remoteClusters(
  conns: Connection[],
  latencies: Record<string, number | null>,
  cap = 12,
): RemoteCluster[] {
  interface Acc {
    hosts: Set<string>;
    byProc: Map<string, { n: number; pid: number }>;
    ports: Set<number>;
    latencies: number[];
    nullLatency: boolean;
  }
  const acc = new Map<string, Acc>();

  for (const c of conns) {
    if (c.state !== "established" || c.remoteAddr == null || isLoopback(c.remoteAddr)) continue;
    const net = netOf(c.remoteAddr);
    let a = acc.get(net);
    if (!a) {
      a = { hosts: new Set(), byProc: new Map(), ports: new Set(), latencies: [], nullLatency: false };
      acc.set(net, a);
    }
    a.hosts.add(c.remoteAddr);
    a.ports.add(c.remotePort ?? 0);
    const p = a.byProc.get(c.procName) ?? { n: 0, pid: c.pid };
    p.n++;
    p.pid = c.pid;
    a.byProc.set(c.procName, p);
    const lat = latencies[c.remoteAddr];
    if (lat != null) a.latencies.push(lat);
    else if (c.remoteAddr in latencies) a.nullLatency = true;
  }

  const clusters: RemoteCluster[] = [];
  for (const [net, a] of acc) {
    const procs = [...a.byProc.entries()].sort((x, y) => y[1].n - x[1].n);
    const latenciesKnown = a.latencies.length ? Math.min(...a.latencies) : null;
    clusters.push({
      net,
      hosts: a.hosts.size,
      sockets: [...a.byProc.values()].reduce((n, p) => n + p.n, 0),
      procs: procs.map(([name]) => name),
      ports: [...a.ports].sort((x, y) => x - y),
      dominantProc: procs[0][0],
      dominantPid: procs[0][1].pid,
      minLatency: latenciesKnown,
    });
  }
  clusters.sort((x, y) => y.sockets - x.sockets);
  return clusters.slice(0, cap);
}

/** How many distinct networks fell outside the cap, for an honest caption. */
export function othersCount(conns: Connection[], latencies: Record<string, number | null>, cap = 12): number {
  return Math.max(0, remoteClusters(conns, latencies, Number.POSITIVE_INFINITY).length - cap);
}

/** Every listening door, one row per port per process, known ports first. */
export function listenerDoors(conns: Connection[]): { doors: ListenerDoor[]; total: number } {
  const acc = new Map<string, ListenerDoor>();
  let total = 0;
  for (const c of conns) {
    if (c.state !== "listening") continue;
    total++;
    const key = `${c.pid}|${c.localPort}`;
    let d = acc.get(key);
    if (!d) {
      d = {
        port: c.localPort,
        pid: c.pid,
        procName: c.procName,
        proc: procInfo(c.procName),
        sockets: 0,
        bindAddr: c.localAddr,
        info: portInfo(c.localPort),
      };
      acc.set(key, d);
    }
    // A wildcard binding matters more than a specific address when both exist.
    if (d.bindAddr !== "0.0.0.0" && c.localAddr === "0.0.0.0") d.bindAddr = c.localAddr;
    d.sockets++;
  }
  const doors = [...acc.values()].sort((x, y) => {
    const kx = x.info ? 0 : 1;
    const ky = y.info ? 0 : 1;
    if (kx !== ky) return kx - ky;
    if (kx === 0) return x.port - y.port;
    return y.sockets - x.sockets;
  });
  return { doors, total };
}

/**
 * List rows: one row per process that is talking. Each row carries where it
 * talks (places), how many lines it holds, and what kind of program it is.
 */
export function talkerGroups(conns: Connection[]): { talkers: TalkerGroup[]; finished: number } {
  let finished = 0;
  // Keyed by name: one app often runs as many processes (Claude, browsers),
  // and the person thinks of it as one program.
  const acc = new Map<
    string,
    { pid: number; pids: Set<number>; sockets: number; localSockets: number; places: Map<string, Place>; firstSeen: number }
  >();

  for (const c of conns) {
    if (c.state === "listening") continue;
    if (c.state === "wait" || c.state === "close") {
      finished++;
      continue;
    }
    let t = acc.get(c.procName);
    if (!t) {
      t = { pid: c.pid, pids: new Set(), sockets: 0, localSockets: 0, places: new Map(), firstSeen: c.firstSeen };
      acc.set(c.procName, t);
    }
    t.pids.add(c.pid);
    if (c.firstSeen < t.firstSeen) t.firstSeen = c.firstSeen;
    t.sockets++;
    if (c.remoteAddr == null || isLoopback(c.remoteAddr)) t.localSockets++;
    const host = c.remoteAddr ?? "this PC";
    let p = t.places.get(host);
    if (!p) {
      p = { host, ports: [], sockets: 0, firstSeen: c.firstSeen };
      t.places.set(host, p);
    }
    if (c.remotePort != null && !p.ports.includes(c.remotePort)) p.ports.push(c.remotePort);
    if (c.firstSeen < p.firstSeen) p.firstSeen = c.firstSeen;
    p.sockets++;
  }

  const talkers: TalkerGroup[] = [...acc.entries()]
    .map(([procName, t]) => ({
      key: procName,
      pid: t.pid,
      pids: t.pids.size,
      procName,
      proc: procInfo(procName),
      sockets: t.sockets,
      localSockets: t.localSockets,
      // Outside places first, then busiest.
      places: [...t.places.values()].sort(
        (x, y) => Number(isLoopback(x.host)) - Number(isLoopback(y.host)) || y.sockets - x.sockets,
      ),
      firstSeen: t.firstSeen,
    }))
    .sort((x, y) => y.sockets - x.sockets);

  return { talkers, finished };
}

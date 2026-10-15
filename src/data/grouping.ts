import type { ConnGroup, Connection, ConnState } from "./types";

function groupKey(c: Connection): string {
  if (c.remoteAddr != null) return `${c.pid}|${c.remoteAddr}|${c.remotePort}`;
  return `${c.pid}|L|${c.localPort}`;
}

function groupState(conns: Connection[]): ConnState {
  if (conns.some((c) => c.state === "established")) return "established";
  if (conns.some((c) => c.state === "listening")) return "listening";
  return conns[0].state;
}

const ORDER: Record<ConnState, number> = { established: 0, other: 1, close: 2, wait: 2, listening: 3 };

export function groupByEndpoint(conns: Connection[]): ConnGroup[] {
  const byKey = new Map<string, Connection[]>();
  for (const c of conns) {
    const k = groupKey(c);
    const list = byKey.get(k);
    if (list) list.push(c);
    else byKey.set(k, [c]);
  }
  const groups: ConnGroup[] = [];
  for (const [key, list] of byKey) {
    const first = list[0];
    groups.push({
      key,
      procName: first.procName,
      pid: first.pid,
      proto: first.proto,
      remoteAddr: first.remoteAddr,
      remotePort: first.remotePort,
      listenPort: first.remoteAddr == null ? first.localPort : null,
      state: groupState(list),
      conns: list,
      firstSeen: Math.min(...list.map((c) => c.firstSeen)),
    });
  }
  groups.sort((a, b) => {
    const d = ORDER[a.state] - ORDER[b.state];
    if (d !== 0) return d;
    return a.procName.localeCompare(b.procName);
  });
  return groups;
}

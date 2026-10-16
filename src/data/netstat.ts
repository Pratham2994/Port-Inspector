import type { RawSocket } from "./types";

function splitAddr(token: string): { addr: string; port: number } | null {
  const v6 = token.match(/^\[(.+)\]:(\d+)$/);
  if (v6) return { addr: v6[1], port: Number(v6[2]) };
  const v4 = token.match(/^(.+):(\d+)$/);
  if (v4) return { addr: v4[1], port: Number(v4[2]) };
  return null;
}

/**
 * Parses `netstat -n -ano` output. TCP rows: `TCP local remote STATE pid`;
 * UDP rows: `UDP local remote pid`. A remote port of 0 (netstat's `0.0.0.0:0`
 * placeholder) and `*:*` both mean "no remote", as listeners have none.
 */
export function parseNetstat(out: string): RawSocket[] {
  const rows: RawSocket[] = [];
  for (const line of out.split(/\r?\n/)) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "TCP" && t.length === 5) {
      const local = splitAddr(t[1]);
      const remote = splitAddr(t[2]);
      if (!local || !/^\d+$/.test(t[4])) continue;
      const hasRemote = remote != null && remote.port !== 0;
      rows.push({
        proto: "tcp",
        localAddr: local.addr,
        localPort: local.port,
        remoteAddr: hasRemote ? remote.addr : null,
        remotePort: hasRemote ? remote.port : null,
        state: t[3].toUpperCase(),
        pid: Number(t[4]),
      });
    } else if (t[0] === "UDP" && t.length === 4) {
      const local = splitAddr(t[1]);
      if (!local || !/^\d+$/.test(t[3])) continue;
      rows.push({
        proto: "udp",
        localAddr: local.addr,
        localPort: local.port,
        remoteAddr: null,
        remotePort: null,
        state: "LISTENING",
        pid: Number(t[3]),
      });
    }
  }
  return rows;
}

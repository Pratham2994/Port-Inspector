export type ConnState = "established" | "listening" | "wait" | "close" | "other";

export interface Connection {
  key: string;
  proto: "tcp" | "udp";
  localAddr: string;
  localPort: number;
  remoteAddr: string | null;
  remotePort: number | null;
  state: ConnState;
  pid: number;
  procName: string;
  firstSeen: number;
}

export interface Totals {
  conns: number;
  listening: number;
  down: number;
  up: number;
}

export interface Snapshot {
  t: number;
  conns: Connection[];
  totals: Totals;
  latencies?: Record<string, number | null>;
}

/** Raw netstat row before it is joined with process names and history. */
export interface RawSocket {
  proto: "tcp" | "udp";
  localAddr: string;
  localPort: number;
  remoteAddr: string | null;
  remotePort: number | null;
  state: string;
  pid: number;
}

/** One list row: every socket one process holds to the same endpoint (or the same listening port). */
export interface ConnGroup {
  key: string;
  procName: string;
  pid: number;
  proto: "tcp" | "udp";
  remoteAddr: string | null;
  remotePort: number | null;
  listenPort: number | null;
  state: ConnState;
  conns: Connection[];
  firstSeen: number;
}

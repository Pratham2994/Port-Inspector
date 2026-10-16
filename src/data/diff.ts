import type { RawSocket } from "./types";

type Keyable = Pick<RawSocket, "proto" | "localAddr" | "localPort" | "remoteAddr" | "remotePort" | "state">;

export function connKey(s: Keyable): string {
  return `${s.proto}|${s.localAddr}:${s.localPort}|${s.remoteAddr}:${s.remotePort}|${s.state}`;
}

export function diffSnapshots(
  prev: Set<string>,
  next: Set<string>,
): { arrivals: string[]; departures: string[] } {
  const arrivals: string[] = [];
  const departures: string[] = [];
  for (const k of next) if (!prev.has(k)) arrivals.push(k);
  for (const k of prev) if (!next.has(k)) departures.push(k);
  return { arrivals, departures };
}

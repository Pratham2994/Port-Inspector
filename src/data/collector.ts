import { execFile, spawn, type ChildProcess } from "child_process";
import { promises as dns } from "dns";
import { promisify } from "util";
import { parseAdapterStats, ratesFromDeltas, type AdapterStats } from "./adapters";
import { connKey } from "./diff";
import { LatencyCache, parsePing } from "./latency";
import { parseNetstat } from "./netstat";
import { parseTasklist } from "./tasklist";
import { stateFromNetstat } from "./states";
import type { Connection, Snapshot, Totals } from "./types";

const run = promisify(execFile);
const MAX_BUFFER = 8 * 1024 * 1024;

const isV4 = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

/** Hosts worth pinging: real remote addresses, no loopback, link-local, multicast or broadcast. */
function pingable(addr: string | null): addr is string {
  if (!addr) return false;
  if (addr === "0.0.0.0" || addr === "::" || addr === "255.255.255.255" || addr === "::1") return false;
  if (addr.startsWith("127.") || addr.startsWith("169.254.") || /^fe80:/i.test(addr)) return false;
  if (/^(22[4-9]|23\d)\./.test(addr) || /^ff/i.test(addr)) return false;
  return isV4(addr) || addr.includes(":");
}

function pingIp(ip: string): Promise<number | null> {
  return run("ping", ["-n", "1", "-w", "1000", ip], { windowsHide: true, maxBuffer: 1024 * 1024 })
    .then(({ stdout }) => parsePing(stdout))
    .catch((e: { stdout?: string }) => parsePing(typeof e?.stdout === "string" ? e.stdout : ""));
}

export interface CollectorOpts {
  intervalMs?: number;
  tasklistRefreshMs?: number;
}

/**
 * Polls netstat for sockets, joins process names from tasklist (cached),
 * keeps first-seen history, and emits a Snapshot every interval. Runs in the
 * Electron main process. Returns a stop function.
 */
export function startCollector(emit: (s: Snapshot) => void, opts: CollectorOpts = {}): () => void {
  const intervalMs = opts.intervalMs ?? 1_000;
  const refreshMs = opts.tasklistRefreshMs ?? 30_000;

  let names = new Map<number, string>();
  let namesAt = 0;
  let namesPending = false;
  const firstSeen = new Map<string, number>();
  const latency = new LatencyCache(pingIp);
  const knownLatencies: Record<string, number | null> = {};
  // Reverse-DNS names, looked up once per address. null means Windows had none.
  const knownNames: Record<string, string | null> = {};
  const namePending = new Set<string>();

  function lookupName(ip: string): void {
    if (ip in knownNames || namePending.has(ip)) return;
    namePending.add(ip);
    dns
      .reverse(ip)
      .then((list) => {
        knownNames[ip] = list[0] ?? null;
      })
      .catch(() => {
        knownNames[ip] = null;
      })
      .finally(() => namePending.delete(ip));
  }
  let stopped = false;
  let ticking = false;

  // Adapter throughput: one long-lived PowerShell prints cumulative counters
  // every second. Spawning a fresh PowerShell per poll took longer than the poll
  // itself, so rates almost never had two samples to compare.
  let prevAdapters: AdapterStats | null = null;
  let prevAdaptersAt = 0;
  let lastRates = { down: 0, up: 0 };
  let adapterProc: ChildProcess | null = null;
  let adapterRestart: NodeJS.Timeout | null = null;

  const ADAPTER_LOOP =
    "while ($true) { Get-NetAdapterStatistics | Select-Object ReceivedBytes,SentBytes | ConvertTo-Json -Compress; Start-Sleep -Milliseconds 1000 }";

  function startAdapters(): void {
    if (stopped) return;
    let buf = "";
    const child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", ADAPTER_LOOP], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    adapterProc = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        const stats = line ? parseAdapterStats(line) : null;
        if (!stats) continue;
        const at = Date.now();
        lastRates = ratesFromDeltas(prevAdapters, stats, (at - prevAdaptersAt) / 1000);
        prevAdapters = stats;
        prevAdaptersAt = at;
      }
    });
    const restart = () => {
      if (adapterProc !== child) return;
      adapterProc = null;
      prevAdapters = null;
      lastRates = { down: 0, up: 0 };
      if (!stopped) adapterRestart = setTimeout(startAdapters, 5_000);
    };
    child.on("exit", restart);
    child.on("error", restart);
  }

  async function refreshNames(): Promise<void> {
    if (namesPending) return;
    namesPending = true;
    try {
      const { stdout } = await run("tasklist", ["/fo", "csv"], { windowsHide: true, maxBuffer: MAX_BUFFER });
      names = parseTasklist(stdout);
    } catch {
      // keep the old names; retry on the next schedule
    } finally {
      namesAt = Date.now();
      namesPending = false;
    }
  }

  async function tick(): Promise<void> {
    if (stopped || ticking) return;
    ticking = true;
    try {
      const { stdout } = await run("netstat", ["-n", "-ano"], { windowsHide: true, maxBuffer: MAX_BUFFER });
      const sockets = parseNetstat(stdout);
      const now = Date.now();

      if (names.size === 0) {
        await refreshNames();
      } else if (sockets.some((s) => s.pid > 0 && !names.has(s.pid)) || now - namesAt > refreshMs) {
        void refreshNames();
      }

      const seen = new Set<string>();
      const conns: Connection[] = [];
      for (const s of sockets) {
        const key = connKey(s);
        if (!seen.has(key)) {
          if (!firstSeen.has(key)) firstSeen.set(key, now);
          seen.add(key);
        }
        conns.push({
          key,
          proto: s.proto,
          localAddr: s.localAddr,
          localPort: s.localPort,
          remoteAddr: s.remoteAddr,
          remotePort: s.remotePort,
          state: stateFromNetstat(s.state, s.proto),
          pid: s.pid,
          procName: names.get(s.pid) ?? `pid ${s.pid}`,
          firstSeen: firstSeen.get(key)!,
        });
      }
      for (const k of firstSeen.keys()) if (!seen.has(k)) firstSeen.delete(k);

      const totals: Totals = {
        conns: conns.filter((c) => c.state !== "listening").length,
        listening: conns.filter((c) => c.state === "listening").length,
        down: lastRates.down,
        up: lastRates.up,
      };

      const hosts = new Set<string>();
      for (const c of conns) {
        if (c.state === "established" && pingable(c.remoteAddr)) {
          hosts.add(c.remoteAddr);
          lookupName(c.remoteAddr);
          void latency.get(c.remoteAddr).then((v) => {
            knownLatencies[c.remoteAddr!] = v;
          });
        }
      }
      const latencies: Record<string, number | null> = {};
      for (const h of hosts) if (h in knownLatencies) latencies[h] = knownLatencies[h];

      const hostnames: Record<string, string | null> = {};
      for (const h of hosts) if (h in knownNames) hostnames[h] = knownNames[h];

      emit({ t: now, conns, totals, latencies, hostnames });
    } catch {
      // netstat failed this tick; keep the last emitted state
    } finally {
      ticking = false;
    }
  }

  startAdapters();
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
    if (adapterRestart) clearTimeout(adapterRestart);
    adapterProc?.kill();
    adapterProc = null;
  };
}

import type { Connection } from "../data/types";
import { radiusFracFor, stableHash } from "../data/maplayout";
import { listenerDoors, othersCount, remoteClusters, type RemoteCluster } from "../data/clusters";
import { procInfo } from "../data/processes";
import { orgFor } from "../data/orgs";
import { shortAddr } from "../fmt";
import { useTip } from "./Tip";

interface Props {
  conns: Connection[];
  /** Process name of the selected list row, if any. */
  selectedProc: string | null;
  latencies: Record<string, number | null>;
  hostnames: Record<string, string | null>;
}

const W = 360, H = 430, CX = W / 2, CY = H / 2, R = 128, NODE = 34;
const CAP = 10;
const RING_12 = R * radiusFracFor(12);
const RING_80 = R * radiusFracFor(80);

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function arcPath(angleDeg: number, r: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const sx = CX + NODE * Math.cos(a), sy = CY + NODE * Math.sin(a);
  const ex = CX + r * Math.cos(a), ey = CY + r * Math.sin(a);
  const mx = (sx + ex) / 2 - Math.sin(a) * r * 0.12;
  const my = (sy + ey) / 2 + Math.cos(a) * r * 0.12;
  return `M ${sx.toFixed(1)},${sy.toFixed(1)} Q ${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

const short = (p: string) => p.replace(/\.exe$/i, "");

/**
 * Clusters sit evenly around the circle in a stable order (by a hash of their
 * network), so labels never pile on top of each other and do not jump around
 * between polls.
 */
function anglesFor(clusters: RemoteCluster[]): Map<string, number> {
  const order = [...clusters].sort((a, b) => stableHash(a.net) - stableHash(b.net));
  const step = 360 / Math.max(order.length, 1);
  const offset = -90 + (order.length > 1 ? step / 2 : 0);
  return new Map(order.map((c, i) => [c.net, offset + i * step]));
}

function localIpOf(conns: Connection[]): string {
  const counts = new Map<string, number>();
  for (const c of conns) {
    const a = c.localAddr;
    if (c.state !== "established" || a === "0.0.0.0" || a === "::" || a === "::1" || a.startsWith("127.")) continue;
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  // IPv4 first: it is short and it is what people recognise. Long IPv6
  // addresses do not fit inside the circle.
  const pick = (v6: boolean) =>
    [...counts.entries()].filter(([a]) => a.includes(":") === v6).sort((x, y) => y[1] - x[1])[0]?.[0];
  const best = pick(false) ?? pick(true);
  if (!best) return "this PC";
  const s = shortAddr(best);
  return s.length > 15 ? `${s.slice(0, 12)}...` : s;
}

/** Owner of a cluster, from its first host with a known owner. */
function clusterOrg(c: RemoteCluster, conns: Connection[], hostnames: Record<string, string | null>): string | null {
  for (const x of conns) {
    if (x.remoteAddr == null || !c.procs.includes(x.procName)) continue;
    if (!(x.remoteAddr === c.net || x.remoteAddr.startsWith(c.net))) continue;
    const org = orgFor(x.remoteAddr, hostnames[x.remoteAddr]);
    if (org) return org;
  }
  return null;
}

function clusterTip(c: RemoteCluster, org: string | null): string {
  const who = c.procs.length > 1 ? `${short(c.dominantProc)} and ${c.procs.length - 1} other program${c.procs.length > 2 ? "s" : ""}` : short(c.dominantProc);
  const what = procInfo(c.dominantProc).what;
  const lat = c.minLatency != null ? ` It answers in about ${c.minLatency} ms.` : "";
  const ports = c.ports.slice(0, 4).join(", ");
  const owner = org ? ` owned by ${org}` : "";
  return `${who} (${what}) talking to ${c.hosts} computer${c.hosts > 1 ? "s" : ""}${owner} (network ${c.net}), ${c.sockets} connection${c.sockets > 1 ? "s" : ""} on port ${ports}.${lat}`;
}

export default function MapCanvas({ conns, selectedProc, latencies, hostnames }: Props) {
  const tip = useTip();
  const clusters = remoteClusters(conns, latencies, CAP);
  const others = othersCount(conns, latencies, CAP);
  const angles = anglesFor(clusters);
  const { doors } = listenerDoors(conns);
  const risky = doors.filter((d) => d.port === 2375);
  const maxSockets = Math.max(1, ...clusters.map((c) => c.sockets));
  const localIp = localIpOf(conns);

  return (
    <div className="map">
      <div className="map-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {[RING_12, RING_80].map((r) => (
            <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          <text x={CX} y={CY + RING_12 + 11} textAnchor="middle" className="map-label dim">~12 ms</text>
          <text x={CX} y={CY + RING_80 + 11} textAnchor="middle" className="map-label dim">~80 ms</text>

          {clusters.map((c) => {
            const angle = angles.get(c.net)!;
            const r = R * radiusFracFor(c.minLatency);
            const id = `arc-${c.net.replace(/[^a-z0-9]/gi, "")}`;
            const sel = selectedProc != null && c.procs.includes(selectedProc);
            const dim = selectedProc != null && !sel;
            const end = polar(angle, r);
            const lbl = polar(angle, r + 9);
            const right = Math.cos((angle * Math.PI) / 180) >= 0;
            const vertical = Math.abs(Math.cos((angle * Math.PI) / 180)) < 0.3;
            const width = 0.8 + (2.2 * c.sockets) / maxSockets;
            const org = clusterOrg(c, conns, hostnames);
            const orgShort = org?.split(" (")[0];
            return (
              <g key={c.net} className={dim ? "cl dim" : "cl"} {...tip.for(clusterTip(c, org))}>
                <path id={id} className={`arc${sel ? " sel" : ""}`} pathLength={1} d={arcPath(angle, r)} fill="none" style={{ strokeWidth: width }} />
                <circle r={sel ? 2.4 : 1.8} fill={sel ? "var(--ink)" : "var(--ink-4)"} opacity={sel ? 1 : 0.55}>
                  <animateMotion dur={`${2.2 - Math.min(1, c.sockets / maxSockets)}s`} repeatCount="indefinite">
                    <mpath xlinkHref={`#${id}`} href={`#${id}`} />
                  </animateMotion>
                </circle>
                <circle cx={end.x} cy={end.y} r={2 + Math.min(3, c.hosts / 2)} fill="var(--ok)" />
                <text
                  x={lbl.x}
                  y={lbl.y + (vertical ? (Math.sin((angle * Math.PI) / 180) > 0 ? 8 : -3) : 3)}
                  textAnchor={vertical ? "middle" : right ? "start" : "end"}
                  className={`map-label${sel ? " w" : ""}`}
                >
                  {short(c.dominantProc)}
                  {orgShort ? <tspan className="map-org"> · {orgShort}</tspan> : null}
                  {c.hosts > 1 ? ` ×${c.hosts}` : ""}
                </text>
              </g>
            );
          })}

          <g {...tip.for(`Your PC. Every line starts here. ${doors.length} open port${doors.length === 1 ? "" : "s"} on it wait for someone to connect in; the list on the right explains each one.`)}>
            <circle cx={CX} cy={CY} r={NODE} fill="var(--panel)" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
            <text x={CX} y={CY - 6} textAnchor="middle" className="map-label w" style={{ fontSize: 8.5 }}>THIS PC</text>
            <text x={CX} y={CY + 5} textAnchor="middle" className="map-label" style={{ fontSize: 7 }}>{localIp}</text>
            <text x={CX} y={CY + 16} textAnchor="middle" className="map-label" style={{ fontSize: 7 }}>{doors.length} open ports</text>
          </g>

          {risky.map((d, i) => (
            <g key={d.port} {...tip.for(`Port ${d.port} is open: ${d.info?.plain ?? ""}.`)}>
              <text x={CX} y={CY + NODE + 12 + i * 10} textAnchor="middle" className="map-label" style={{ fill: "var(--warn)" }}>
                port {d.port} open to the network
              </text>
            </g>
          ))}

          {clusters.length === 0 && (
            <text x={CX} y={CY - NODE - 16} textAnchor="middle" className="map-label">No outside connections right now</text>
          )}
          {others > 0 && (
            <text x={W - 8} y={H - 8} textAnchor="end" className="map-label dim">
              +{others} smaller network{others > 1 ? "s" : ""} not drawn
            </text>
          )}
        </svg>
      </div>
      <div className="legend">
        <span {...tip.for("Each line is one network this PC talks to, with who owns it. Thicker means more connections. ×N is how many computers in that network.")}><i />network (thicker = busier)</span>
        <span {...tip.for("How fast the other computer answers. Closer to the middle means a faster reply.")}><i className="ring" />distance = latency</span>
        <span {...tip.for("Click a program in the list to light up only its connections.")}>click a row to focus</span>
      </div>
    </div>
  );
}

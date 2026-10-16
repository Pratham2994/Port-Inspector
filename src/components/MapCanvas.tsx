import type { ConnGroup } from "../data/types";
import { placeEndpoint, radiusFracFor, stableHash } from "../data/maplayout";
import { useTip } from "./Tip";

interface Props {
  groups: ConnGroup[];
  selectedKey: string | null;
  latencies: Record<string, number | null>;
}

const CX = 150, CY = 215, R = 140, NODE = 32, TICK_IN = 46, TICK_OUT = 54;
const RING_12 = R * radiusFracFor(12);
const RING_80 = R * radiusFracFor(80);

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function arcPath(angleDeg: number, frac: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const sx = CX + NODE * Math.cos(a), sy = CY + NODE * Math.sin(a);
  const ex = CX + R * frac * Math.cos(a), ey = CY + R * frac * Math.sin(a);
  const mx = (sx + ex) / 2 - Math.sin(a) * R * 0.14;
  const my = (sy + ey) / 2 + Math.cos(a) * R * 0.14;
  return `M ${sx.toFixed(1)},${sy.toFixed(1)} Q ${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

const short = (p: string) => p.replace(/\.exe$/i, "");

function localIpOf(groups: ConnGroup[]): string {
  const counts = new Map<string, number>();
  for (const g of groups) {
    for (const c of g.conns) {
      const a = c.localAddr;
      if (a === "0.0.0.0" || a === "::" || a === "::1" || a.startsWith("127.")) continue;
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
  }
  let best = "";
  let bestN = 0;
  for (const [a, n] of counts) {
    if (n > bestN) {
      best = a;
      bestN = n;
    }
  }
  return best || "this PC";
}

export default function MapCanvas({ groups, selectedKey, latencies }: Props) {
  const tip = useTip();
  const remotes = groups.filter((g) => g.remoteAddr != null && g.state === "established");
  const listeners = groups.filter((g) => g.listenPort != null);
  const localIp = localIpOf(groups);

  return (
    <div className="map">
      <div className="map-canvas">
        <svg viewBox="0 0 300 430" preserveAspectRatio="xMidYMid meet">
          {[RING_12, RING_80].map((r) => (
            <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          <text x={CX} y={CY + RING_12 + 12} textAnchor="middle" className="map-label" style={{ fontSize: 7.5 }}>~12 ms</text>
          <text x={CX} y={CY + RING_80 + 12} textAnchor="middle" className="map-label" style={{ fontSize: 7.5 }}>~80 ms</text>

          {remotes.map((g) => {
            const latency = latencies[g.remoteAddr!] ?? null;
            const { angle, radiusFrac } = placeEndpoint(g.remoteAddr!, latency);
            const id = `arc-${g.key.replace(/[^a-z0-9]/gi, "")}`;
            const sel = g.key === selectedKey;
            const end = polar(angle, R * radiusFrac);
            const packets = Math.min(g.conns.length, sel ? 3 : 1);
            const latText = latency != null ? ` It answers in about ${latency} ms.` : latency === null && g.remoteAddr! in latencies ? " It did not answer when asked." : "";
            return (
              <g
                key={g.key}
                {...tip.for(
                  `${g.procName} talking to ${g.remoteAddr} on port ${g.remotePort}. Dots travelling the line are your data moving.${latText}`,
                )}
              >
                <path id={id} className={`arc${sel ? " sel" : ""}`} pathLength={1} d={arcPath(angle, radiusFrac)} fill="none" />
                {Array.from({ length: packets }, (_, p) => (
                  <circle key={p} r={sel ? 2.2 : 2} fill={sel ? "#ececea" : "#b5b2ad"} opacity={sel ? 1 : 0.6}>
                    <animateMotion dur={`${1.8 + p * 0.5}s`} begin={`${0.2 + p * 0.45}s`} repeatCount="indefinite">
                      <mpath xlinkHref={`#${id}`} href={`#${id}`} />
                    </animateMotion>
                  </circle>
                ))}
                <circle cx={end.x} cy={end.y} r="3" fill="var(--ok)" />
                <text x={end.x} y={end.y - 13} textAnchor="middle" className="map-label">
                  {short(g.procName)} :{g.remotePort}
                </text>
              </g>
            );
          })}

          {listeners.map((g) => {
            const angle = 10 + (stableHash(String(g.listenPort)) % 340);
            const a = (angle * Math.PI) / 180;
            const x1 = CX + TICK_IN * Math.cos(a), y1 = CY + TICK_IN * Math.sin(a);
            const x2 = CX + TICK_OUT * Math.cos(a), y2 = CY + TICK_OUT * Math.sin(a);
            const warn = g.listenPort === 2375;
            const text = warn
              ? `Docker's control door on this PC, open with no password. Anyone nearby could take over Docker through it. That is why this tick is red.`
              : `A door held open by ${g.procName}, waiting for someone to connect. Pointing outward from your PC.`;
            return (
              <g key={g.key} {...tip.for(text)}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={warn ? "var(--warn)" : "rgba(255,255,255,0.22)"} strokeWidth={warn ? 1.4 : 1.2} />
                {warn && (
                  <text x={x2 + (x2 > CX ? 5 : -5)} y={y2 + 3} textAnchor={x2 > CX ? "start" : "end"} className="map-label" style={{ fill: "var(--warn)" }}>
                    :{g.listenPort}
                  </text>
                )}
              </g>
            );
          })}

          <g {...tip.for("Your PC. Every line on this map starts at this machine.")}>
            <circle cx={CX} cy={CY} r={NODE} fill="var(--panel)" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
            <text x={CX} y={CY - 2} textAnchor="middle" className="map-label w" style={{ fontSize: 8.5 }}>THIS PC</text>
            <text x={CX} y={CY + 10} textAnchor="middle" className="map-label" style={{ fontSize: 7.5 }}>{localIp}</text>
          </g>
        </svg>
      </div>
      <div className="legend">
        <span {...tip.for("Each arc is one place this PC is talking to right now. Dots travelling along it are your data moving.")}><i />remote endpoint</span>
        <span {...tip.for("Short ticks close to the middle are doors on this PC that stay open, waiting for someone to connect.")}><i className="tick" />listening port</span>
        <span {...tip.for("How fast the other computer answers. Closer to the middle means a faster reply.")}><i className="ring" />distance = latency</span>
      </div>
    </div>
  );
}

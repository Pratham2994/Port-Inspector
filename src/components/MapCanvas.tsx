import type { ConnGroup } from "../data/types";

interface Props {
  groups: ConnGroup[];
  selectedKey: string | null;
}

const CX = 150, CY = 215, R = 140, NODE = 28;
const RADII = [85, 140];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

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

export default function MapCanvas({ groups, selectedKey }: Props) {
  const remotes = groups.filter((g) => g.remoteAddr != null && g.state === "established");
  const listeners = groups.filter((g) => g.listenPort != null);

  return (
    <div className="map">
      <div className="map-canvas">
        <svg viewBox="0 0 300 430" preserveAspectRatio="xMidYMid meet">
          {RADII.map((r) => (
            <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          <text x={CX} y={308} textAnchor="middle" className="map-label" style={{ fontSize: 7.5 }}>~12 ms</text>
          <text x={CX} y={362} textAnchor="middle" className="map-label" style={{ fontSize: 7.5 }}>~80 ms</text>

          {remotes.map((g, i) => {
            const h = hash(g.remoteAddr!);
            const angle = (h % 320) + 20;
            const frac = 0.55 + ((h >>> 8) % 40) / 100;
            const id = `arc-${g.key.replace(/[^a-z0-9]/gi, "")}`;
            const sel = g.key === selectedKey;
            const end = polar(angle, R * frac);
            const packets = Math.min(g.conns.length, sel ? 3 : 1);
            return (
              <g key={g.key}>
                <path id={id} className={`arc${sel ? " sel" : ""}`} pathLength={1} d={arcPath(angle, frac)} fill="none" />
                {Array.from({ length: packets }, (_, p) => (
                  <circle key={p} r={sel ? 2.2 : 2} fill={sel ? "#eceaea" : "#b5b2ad"} opacity={sel ? 1 : 0.6}>
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
            const h = hash(String(g.listenPort));
            const angle = (h % 340) + 10;
            const a = (angle * Math.PI) / 180;
            const x1 = CX + 38 * Math.cos(a), y1 = CY + 38 * Math.sin(a);
            const x2 = CX + 46 * Math.cos(a), y2 = CY + 46 * Math.sin(a);
            const warn = g.listenPort === 2375;
            return (
              <g key={g.key}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={warn ? "var(--warn)" : "rgba(255,255,255,0.22)"} strokeWidth={warn ? 1.4 : 1.2} />
                {warn && (
                  <text x={x2 + 6} y={y2 + 3} className="map-label" style={{ fill: "var(--warn)" }}>
                    :{g.listenPort}
                  </text>
                )}
              </g>
            );
          })}

          <circle cx={CX} cy={CY} r="26" fill="var(--panel)" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
          <text x={CX} y={CY - 2} textAnchor="middle" className="map-label w" style={{ fontSize: 8.5 }}>THIS PC</text>
          <text x={CX} y={CY + 10} textAnchor="middle" className="map-label">192.168.1.24</text>
        </svg>
      </div>
      <div className="legend">
        <span className="tip" data-tip="Each arc is one place this PC is talking to right now. Dots travelling along it are your data moving."><i />remote endpoint</span>
        <span className="tip" data-tip="Short ticks close to the middle are doors on this PC that stay open, waiting for someone to connect."><i className="tick" />listening port</span>
        <span className="tip" data-tip="How fast the other computer answers. Closer to the middle means a faster reply."><i className="ring" />distance = latency</span>
      </div>
    </div>
  );
}

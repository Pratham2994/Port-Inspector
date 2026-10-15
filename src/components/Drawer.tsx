import type { ConnGroup } from "../data/types";
import { fmtFirstSeen } from "../fmt";

interface Props {
  group: ConnGroup;
}

/** Placeholder copy until Task 5 lands the real explanations database. */
const KNOWN: Record<string, string> = {
  "443": "the encrypted web. Every secure website uses this door",
  "135": "a core Windows door. Every Windows PC has it open. Normal",
  "2375": "Docker's control door. It has no password, which is why it is red",
};

export default function Drawer({ group }: Props) {
  const port = group.remotePort ?? group.listenPort;
  const known = KNOWN[String(port)];
  const remote = group.remoteAddr ? `${group.remoteAddr}:${group.remotePort}` : null;
  return (
    <div className="drawer">
      <div className="drawer-grid">
        <div>
          <div className="dlabel">What this is</div>
          <div className="dtext">
            <b>{group.procName}</b>
            {remote ? <> to <span className="mono">{remote}</span></> : <> holding door <span className="mono">:{port}</span> open</>}
            {known ? `, ${known}.` : "."}{" "}
            <span className="mono" style={{ color: "var(--ink-5)" }}>first seen {fmtFirstSeen(group.firstSeen)}</span>
          </div>
        </div>
        <div>
          <div className="dlabel">Sockets</div>
          {group.conns.slice(0, 6).map((c) => (
            <div key={c.key} className="sock mono">
              <i /> {c.localPort} → :{group.remotePort ?? group.listenPort}
            </div>
          ))}
          {group.conns.length > 6 && <div className="sock mono" style={{ color: "var(--ink-5)" }}>+{group.conns.length - 6} more</div>}
        </div>
        <div>
          <div className="dlabel">Throughput</div>
          <svg className="chart" viewBox="0 0 150 46" preserveAspectRatio="none">
            <polygon className="ar" points="0,40 12,36 24,38 36,28 48,32 60,20 72,26 84,14 96,22 108,10 120,18 132,8 150,16 150,46 0,46" />
            <polyline className="ln" points="0,40 12,36 24,38 36,28 48,32 60,20 72,26 84,14 96,22 108,10 120,18 132,8 150,16" />
          </svg>
          <div className="chart-meta mono">
            <span>last 60 s</span>
            <span>demo data</span>
          </div>
        </div>
      </div>
    </div>
  );
}

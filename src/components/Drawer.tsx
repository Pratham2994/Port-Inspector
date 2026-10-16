import type { ConnGroup } from "../data/types";
import { explainSocket } from "../data/ports";
import { fmtFirstSeen } from "../fmt";

interface Props {
  group: ConnGroup;
}

export default function Drawer({ group }: Props) {
  const port = group.remotePort ?? group.listenPort ?? 0;
  const host = group.remoteAddr ?? group.conns[0]?.localAddr ?? null;
  return (
    <div className="drawer">
      <div className="drawer-grid">
        <div>
          <div className="dlabel">What this is</div>
          <div className="dtext">
            {explainSocket(host, port, group.state, group.procName)}{" "}
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
          <div className="dtext">Live byte counts per connection need an admin trace. Coming later.</div>
        </div>
      </div>
    </div>
  );
}

import type { Totals } from "../data/types";
import { fmtRate } from "../fmt";
import { useTip } from "./Tip";

export default function TopBar({ totals }: { totals: Totals }) {
  const tip = useTip();
  return (
    <header className="topbar">
      <span className="wordmark">PORT&nbsp;&nbsp;INSPECTOR</span>
      <span className="stats mono">
        <span {...tip.for("Lines where two computers are talking right now.")}>
          <b>{totals.conns}</b> connections
        </span>
        <span className="sep">·</span>
        <span {...tip.for("Doors on this PC that are open and waiting for someone to connect.")}>
          <b>{totals.listening}</b> listening
        </span>
        <span className="sep">·</span>
        <span {...tip.for("Data arriving on this PC, every second.")}>
          <b>{fmtRate(totals.down)}</b> ↓
        </span>
        <span className="sep">·</span>
        <span {...tip.for("Data leaving this PC, every second.")}>
          <b>{fmtRate(totals.up)}</b> ↑
        </span>
      </span>
    </header>
  );
}

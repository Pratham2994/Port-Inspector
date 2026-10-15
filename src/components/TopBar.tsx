import type { Totals } from "../data/types";

export default function TopBar({ totals }: { totals: Totals }) {
  return (
    <header className="topbar">
      <span className="wordmark">PORT&nbsp;&nbsp;INSPECTOR</span>
      <span className="stats mono">
        <span className="tip b" data-tip="Lines where two computers are talking right now.">
          <b>{totals.conns}</b> connections
        </span>
        <span className="sep">·</span>
        <span className="tip b" data-tip="Doors on this PC that are open and waiting for someone to connect.">
          <b>{totals.listening}</b> listening
        </span>
        <span className="sep">·</span>
        <span className="tip b" data-tip="Data arriving on this PC, every second.">
          <b>{totals.down.toFixed(1)}</b> MB/s ↓
        </span>
        <span className="sep">·</span>
        <span className="tip b" data-tip="Data leaving this PC, every second.">
          <b>{totals.up.toFixed(1)}</b> MB/s ↑
        </span>
      </span>
    </header>
  );
}

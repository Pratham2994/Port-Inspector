import { useTip } from "./Tip";

interface Props {
  seed: string;
  hot?: boolean;
}

/** Deterministic pseudo-activity for the mock phase. Replaced when real per-connection data lands. */
function pointsFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const pts: string[] = [];
  for (let i = 0; i <= 8; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const y = 4 + (h % 10);
    pts.push(`${i * 6},${y}`);
  }
  return pts.join(" ");
}

export default function Sparkline({ seed, hot }: Props) {
  const tip = useTip();
  return (
    <svg
      className={`spark${hot ? " hot" : ""}`}
      viewBox="0 0 48 17"
      preserveAspectRatio="none"
      {...tip.for("Traffic in the last minute. A higher line means more data moving.")}
    >
      <polyline points={pointsFor(seed)} />
    </svg>
  );
}

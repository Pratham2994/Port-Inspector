export function fmtAge(ms: number): string {
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `up ${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `up ${h}h ${String(rm).padStart(2, "0")}m`;
  const d = Math.floor(h / 24);
  return `up ${d}d ${h % 24}h`;
}

export function fmtFirstSeen(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

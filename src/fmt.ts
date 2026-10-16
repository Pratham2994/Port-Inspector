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

/** Rates read in KB/s until a full MB/s makes more sense. */
export function fmtRate(kbps: number): string {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} MB/s`;
  return `${Math.round(kbps)} KB/s`;
}

/** Long IPv6 addresses show their first groups and an ellipsis. */
export function shortAddr(addr: string): string {
  if (!addr.includes(":")) return addr;
  const parts = addr.split(":");
  if (parts.length <= 4 && !addr.includes("::")) return addr;
  if (addr === "::1") return addr;
  const head = parts.slice(0, 3).join(":").replace(/:+$/, "");
  return `${head}...`;
}

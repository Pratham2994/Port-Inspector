export type ProcVerdict = "windows" | "known" | "unknown";

export interface ProcInfo {
  what: string;
  verdict: ProcVerdict;
  /** Why there may be many of these, when that is normal. */
  why?: string;
  verdictText: string;
}

const VERDICT_TEXT: Record<ProcVerdict, string> = {
  windows: "Normal on every Windows PC. Do not worry.",
  known: "A program you installed.",
  unknown: "Not recognized. If you do not know this name, look at it in Task Manager.",
};

interface Entry {
  what: string;
  verdict: ProcVerdict;
  why?: string;
}

/** Exact names first: the things a real Windows machine always runs. */
const EXACT: Record<string, Entry> = {
  svchost: { what: "Windows' shared helper", verdict: "windows", why: "Dozens of doors inside it is normal: Windows runs many services through one program to save memory" },
  System: { what: "the Windows kernel itself", verdict: "windows", why: "A few sockets here are bookkeeping, not network activity" },
  lsass: { what: "Windows login security", verdict: "windows" },
  services: { what: "the Windows service manager", verdict: "windows" },
  wininit: { what: "the Windows boot helper", verdict: "windows" },
  winlogon: { what: "the Windows login screen", verdict: "windows" },
  csrss: { what: "a core Windows process", verdict: "windows" },
  smss: { what: "a core Windows process", verdict: "windows" },
  dwm: { what: "the Windows screen compositor", verdict: "windows" },
  explorer: { what: "your desktop and files", verdict: "windows" },
  MsMpEng: { what: "Windows Defender, the built-in antivirus", verdict: "windows" },
  spoolsv: { what: "the Windows print queue", verdict: "windows" },
  audiodg: { what: "Windows audio", verdict: "windows" },
  RuntimeBroker: { what: "the go-between for Windows apps", verdict: "windows" },
  SearchIndexer: { what: "Windows search, building its index", verdict: "windows" },
  SearchProtocolHost: { what: "Windows search, reading files", verdict: "windows" },
  fontdrvhost: { what: "Windows font rendering", verdict: "windows" },
  sihost: { what: "a core Windows shell helper", verdict: "windows" },
  taskhostw: { what: "a core Windows background host", verdict: "windows" },
  ctfmon: { what: "Windows text and touch input", verdict: "windows" },
  conhost: { what: "the console window behind terminals", verdict: "windows" },
  wemeetapp: { what: "a meeting app", verdict: "known" },
};

/** Families: similar programs share one description, so they cluster cleanly. */
const FAMILY: Array<{ match: RegExp; entry: Entry }> = [
  { match: /^(chrome|msedge|brave|opera|vivaldi|firefox|chromium)/i, entry: { what: "a web browser", verdict: "known", why: "Many sockets at once is ordinary browsing: every tab window, sync and media stream gets its own line" } },
  { match: /^(Code|Cursor|node|electron|esbuild|tsc|vite|webpack|python|java|go|rust-analyzer|cargo)/i, entry: { what: "a developer tool", verdict: "known", why: "Developer tools talk constantly: language servers, package downloads and hot reload all open lines" } },
  { match: /^(steam|steamwebhelper|EpicGames|Ubisoft|Battle|Origin|GalaxyClient)/i, entry: { what: "a game launcher", verdict: "known", why: "Launchers keep a few lines open for the store, friends and updates" } },
  { match: /^(Discord|Telegram|Slack|Zoom|Teams|wemeet)/i, entry: { what: "a chat or meeting app", verdict: "known", why: "Chat apps hold a line open to hear new messages instantly" } },
  { match: /^(OneDrive|Dropbox|GoogleDrive|iCloud)/i, entry: { what: "a file sync app", verdict: "known", why: "It watches the folder and moves bytes whenever a file changes" } },
  { match: /^(spotify|YouTubeMusic|iTunes)/i, entry: { what: "a music app", verdict: "known", why: "Streaming holds a line open while something is playing or buffered" } },
  { match: /^(docker|com\.docker|wsl|vmmem|qemu|vmware)/i, entry: { what: "a container or virtual machine tool", verdict: "known", why: "Virtual networking adds its own sockets on top of Windows'" } },
];

export function procInfo(procName: string): ProcInfo {
  const base = procName.replace(/\.exe$/i, "");
  const exact = EXACT[base] ?? EXACT[procName];
  const entry = exact ?? FAMILY.find((f) => f.match.test(base))?.entry;

  const info: ProcInfo = entry
    ? { ...entry, verdictText: VERDICT_TEXT[entry.verdict] }
    : {
        what: "a program this app does not recognize",
        verdict: "unknown",
        verdictText: VERDICT_TEXT.unknown,
      };
  return info;
}

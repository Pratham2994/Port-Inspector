export interface PortEntry {
  name: string;
  plain: string;
}

const DB: Record<number, PortEntry> = {
  22: { name: "SSH", plain: "encrypted remote login, mostly used by developers" },
  53: { name: "DNS", plain: "where names like google.com get turned into numbers" },
  80: { name: "HTTP", plain: "the plain old web, with no encryption" },
  135: { name: "RPC", plain: "a core Windows door. Every Windows PC has it open. Normal" },
  139: { name: "SMB", plain: "Windows file sharing. Common on home PCs, but only your own network should be able to knock" },
  443: { name: "HTTPS", plain: "the encrypted web. Every secure website uses this door" },
  445: { name: "SMB", plain: "Windows file sharing. Common on home PCs, but only your own network should be able to knock" },
  5354: { name: "LLMNR", plain: "how Windows devices ask each other for names on the local network" },
  1234: { name: "LM Studio", plain: "LM Studio's local AI server. Apps on this PC send it prompts here" },
  3000: { name: "Dev server", plain: "a common port for a web app you are building (React, Next.js, Node)" },
  3306: { name: "MySQL", plain: "a MySQL database. Fine on this PC, risky if other computers can reach it" },
  5037: { name: "adb", plain: "Android Debug Bridge, so your PC can talk to phones and emulators. Only this PC can reach it" },
  5040: { name: "Windows", plain: "a Windows background service (the Connected Devices Platform). Normal" },
  5173: { name: "Vite", plain: "a web app you are building, served by Vite" },
  5432: { name: "PostgreSQL", plain: "a PostgreSQL database. Fine on this PC, risky if other computers can reach it" },
  6379: { name: "Redis", plain: "a Redis database. Fine on this PC, risky if other computers can reach it" },
  7680: { name: "Delivery Optimization", plain: "Windows Update sharing updates with other PCs on your network. Normal" },
  8080: { name: "HTTP alt", plain: "a common port for a local web server or proxy" },
  11434: { name: "Ollama", plain: "Ollama's local AI server. Apps on this PC send it prompts here" },
  2375: {
    name: "Docker",
    plain: "Docker's control door, with no password. Anyone on this network could take over Docker through it. It should not be open",
  },
  2376: {
    name: "Docker TLS",
    plain: "Docker's control door, with encryption and a certificate. Fine if you set it up yourself",
  },
  3389: { name: "RDP", plain: "Windows remote desktop. A door into your PC from outside" },
  5353: { name: "mDNS", plain: "how devices find each other on the local network, like phones finding printers" },
  9000: { name: "SonarQube", plain: "a developer tool. If you did not install it, look closer" },
  27017: { name: "MongoDB", plain: "a database. If you did not install MongoDB, something else is using its usual door, and an exposed one is a classic break-in point" },
  57621: { name: "Spotify", plain: "the door Spotify uses to find other Spotify players nearby" },
};

export function portInfo(port: number): PortEntry | null {
  return DB[port] ?? null;
}

/**
 * One plain sentence about a socket, for someone who knows nothing about
 * networking. Wildcard and loopback listeners say who can reach them.
 */
export function explainSocket(host: string | null, port: number, state: string, procName: string): string {
  const info = portInfo(port);
  const isWild = host == null || host === "0.0.0.0" || host === "::";
  const isLoop = host === "127.0.0.1" || host === "::1";

  let prefix = "";
  let target: string;
  if (state === "listening") {
    if (isWild) prefix = "Open to every network this PC joins. ";
    else if (isLoop) prefix = "Only this PC can knock. ";
    target = `${procName} on port ${port}`;
  } else if (state === "wait" || state === "close") {
    target = `${procName} just finished a connection to ${host} on port ${port}`;
  } else {
    target = `${procName} talking to ${host} on port ${port}`;
  }

  if (info) return `${prefix}${target}, ${info.plain}.`;
  if (state !== "listening" && port >= 49152 && port <= 65535) {
    return `${prefix}${target}, a temporary door programs pick at random.`;
  }
  return `${prefix}${target}.`;
}

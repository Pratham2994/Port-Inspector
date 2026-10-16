/**
 * Who owns a remote address, in words a person knows. Uses well-known
 * address ranges first, then the reverse-DNS name when Windows has one.
 */

interface Range {
  test: (ip: string) => boolean;
  org: string;
}

const v4 = (prefixes: string[]) => (ip: string) => prefixes.some((p) => ip.startsWith(p));
const v6 = (prefixes: string[]) => (ip: string) => prefixes.some((p) => ip.toLowerCase().startsWith(p));

const RANGES: Range[] = [
  { org: "Anthropic (Claude)", test: (ip) => v4(["160.79.104.", "160.79.105."])(ip) || v6(["2607:6bc0:"])(ip) },
  { org: "Google", test: (ip) => v4(["142.250.", "142.251.", "172.217.", "172.253.", "216.58.", "216.239.", "74.125.", "64.233.", "108.177.", "209.85."])(ip) || v6(["2404:6800:", "2607:f8b0:", "2a00:1450:", "2800:3f0:"])(ip) },
  { org: "Google Cloud", test: (ip) => v4(["34.", "35."])(ip) || v6(["2600:1900:", "2600:1901:"])(ip) },
  { org: "Cloudflare", test: (ip) => v4(["104.16.", "104.17.", "104.18.", "104.19.", "104.20.", "104.21.", "172.64.", "172.65.", "172.66.", "172.67.", "162.159.", "1.1.1."])(ip) || v6(["2606:4700:", "2803:f800:", "2a06:98c0:"])(ip) },
  { org: "Microsoft", test: (ip) => v4(["13.107.", "20.", "40.", "52.96.", "52.97.", "52.98.", "204.79.197."])(ip) || v6(["2603:", "2620:1ec:", "2a01:111:"])(ip) },
  { org: "GitHub", test: v4(["140.82.112.", "140.82.113.", "140.82.114.", "140.82.121.", "185.199.108.", "185.199.109.", "185.199.110.", "185.199.111."]) },
  { org: "Amazon AWS", test: (ip) => v4(["3.", "18.", "52.", "54.", "13.32.", "13.33.", "13.35."])(ip) || v6(["2600:1f", "2600:9000:"])(ip) },
  { org: "Meta (Facebook, WhatsApp)", test: (ip) => v4(["157.240.", "31.13."])(ip) || v6(["2a03:2880:"])(ip) },
  { org: "Akamai (a delivery network)", test: v4(["23.", "2.16.", "2.17.", "2.18.", "2.19.", "2.20.", "2.21.", "2.22.", "2.23."]) },
];

const SUFFIXES: Array<[RegExp, string]> = [
  [/\.anthropic\.com$/i, "Anthropic (Claude)"],
  [/\.1e100\.net$|\.google\.com$/i, "Google"],
  [/\.googleusercontent\.com$/i, "Google Cloud"],
  [/\.amazonaws\.com$|\.compute\.amazonaws\.com$/i, "Amazon AWS"],
  [/\.cloudfront\.net$/i, "Amazon CloudFront"],
  [/\.akamaitechnologies\.com$|\.akamaiedge\.net$/i, "Akamai (a delivery network)"],
  [/\.github\.com$/i, "GitHub"],
  [/\.(microsoft|msedge|azure|windows)\.(com|net)$/i, "Microsoft"],
  [/\.fbcdn\.net$|\.facebook\.com$/i, "Meta (Facebook, WhatsApp)"],
  [/\.spotify\.com$/i, "Spotify"],
  [/\.discord\.(com|gg)$/i, "Discord"],
  [/\.steampowered\.com$|\.valvesoftware\.com$/i, "Valve (Steam)"],
];

export function isPrivate(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return /^f[cd]|^fe80:/i.test(ip);
}

export function orgFor(ip: string, hostname: string | null | undefined): string | null {
  if (ip === "::1" || ip.startsWith("127.") || ip === "this PC") return "this PC";
  if (isPrivate(ip)) return "your home network";
  if (hostname) {
    const hit = SUFFIXES.find(([re]) => re.test(hostname));
    if (hit) return hit[1];
  }
  return RANGES.find((r) => r.test(ip))?.org ?? null;
}

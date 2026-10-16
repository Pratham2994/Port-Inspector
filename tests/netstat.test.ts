import { describe, expect, test } from "vitest";
import { parseNetstat } from "../src/data/netstat";

const HEAD = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
`;

describe("parseNetstat", () => {
  test("parses an established IPv4 TCP row", () => {
    const out = parseNetstat(HEAD + "  TCP    192.168.1.24:53128    142.250.185.78:443    ESTABLISHED    812\n");
    expect(out).toEqual([
      {
        proto: "tcp",
        localAddr: "192.168.1.24",
        localPort: 53128,
        remoteAddr: "142.250.185.78",
        remotePort: 443,
        state: "ESTABLISHED",
        pid: 812,
      },
    ]);
  });

  test("treats 0.0.0.0:0 remote on a listening TCP row as no remote", () => {
    const out = parseNetstat("  TCP    0.0.0.0:135    0.0.0.0:0    LISTENING    1028\n");
    expect(out).toEqual([
      {
        proto: "tcp",
        localAddr: "0.0.0.0",
        localPort: 135,
        remoteAddr: null,
        remotePort: null,
        state: "LISTENING",
        pid: 1028,
      },
    ]);
  });

  test("strips IPv6 brackets", () => {
    const out = parseNetstat("  TCP    [::1]:49670    [::]:135    ESTABLISHED    4\n");
    expect(out).toEqual([
      {
        proto: "tcp",
        localAddr: "::1",
        localPort: 49670,
        remoteAddr: "::",
        remotePort: 135,
        state: "ESTABLISHED",
        pid: 4,
      },
    ]);
  });

  test("parses UDP rows with *:* remotes as listening with no remote", () => {
    const out = parseNetstat("  UDP    0.0.0.0:5353    *:*    5212\n");
    expect(out).toEqual([
      {
        proto: "udp",
        localAddr: "0.0.0.0",
        localPort: 5353,
        remoteAddr: null,
        remotePort: null,
        state: "LISTENING",
        pid: 5212,
      },
    ]);
  });

  test("parses IPv6 UDP rows", () => {
    const out = parseNetstat("  UDP    [::1]:1900    *:*    5212\n");
    expect(out).toEqual([
      {
        proto: "udp",
        localAddr: "::1",
        localPort: 1900,
        remoteAddr: null,
        remotePort: null,
        state: "LISTENING",
        pid: 5212,
      },
    ]);
  });

  test("skips headers, column labels and blank lines", () => {
    const blob =
      HEAD +
      "\n  TCP    127.0.0.1:5354    0.0.0.0:0    LISTENING    1234\n\n  UDP    0.0.0.0:5353    *:*    5212\n\n";
    const out = parseNetstat(blob);
    expect(out).toHaveLength(2);
  });
});

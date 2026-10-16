import { describe, expect, test } from "vitest";
import { explainSocket, portInfo } from "../src/data/ports";

describe("portInfo", () => {
  test("knows 443", () => {
    expect(portInfo(443)?.plain).toBe("the encrypted web. Every secure website uses this door");
  });

  test("knows 2375 and warns", () => {
    expect(portInfo(2375)?.plain).toBe(
      "Docker's control door, with no password. Anyone on this network could take over Docker through it. It should not be open",
    );
  });

  test("does not know 65534", () => {
    expect(portInfo(65534)).toBeNull();
  });

  test("knows 27017 as MongoDB, not Steam", () => {
    expect(portInfo(27017)?.name).toBe("MongoDB");
  });

  test("knows 5354", () => {
    expect(portInfo(5354)).not.toBeNull();
  });
});

describe("explainSocket", () => {
  test("a wildcard listener explains its reach", () => {
    expect(explainSocket("0.0.0.0", 2375, "listening", "docker-proxy")).toBe(
      "Open to every network this PC joins. docker-proxy on port 2375, Docker's control door, with no password. Anyone on this network could take over Docker through it. It should not be open.",
    );
  });

  test("a loopback listener stays private", () => {
    expect(explainSocket("127.0.0.1", 135, "listening", "svchost.exe")).toBe(
      "Only this PC can knock. svchost.exe on port 135, a core Windows door. Every Windows PC has it open. Normal.",
    );
  });

  test("an established connection to a known port names the service", () => {
    expect(explainSocket("142.250.185.78", 443, "established", "chrome.exe")).toBe(
      "chrome.exe talking to 142.250.185.78 on port 443, the encrypted web. Every secure website uses this door.",
    );
  });

  test("an ephemeral port reads as temporary", () => {
    expect(explainSocket("1.2.3.4", 51820, "established", "app.exe")).toBe(
      "app.exe talking to 1.2.3.4 on port 51820, a temporary door programs pick at random.",
    );
  });

  test("an unknown named port still reads plainly", () => {
    expect(explainSocket("1.2.3.4", 12345, "established", "app.exe")).toBe(
      "app.exe talking to 1.2.3.4 on port 12345.",
    );
  });

  test("an established loopback connection is not described as a listener", () => {
    expect(explainSocket("127.0.0.1", 9229, "established", "Code.exe")).toBe(
      "Code.exe talking to 127.0.0.1 on port 9229.",
    );
  });

  test("a closing connection uses past tense", () => {
    expect(explainSocket("142.250.185.78", 443, "wait", "chrome.exe")).toBe(
      "chrome.exe just finished a connection to 142.250.185.78 on port 443, the encrypted web. Every secure website uses this door.",
    );
  });

  test("no explanation contains an em dash", () => {
    const samples = [
      explainSocket("0.0.0.0", 2375, "listening", "docker-proxy"),
      explainSocket("127.0.0.1", 135, "listening", "svchost.exe"),
      explainSocket("142.250.185.78", 443, "established", "chrome.exe"),
      explainSocket("1.2.3.4", 51820, "established", "app.exe"),
      explainSocket("1.2.3.4", 12345, "established", "app.exe"),
      explainSocket(null, 3389, "listening", "svchost.exe"),
    ];
    for (const s of samples) expect(s).not.toContain("\u2014");
  });
});

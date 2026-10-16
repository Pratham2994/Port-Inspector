import { describe, expect, test } from "vitest";
import { stateFromNetstat } from "../src/data/states";

describe("stateFromNetstat", () => {
  test.each([
    ["ESTABLISHED", "established"],
    ["LISTENING", "listening"],
    ["TIME_WAIT", "wait"],
    ["CLOSE_WAIT", "wait"],
    ["CLOSED", "close"],
    ["FIN_WAIT_1", "close"],
    ["FIN_WAIT_2", "close"],
    ["SYN_SENT", "close"],
    ["SYN_RECEIVED", "close"],
    ["LAST_ACK", "close"],
    ["WHO_KNOWS", "other"],
  ] as const)("maps %s to %s", (word, expected) => {
    expect(stateFromNetstat(word, "tcp")).toBe(expected);
  });

  test("UDP always reads as listening", () => {
    expect(stateFromNetstat("LISTENING", "udp")).toBe("listening");
    expect(stateFromNetstat("TIME_WAIT", "udp")).toBe("listening");
  });
});

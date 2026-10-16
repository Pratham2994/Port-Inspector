import type { ConnState } from "./types";

export function stateFromNetstat(word: string, proto: "tcp" | "udp"): ConnState {
  if (proto === "udp") return "listening";
  switch (word) {
    case "ESTABLISHED":
      return "established";
    case "LISTENING":
      return "listening";
    case "TIME_WAIT":
    case "CLOSE_WAIT":
      return "wait";
    case "CLOSED":
    case "FIN_WAIT_1":
    case "FIN_WAIT_2":
    case "SYN_SENT":
    case "SYN_RECEIVED":
    case "LAST_ACK":
      return "close";
    default:
      return "other";
  }
}

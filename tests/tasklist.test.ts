import { describe, expect, test } from "vitest";
import { parseTasklist } from "../src/data/tasklist";

const HEADER = `"Image Name","PID","Session Name","Session#","Mem Usage"\n`;

describe("parseTasklist", () => {
  test("maps pids to names and skips the header", () => {
    const out = parseTasklist(HEADER + `"chrome.exe","812","Console","1","123,456 K"\n`);
    expect(out.get(812)).toBe("chrome.exe");
    expect(out.size).toBe(1);
  });

  test("keeps process names with embedded commas", () => {
    const out = parseTasklist(`"my,app.exe","567","Console","1","12 K"\n`);
    expect(out.get(567)).toBe("my,app.exe");
  });

  test("ignores lines that are not csv rows", () => {
    const out = parseTasklist(HEADER + "\nINFO: No tasks are running.\n");
    expect(out.size).toBe(0);
  });
});

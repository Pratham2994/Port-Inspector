function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/** Parses `tasklist /fo csv` output into pid → image name. */
export function parseTasklist(out: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (fields.length < 2) continue;
    const pid = fields[1].trim();
    if (!/^\d+$/.test(pid) || !fields[0]) continue;
    map.set(Number(pid), fields[0]);
  }
  return map;
}

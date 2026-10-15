# Port Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows Electron app that lists every connection and listening port with owning process, plain-language tooltips and explanations, a latency map, live history and fluid animations, per the approved v5 mockup.

**Architecture:** Electron main process polls `netstat -n -ano`, `tasklist` and `Get-NetAdapterStatistics`, diffs snapshots (arrivals/departures/first-seen), pings remote endpoints for latency, and streams snapshots to the renderer over IPC. Renderer is React + TS rendering the approved design (list + map + drawer + tooltips) with pure CSS/SVG animation. All copy in plain words, no em dashes.

**Tech Stack:** electron-vite (Electron + Vite + React + TypeScript), no chart library, no UI kit. Vitest for pure-logic units (parsers, diff, ports db). Playwright Electron for the end smoke test.

**Spec:** `docs/specs/2026-10-15-port-inspector-design.md`

## Global Constraints

- Windows 10/11 only; must run unprivileged
- Design tokens from approved mockup v5: ground `#131211`, hairlines `rgba(255,255,255,0.07)`, status dots ok `#8ab887` / listening `#7a776f` / warn `#c98578`, data mono `"Cascadia Code", Consolas, monospace`, UI face `system-ui` stack
- Shared easing `cubic-bezier(.16,1,.3,1)` for all transitions; exponential ease-out entrances
- No AI-slop elements: no glows, gradients, glass blur, colored pills, border-left stripes, tracked-caps labels, em dashes in any UI copy
- Mono only for data (addresses, ports, rates, ages); hierarchy via weight/size
- Tooltips on every technical label, plain words, mockup-v5 tone ("Port 443 is the encrypted web. Every secure website uses this door.")
- contextIsolation on, nodeIntegration off, all native access via preload bridge
- Commits: one-line messages, user's identity only, no AI attribution; push to origin after every task

## Review Focus

1. **netstat format variants** — IPv6 bracket addresses, `[::]:135`, UDP `*:*` remotes, numeric vs resolved names (`-n` avoids the latter but tests must pin parsing of brackets and `*:*`). Covered by Task 2 fixtures.
2. **Churn** — hundreds of sockets with flapping ephemeral ports; keys must stay stable across polls and departure animation must not thrash. Covered by Task 3 diff tests (500-item case) and row animation cap in Task 3.
3. **ping failure/slow** — unreachable hosts, blocked ICMP, `time<1ms` edge; map must render with a default radius, latency "unknown". Covered by Task 4 parser tests + fallback.
4. **tasklist CSV quirks** — quoted process names containing commas. Covered by Task 2 CSV fixture.
5. **Empty/blocked PowerShell stats** — no adapters or unavailable CIM; header must fall back to quiet zeros without error spam. Covered by Task 6 fallback path test.

---

### Task 1: Scaffold with the approved design on mock data

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `electron/main.ts`, `electron/preload.ts`
- Create: `src/App.tsx`, `src/styles.css`
- Create: `src/components/TopBar.tsx`, `ConnList.tsx`, `ConnRow.tsx`, `Drawer.tsx`, `MapCanvas.tsx`, `Sparkline.tsx`, `Tooltip.css`
- Create: `src/data/types.ts`, `src/data/mock.ts`

**Interfaces:**
- Produces: `src/data/types.ts` — `type ConnState = "established" | "listening" | "wait" | "close" | "other"`; `interface Connection { key: string; proto: "tcp" | "udp"; localAddr: string; localPort: number; remoteAddr: string | null; remotePort: number | null; state: ConnState; pid: number; procName: string; firstSeen: number; }`; `interface Snapshot { t: number; conns: Connection[]; totals: { conns: number; listening: number; down: number; up: number } }`
- Produces: `electron/preload.ts` — `window.portInspector = { onSnapshot(cb: (s: Snapshot) => void): () => void }` (unsubscribe returned)
- Produces: design tokens in `src/styles.css` as CSS custom properties (`--ground`, `--ink`, `--line`, `--ok`, `--idle`, `--warn`, `--ease`, `--mono`)

- [ ] **Step 1: Scaffold electron-vite React-TS app** — `npm create @quick-start/electron` (or manual equivalent) in repo root; verify `npm run dev` opens a window
- [ ] **Step 2: Port the v5 mockup into `src/styles.css` + components** — copy `.pi5-*` styles from `.superpowers/brainstorm/1883-1792077815/content/visual-style-v5.html`, renamed to component-scoped classes, tokens extracted to custom properties; App renders TopBar + MapCanvas + ConnList from `src/data/mock.ts` (the mockup's rows: chrome, steam, docker-proxy, svchost, spotify, Code, onedrive)
- [ ] **Step 3: Wire preload IPC contract** — main sends `snapshot` channel every 1s (mock snapshot for now); preload exposes `onSnapshot`; App consumes it
- [ ] **Step 4: Verify** — `npm run dev`: window shows the v5 design live, rows stagger in, packets travel arcs, mock arrival row cycles
- [ ] **Step 5: Commit + push** — `git add -A && git commit -m "scaffold app shell with approved design on mock data" && git push -u origin master`

### Task 2: netstat and tasklist parsers

**Files:**
- Create: `src/data/netstat.ts`, `src/data/tasklist.ts`
- Test: `tests/netstat.test.ts`, `tests/tasklist.test.ts`

**Interfaces:**
- Produces: `parseNetstat(out: string): RawSocket[]` where `RawSocket = { proto: "tcp" | "udp"; localAddr: string; localPort: number; remoteAddr: string | null; remotePort: number | null; state: string; pid: number }` (state uppercased netstat word; UDP state `"LISTENING"`)
- Produces: `parseTasklist(out: string): Map<number, string>` (pid → process name)

- [ ] **Step 1: Failing tests with real-format fixtures** — fixtures pinned in the test file: TCP ESTABLISHED IPv4 row, TCP LISTENING IPv4 row, TCP `[::1]:49670` IPv6 row with `[::]:135`-style remote, UDP `0.0.0.0:5353  *:*  5212` row (remoteAddr null), UDP `[::1]:1900  *:*` row, a quoted tasklist CSV line `"chrome.exe","1234","Console",...` and a name with an embedded comma `"my,app.exe","567",...`; assertions on every field
- [ ] **Step 2: Run** — `npx vitest run` expected FAIL (modules missing)
- [ ] **Step 3: Implement** — netstat: skip header/footer lines, regex per data row handling `[addr]:port`, `*:*`, and junk lines; tasklist: proper CSV quote handling, no naive `split(",")`
- [ ] **Step 4: Run** — `npx vitest run` expected PASS
- [ ] **Step 5: Commit + push** — `git commit -m "add netstat and tasklist parsers"`

### Task 3: Snapshot diff, history and live wiring

**Files:**
- Create: `src/data/diff.ts`, `src/data/collector.ts` (main-process side), `src/data/states.ts`
- Modify: `electron/main.ts` (poll loop replaces mock), `src/components/ConnList.tsx` (arrival/departure animations, caps)

**Interfaces:**
- Consumes: `parseNetstat`, `parseTasklist`
- Produces: `diffSnapshots(prev: Map<string, RawSocket>, next: Map<string, RawSocket>, now: number): { arrivals: RawSocket[]; departures: string[]; stable: RawSocket[] }` — key = `proto|localAddr:localPort|remoteAddr:remotePort|state`
- Produces: `stateFromNetstat(word: string, proto: "tcp" | "udp"): ConnState` (ESTABLISHED→established, LISTENING→listening, TIME_WAIT/CLOSE_WAIT→wait, else other; udp remoteless→listening)
- Produces: history map `firstSeenByKey: Map<string, number>` owned by collector; `Connection.firstSeen` = original arrival time, `age` derived in render
- Produces: collector emits `Snapshot` on IPC `snapshot` channel every 1s (netstat poll every 1s, tasklist refresh lazily per unknown pid, cached)

- [ ] **Step 1: Failing tests** — arrival creates firstSeen; stable keeps firstSeen; departure removes; same socket changing state = departure+arrival with new key (asserted); 500-socket two-poll diff completes and counts match; state mapping table test
- [ ] **Step 2: Run** — expected FAIL
- [ ] **Step 3: Implement** diff + state mapping + collector (child process spawn with `windowsHide`, per-poll tasklist name cache)
- [ ] **Step 4: Row animations** — ConnList: arrivals animate in (height+fade, one-shot ring pulse on status dot); departures animate out then unmount (keep max ~30 simultaneous animation instances, beyond that rows swap instantly)
- [ ] **Step 5: Run tests + live verify** — `npx vitest run` PASS; `npm run dev`: real connections visible, open a browser tab and see it appear with the arrival animation, close it and see the departure animation
- [ ] **Step 6: Commit + push** — `git commit -m "live connections with arrival and departure history"`

### Task 4: Latency map

**Files:**
- Create: `src/data/latency.ts`, `src/data/maplayout.ts`
- Modify: `src/components/MapCanvas.tsx` (real layout), `electron/main.ts` (pinger), `src/data/collector.ts`

**Interfaces:**
- Produces: `parsePing(out: string): number | null` (ms; handles `time=12ms`, `time<1ms`→0, failure→null)
- Produces: `LatencyCache` — `get(host: string, ping: () => Promise<number | null>): Promise<number | null>`, max one refresh per host per 10s, in-flight dedup, null cached 30s
- Produces: `placeEndpoint(host: string, latency: number | null): { angle: number; radius: number }` — angle = stable hash of host mapped to 0–360, radius = latency null ? 0.55 : `clamp(0.18 + latency / 300, 0.18, 0.95)` (fraction of map radius)
- Consumes: `Connection` from Task 3; map shows remote-endpoint arcs (grouped per remote host), inner-ring ticks for listening ports, ring labels `~12 ms` / `~80 ms` at radius fractions matching placement

- [ ] **Step 1: Failing tests** — parsePing fixtures (12ms, <1ms, "Request timed out", "Destination host unreachable"); LatencyCache throttle + dedup with fake timers; placeEndpoint stability (same host → same angle) and radius clamps
- [ ] **Step 2: Run** — expected FAIL
- [ ] **Step 3: Implement** — ping via `ping -n 1 -w 1000 <ip>` child process, never pinged: null/`*` remotes, loopback, multicast/broadcast ranges
- [ ] **Step 4: MapCanvas live** — arcs per remote host (stroke by selected/traffic), CSS `offset-path: path(...)` + `offset-distance` keyframes for packets (count scaled by connection count per host, capped), ticks for listeners, legend unchanged from mockup
- [ ] **Step 5: Verify** — tests PASS; live: map shows real endpoints, radius settles after pings arrive, unreachable hosts sit at default radius
- [ ] **Step 6: Commit + push** — `git commit -m "latency map with real endpoints and packet motion"`

### Task 5: Explanations, tooltips, drawer

**Files:**
- Create: `src/data/ports.ts`, `src/components/Explain.tsx`
- Modify: `src/components/Drawer.tsx`, `src/App.tsx`, `src/components/ConnRow.tsx`, `src/components/TopBar.tsx`, `src/components/MapCanvas.tsx` (tooltip coverage), `src/styles.css`

**Interfaces:**
- Produces: `portInfo(port: number): { name: string; plain: string } | null` — db for at least: 443, 80, 135, 139, 445, 2375, 2376, 27017, 5353, 5354, 57621, 53, 22, 3389, 9000; plain words in mockup-v5 voice
- Produces: `explainSocket(c: Connection): string` — assembles: remote listener prefixes (`0.0.0.0` → "Open to every network this PC joins."; `127.0.0.1`/`::1` → "Only this PC can knock."); ephemeral range 49152–65535 → "a temporary door programs pick at random"; fallback pattern for unknown ports
- Consumes: `Connection`; Drawer shows: "What this is" (explainSocket + first seen time), "Sockets" (grouped rows under this process+host), activity note (honest copy until ETW exists: "Live byte counts per connection need an admin trace. Coming later.")

- [ ] **Step 1: Failing tests** — portInfo known ports return plain strings (assert exact copy for 443 and 2375); explainSocket: 0.0.0.0 listener prefix, loopback prefix, ephemeral fallback, unknown high port phrasing
- [ ] **Step 2: Run** — expected FAIL
- [ ] **Step 3: Implement** db + heuristics
- [ ] **Step 4: Tooltip coverage pass** — same CSS tooltip pattern as mockup (`.tip` with `data-tip`, fade+slide on `--ease`), attached to: top-bar stats, column headers, every state word, every port+service label, socket counts, sparklines, map legend, drawer labels; mobile of the mockup's pinned example kept as first-open hint on the docker row only if `:2375` is present
- [ ] **Step 5: Verify** — tests PASS; live: hover coverage on every technical label, no em dash anywhere in rendered copy
- [ ] **Step 6: Commit + push** — `git commit -m "plain language tooltips and drawer explanations"`

### Task 6: Live throughput header, smoke test, polish

**Files:**
- Create: `src/data/adapters.ts`, `e2e/smoke.spec.ts`, `playwright.config.ts`
- Modify: `electron/main.ts` (stats poll), `src/components/TopBar.tsx`

**Interfaces:**
- Produces: `parseAdapterStats(json: string): { rx: number; tx: number } | null` (cumulative bytes across adapters)
- Produces: `ratesFromDeltas(prev: { rx: number; tx: number } | null, next: { rx: number; tx: number }, dt: number): { down: number; up: number }` (MB/s, rounded 1 decimal)
- Consumes: `Snapshot.totals` extended with live down/up

- [ ] **Step 1: Failing tests** — adapters fixture (two adapters, cumulative numbers), empty `{}` fixture → null, deltas math incl. first-poll null
- [ ] **Step 2: Run** — expected FAIL
- [ ] **Step 3: Implement** — poll `Get-NetAdapterStatistics | ConvertTo-Json` every 1s in main, compute rates, fold into snapshot totals; TopBar consumes live values
- [ ] **Step 4: Playwright smoke** — `_electron.launch` the built app, assert window title, wait for list rows > 0, assert top-bar stats text renders, screenshot for the record; run against mock fallback if netstat is empty in CI-like env (it will not be, this is the user's machine)
- [ ] **Step 5: Polish pass** — side-by-side with mockup v5 in the browser companion screenshots; fix spacing/type drift, animation timing drift, tooltip widths; verify no AI-slop regressions (no gradients, no border stripes, no em dashes)
- [ ] **Step 6: Commit + push** — `git commit -m "live throughput header, smoke test, polish pass"`

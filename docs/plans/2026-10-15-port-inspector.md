# Port Inspector Implementation Plan (final, handoff edition)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Progress ledger: `.superpowers/sdd/2026-10-15-port-inspector/progress.md` — read it first; Task 1 is already complete, resume at Task 2.

**Goal:** A Windows Electron app that lists every connection and listening port with owning process, plain-language tooltips and explanations, a latency map, live history and fluid animations, per the approved v5 mockup.

**Architecture:** Electron main process polls `netstat -n -ano`, `tasklist` and `Get-NetAdapterStatistics`, diffs snapshots (arrivals/departures/first-seen), pings remote endpoints for latency, and streams snapshots to the renderer over IPC. Renderer is React + TS rendering the approved design (list + map + drawer + tooltips) with CSS/SVG animation. All copy in plain words, no em dashes.

**Tech Stack:** electron-vite (Electron 33 + Vite 5 + React 18 + TypeScript), no chart library, no UI kit. Vitest for pure-logic units. Playwright `@playwright/test` with `_electron.launch` for the end smoke test (no browser download needed).

**Spec:** `docs/specs/2026-10-15-port-inspector-design.md`

## Status (read this first)

- Task 1 COMPLETE at commits `ddf47c3..e0af221` plus UI-fix commit `597b340`. The app runs: `npm run dev` opens the window with the approved design on mock data, verified.
- What exists on disk already (do not recreate):
  - `src/data/types.ts` — `ConnState`, `Connection`, `Totals`, `Snapshot`, `RawSocket`, `ConnGroup` (list rows are groups per process+endpoint, not per socket)
  - `src/data/mock.ts` — `mockConnections`, `demoArrival`, `mockSnapshot(t, extra?)`
  - `src/data/grouping.ts` — `groupByEndpoint(conns: Connection[]): ConnGroup[]`
  - `src/env.ts` — `hasBridge()`; renderer falls back to a mock timer when `window.portInspector` is absent
  - `src/fmt.ts` — `fmtAge(ms)`, `fmtFirstSeen(t)`
  - `src/components/` — `TopBar`, `MapCanvas`, `ConnList`, `ConnRow`, `Drawer`, `Sparkline` (placeholder), `Tip.tsx` (`TipProvider` + `useTip()` + `tip.for(text)` hover/focus tooltip props; one fixed-position layer, flips below near the top, clamps to window edges — use it for every tooltip)
  - `electron/main.ts` — BrowserWindow (bg `#131211`, contextIsolation on), currently sends a mock `snapshot` every 1s on IPC channel `snapshot`
  - `electron/preload.ts` — `window.portInspector.onSnapshot(cb)` returns unsubscribe
  - `src/styles.css` — design tokens (`--ground #131211`, `--ink`, `--line`, `--ok`, `--idle`, `--warn`, `--ease cubic-bezier(.16,1,.3,1)`, `--mono`, `--ui`) + component styles. Map geometry constants live in `MapCanvas.tsx`: `CX=150 CY=215 R=140 NODE=32 TICK_IN=46 TICK_OUT=54 RADII=[85,140]`; packets are SMIL `<animateMotion>` on `<mpath>` (keep SMIL; do not switch to CSS offset-path)
  - Test runner: `npx vitest run` (no vitest config file; pure-logic tests only, node environment default). Typecheck: `npm run typecheck`. Build: `npm run build`.
- Mock copy in `Drawer.tsx` (`KNOWN` map) is placeholder; Task 5 replaces it with `src/data/ports.ts`.
- Per-connection sparklines/charts are placeholders (no real per-connection bytes without ETW). Task 3 removes the list sparkline; Traffic column shows "live"/"idle" only until ETW lands (out of scope).

## Global Constraints

- Windows 10/11 only; must run unprivileged
- Design tokens from approved mockup v5 (already in `src/styles.css`; extend, do not replace): ground `#131211`, status dots ok `#8ab887` / listening `#7a776f` / warn `#c98578`, hairlines `rgba(255,255,255,0.07)`, easing `cubic-bezier(.16,1,.3,1)`
- No AI-slop elements: no glows, gradients, glass blur, colored pills, border-left stripes, tracked-caps labels, em dashes in any UI copy
- Mono (`--mono`) only for data (addresses, ports, rates, ages); hierarchy via weight/size
- All tooltips via `useTip()` / `tip.for(text)`; plain words, mockup-v5 tone ("Port 443 is the encrypted web. Every secure website uses this door.")
- contextIsolation on, nodeIntegration off, all native access via preload bridge
- Commits: one-line messages, user's identity only, no AI attribution, no co-author trailers; push to origin after every task
- TDD for pure logic (`src/data/*.ts`): failing vitest test first, watch it fail, implement, watch it pass. UI wiring verified by running the app. No jsdom/RTL component tests.

## Review Focus

1. **netstat format variants** — IPv6 bracket addresses (`[::1]:49670`, remote `[::]:135`), UDP `*:*` remotes. Covered by Task 2 fixtures.
2. **Churn** — hundreds of sockets, flapping ephemeral ports; keys must stay stable, departure animation must not thrash. Covered by Task 3 diff tests + animation cap.
3. **ping failure/slow** — `time<1ms`, "Request timed out", "Destination host unreachable"; map must render with default radius. Covered by Task 4 tests + fallback.
4. **tasklist CSV quirks** — quoted process names containing commas. Covered by Task 2 fixture.
5. **Empty/blocked PowerShell stats** — no adapters or CIM unavailable; header falls back to 0.0 without error spam. Covered by Task 6 fallback test.

---

### Task 2: netstat and tasklist parsers

**Files:**
- Create: `src/data/netstat.ts`, `src/data/tasklist.ts`
- Test: `tests/netstat.test.ts`, `tests/tasklist.test.ts`

**Interfaces:**
- Produces: `parseNetstat(out: string): RawSocket[]` — `RawSocket` from `src/data/types.ts`; UDP rows get state `"LISTENING"`; header/footer/junk lines skipped
- Produces: `parseTasklist(out: string): Map<number, string>` (pid → process name)

- [ ] **Step 1: Write failing tests** in `tests/netstat.test.ts` with these exact fixtures (real `netstat -n -ano` format):
  - `  TCP    192.168.1.24:53128    142.250.185.78:443    ESTABLISHED    812` → `{ proto: "tcp", localAddr: "192.168.1.24", localPort: 53128, remoteAddr: "142.250.185.78", remotePort: 443, state: "ESTABLISHED", pid: 812 }`
  - `  TCP    0.0.0.0:135    0.0.0.0:0    LISTENING    1028` → listening row; netstat writes `0.0.0.0:0` as a placeholder for "no remote": map it to `remoteAddr: null, remotePort: null` (same as UDP `*:*`, and what the grouping layer expects)
  - `  TCP    [::1]:49670    [::]:135    ESTABLISHED    4` → IPv6 brackets stripped in fields: localAddr `"::1"`, remoteAddr `"::"`
  - `  UDP    0.0.0.0:5353    *:*    5212` → `{ proto: "udp", remoteAddr: null, remotePort: null, state: "LISTENING", pid: 5212 }`
  - `  UDP    [::1]:1900    *:*    5212` → same shape, localAddr `"::1"`
  - A multi-line blob mixing a header (`Active Connections`), column header line, and blank lines → only data rows returned
  - `tests/tasklist.test.ts`: CSV body `"chrome.exe","812","Console","1","123,456 K"` → Map {812 → "chrome.exe"}; quoted name with comma `"my,app.exe","567","Console","1","12 K"` → Map {567 → "my,app.exe"}; header line `"Image Name","PID","Session Name","Session#","Mem Usage"` skipped
- [ ] **Step 2: Run** `npx vitest run` — expected FAIL (modules missing)
- [ ] **Step 3: Implement** — netstat: line regex handling optional brackets, `*:*`, and `0.0.0.0:0`; skip lines that do not match. tasklist: proper CSV parser (quote-aware; no naive `split(",")`)
- [ ] **Step 4: Run** `npx vitest run` — expected PASS (whole suite)
- [ ] **Step 5: Commit + push** — `git commit -m "add netstat and tasklist parsers"`

### Task 3: Snapshot diff, history, live wiring, arrival/departure motion

**Files:**
- Create: `src/data/diff.ts`, `src/data/states.ts`, `src/data/collector.ts`
- Modify: `electron/main.ts` (replace mock emitter with collector), `src/App.tsx` (remove demo arrival loop + `demoArrival`; keep the no-bridge mock fallback), `src/components/ConnList.tsx` (entering/leaving animations), `src/components/ConnRow.tsx` (remove Sparkline import/usage), `src/components/MapCanvas.tsx` (real local IP), `src/styles.css` (`.item.leaving` animation + `.sdot` one-shot pulse)

**Interfaces:**
- Consumes: `parseNetstat`, `parseTasklist`
- Produces: `diffSnapshots(prevKeys: Set<string>, nextKeys: Set<string>): { arrivals: string[]; departures: string[] }` — key = `${proto}|${localAddr}:${localPort}|${remoteAddr}:${remotePort}|${state}`
- Produces: `stateFromNetstat(word: string, proto: "tcp" | "udp"): ConnState` — `ESTABLISHED`→`established`, `LISTENING`→`listening`, `TIME_WAIT`/`CLOSE_WAIT`→`wait`, `CLOSED`/`FIN_WAIT*`/`SYN_*`→`close`, else `other`; UDP rows → `listening`
- Produces: `startCollector(emit: (s: Snapshot) => void, opts?): () => void` — main-process side: 1s poll of `netstat -n -ano` via `child_process.execFile("netstat", ["-n", "-ano"], { windowsHide: true })`; maintains `Map<key, firstSeen>`; resolves pid → procName via `tasklist /fo csv` (full refresh every 30s, plus immediate refresh when unknown pids appear; cache between); builds `Connection[]` (procName fallback `"pid " + pid` if tasklist misses); computes totals.conns (non-listening count) and totals.listening; totals.down/up = 0 until Task 6. Returns stop function.
- Produces: rows show `age` via existing `fmtAge(now - group.firstSeen)` — group firstSeen = earliest conn firstSeen (groupByEndpoint already does this)

- [ ] **Step 1: Failing tests** in `tests/diff.test.ts`: empty→3 keys gives 3 arrivals 0 departures; 3 keys→same 3 keys gives 0/0; one removed gives 1 departure; a key present but with changed state string counts as a different key (arrival + departure); 500-key two-poll diff completes with exact counts. `tests/states.test.ts`: the mapping table above, both protocols.
- [ ] **Step 2: Run** `npx vitest run` — expected FAIL
- [ ] **Step 3: Implement** `diff.ts`, `states.ts`, `collector.ts`
- [ ] **Step 4: Wire live data** — `electron/main.ts`: `const stop = startCollector((s) => win?.webContents.send("snapshot", s))`, stop on `before-quit`. `App.tsx`: delete the demo arrival `useEffect` and the `demoOn` logic (keep bridge fallback). `ConnRow.tsx`: remove Sparkline (Traffic column = "live"/"idle" text only). `MapCanvas.tsx`: replace hardcoded `"192.168.1.24"` with the most common non-loopback `localAddr` among established conns (fallback `"this PC"`); remove it from the group when none.
- [ ] **Step 5: Arrival/departure motion** — `ConnList.tsx`: track previous group keys in a ref; groups not in the previous set get class `entering` (existing `row-in` animation + one-shot ring pulse on the status dot, CSS `.entering .sdot` using `box-shadow` keyframes like mockup v5); groups in the previous set but not the current set get class `leaving` and are rendered for 400ms (CSS: fade + collapse height) then dropped from state. Cap: if more than 30 groups change in one poll, skip the animation classes (plain swap). Add the CSS to `styles.css`.
- [ ] **Step 6: Run** `npx vitest run` PASS; live verify `npm run dev`: real connections listed with process names, open a new browser tab → its connection appears with the arrival animation, close → departure animation; ages tick up
- [ ] **Step 7: Commit + push** — `git commit -m "live connections with arrival and departure history"`

### Task 4: Latency map

**Files:**
- Create: `src/data/latency.ts`, `src/data/maplayout.ts`
- Modify: `src/data/collector.ts` (pinger), `src/components/MapCanvas.tsx` (consume placement + latency)

**Interfaces:**
- Produces: `parsePing(out: string): number | null` — `Reply from 1.2.3.4: bytes=32 time=12ms TTL=118` → 12; `time<1ms` → 0; `Request timed out.` / `Destination host unreachable.` / empty → null
- Produces: `class LatencyCache { constructor(pingFn: (ip: string) => Promise<number | null>); get(ip: string): Promise<number | null> }` — max one refresh per ip per 10s, in-flight dedup, null result cached 30s. Test with a fake clock/fake pingFn counting calls.
- Produces: `placeEndpoint(host: string, latency: number | null): { angle: number; radiusFrac: number }` — angle = `20 + (stableHash(host) % 320)` degrees (same hash as current MapCanvas: `h = h*31 + charCode`, unsigned); `radiusFrac = latency == null ? 0.55 : Math.min(0.95, 0.3 + 0.65 * Math.log(Math.max(1, latency)) / Math.log(400))`
- Produces: ring latencies: draw the two rings at the radii where 12 ms and 80 ms land (`R * radiusFrac(12) ≈ 0.3+0.65*ln12/ln400 ≈ 0.57` → r≈80; `radiusFrac(80) ≈ 0.755` → r≈106), labels `~12 ms` and `~80 ms`. Replace `RADII = [85, 140]` with these computed values.
- Consumes: `ConnGroup`; map keeps SMIL packets, ticks, legend, tooltips exactly as now
- Collector: never ping `null`/`*` remotes, loopback (`127.*`, `::1`), link-local (`169.254.*`, `fe80:*`), multicast (`224-239.*`, `ff*`), broadcast (`255.255.255.255`), `0.0.0.0`, `::`. Ping via `ping -n 1 -w 1000 <ip>`; one in-flight ping set; results sent inside the snapshot as `latencies: Record<string, number | null>` (add optional field to `Snapshot`).

- [ ] **Step 1: Failing tests**: `tests/latency.test.ts` (parsePing fixtures above; LatencyCache throttle/dedup/null-cache with fake timers; placement assertions: `placeEndpoint("a", null).radiusFrac === 0.55`, `placeEndpoint("a", 12).radiusFrac ≈ 0.57` (±0.01), `placeEndpoint("a", 400).radiusFrac === 0.95`, same host → same angle twice)
- [ ] **Step 2: Run** `npx vitest run` — expected FAIL
- [ ] **Step 3: Implement** `latency.ts` + `maplayout.ts`
- [ ] **Step 4: Wire** — collector pings (rules above), snapshot carries `latencies`; `MapCanvas.tsx` consumes `placeEndpoint` for radius (angle stays deterministic), ring radii per the formula, endpoint tooltip gains latency when known (`"... It answers in about 12 ms."`), packets per group as now
- [ ] **Step 5: Run** `npx vitest run` PASS; live verify: map settles after pings, unreachable hosts sit at 0.55, no ping storm (check console)
- [ ] **Step 6: Commit + push** — `git commit -m "latency map with real endpoints"`

### Task 5: Explanations database, drawer copy, tooltip sweep

**Files:**
- Create: `src/data/ports.ts`
- Modify: `src/components/Drawer.tsx` (use ports.ts, delete `KNOWN`), `src/components/MapCanvas.tsx` (tick tooltips from ports.ts), `src/components/ConnRow.tsx` (port tooltip from portInfo when known)

**Interfaces:**
- Produces: `portInfo(port: number): { name: string; plain: string } | null` — database with at least: 443 ("HTTPS", "the encrypted web. Every secure website uses this door"), 80 ("HTTP", "the plain old web, with no encryption"), 135 ("RPC", "a core Windows door. Every Windows PC has it open. Normal"), 139/445 ("SMB", "Windows file sharing. Open on home PCs is common, but only your own network should be able to knock"), 2375 ("Docker", "Docker's control door, with no password. Anyone on this network could take over Docker through it. It should not be open"), 2376 ("Docker TLS", "Docker's control door, with encryption and a certificate. Fine if you set it up yourself"), 27017 ("Steam", "the door Steam uses to talk to its servers"), 5353 ("mDNS", "how devices find each other on the local network, like phones finding printers"), 57621 ("Spotify", "the door Spotify uses to find other Spotify players nearby"), 53 ("DNS", "where names like google.com get turned into numbers"), 22 ("SSH", "encrypted remote login, mostly used by developers"), 3389 ("RDP", "Windows remote desktop. A door into your PC from outside"), 9000 ("SonarQube", "a developer tool. If you did not install it, look closer")
- Produces: `explainSocket(host: string | null, port: number, state: string, procName: string): string` — assembles, plain words: remote listener prefixes: host `"0.0.0.0"` → "Open to every network this PC joins. "; `"127.0.0.1"`/`"::1"` → "Only this PC can knock. "; established remote + known port → `"{proc} talking to {host} on port {port}, {plain}."`; unknown port in 49152–65535 → "a temporary door programs pick at random"; other unknown ports → `"{proc} on port {port}."` No em dashes anywhere.
- Drawer: "What this is" uses `explainSocket`; "Sockets" stays as is; replace the chart block with a plain note (it has no honest data yet): label "Throughput", text "Live byte counts per connection need an admin trace. Coming later." (keep the drawer-grid layout, third column just holds the note)

- [ ] **Step 1: Failing tests** `tests/ports.test.ts`: `portInfo(443).plain` exact copy; `portInfo(2375).plain` exact copy; `portInfo(65534)` null; explainSocket: 0.0.0.0 listener prefix, loopback prefix, established 443 sentence, ephemeral 49152+ sentence, unknown 1234 sentence; assert no output contains an em dash
- [ ] **Step 2: Run** `npx vitest run` — expected FAIL
- [ ] **Step 3: Implement** `ports.ts`; rewire Drawer/MapCanvas/ConnRow
- [ ] **Step 4: Tooltip sweep** — verify every technical label has a tooltip: top-bar stats, column headers, state words, port labels, socket counts, map ticks/endpoints/legend/center. All via `tip.for(...)`. Live-verify by hovering each in `npm run dev`
- [ ] **Step 5: Run** `npx vitest run` PASS; live verify; no em dash in rendered copy
- [ ] **Step 6: Commit + push** — `git commit -m "plain language explanations for every port"`

### Task 6: Live throughput header, smoke test, polish

**Files:**
- Create: `src/data/adapters.ts`, `e2e/smoke.spec.ts`, `playwright.config.ts`
- Modify: `src/data/collector.ts` (adapter stats poll), `package.json` (devDep `@playwright/test`, script `"e2e": "playwright test"`)

**Interfaces:**
- Produces: `parseAdapterStats(json: string): { rx: number; tx: number } | null` — input is `Get-NetAdapterStatistics | ConvertTo-Json` output (single object when one adapter, array when several); sums `ReceivedBytes` + `SentBytes` across adapters (cumulative counters); `{}` or invalid → null
- Produces: `ratesFromDeltas(prev: { rx: number; tx: number } | null, next: { rx: number; tx: number }, dt: number): { down: number; up: number }` — MB/s = `(next - prev) / dt / 1e6`, rounded to 1 decimal; prev null or negative delta (counter reset) → 0
- Collector: poll PowerShell `Get-NetAdapterStatistics | ConvertTo-Json` every 1s (skip when the previous poll failed or took >2s; on failure keep last known totals and stop error-spamming, at most one retry per 30s); feed `totals.down/up`

- [ ] **Step 1: Failing tests** `tests/adapters.test.ts`: multi-adapter JSON array fixture; single-adapter object fixture; `{}` → null; deltas math (1e6 bytes in 1s → 1.0); first-poll null prev → 0/0; counter reset (negative delta) → 0
- [ ] **Step 2: Run** `npx vitest run` — expected FAIL
- [ ] **Step 3: Implement** `adapters.ts`; wire into collector
- [ ] **Step 4: Playwright smoke** — `playwright.config.ts` (testDir `e2e`, no webServer; timeout 30s). `e2e/smoke.spec.ts`: `_electron.launch({ args: ["out/main/index.js"] })` after `npm run build`; assert window title "Port Inspector", wait up to 10s for `.row` elements > 0 (renderer loads `out/renderer/index.html` from main when `ELECTRON_RENDERER_URL` is unset — build output is already wired this way), assert `.wordmark` text, assert `.tooltip` layer exists; screenshot to `e2e/out/smoke.png` (gitignore `e2e/out/`)
- [ ] **Step 5: Polish pass** — run `npm run dev`, compare side-by-side against the approved mockups in `.superpowers/brainstorm/1883-1792077815/content/visual-style-v5.html` (open it in a browser); fix spacing/type/animation drift; verify no AI-slop regressions (no gradients, no border stripes, no em dashes, tooltips unclipped)
- [ ] **Step 6: Run** `npx vitest run` + `npm run build` + `npx playwright test` — all PASS
- [ ] **Step 7: Commit + push** — `git commit -m "live throughput header and smoke test"`

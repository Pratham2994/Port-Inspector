# Port Inspector — Design

## Intent and why

A personal Windows network inspector, built for the pleasure of the GUI itself. It shows every listening port and active connection, which process owns it, where it connects, what the port probably is, when the connection appeared, and how much traffic moves through it. The differentiator from TCPView: understandable explanations, history, visualization, and relationships instead of a raw socket table. It is not a resume project; success is "I enjoy opening it."

## Goals

- List all TCP/UDP endpoints on this PC with owning process, state, age, first-seen time
- Plain-language explanations and tooltips everywhere, written for someone who knows nothing about networking
- Live map: remote endpoints as arcs, listening ports as inner-ring ticks, distance meaning latency
- Selection ties list and map together (route brightens, packets multiply, drawer expands in place)
- Fluid animation: arrivals, departures, packet motion, staggered entrances — all on one shared easing
- History: connections are tracked over the session, not just snapshotted

## Non-goals / anti-goals

- No kill/block/firewall actions (later, maybe)
- No remote machine inspection, no install wizard, no settings screens for v1
- Anti-goal: anything that makes it feel like an enterprise dashboard (alerts, config, jargon)
- Anti-goal (visual): AI-slop markers — glows, gradients, glass blur, colored pills, border-left stripes, em dashes, blue-tinted "AI dark" ground

## Approved visual world (from mockup v5)

- Warm graphite ground (#131211), hairline borders (rgba(255,255,255,0.07)), ~95% monochrome
- Status color only, as small dots: ok #8ab887, listening #7a776f, warn #c98578
- Mono (Cascadia Code) reserved for data: addresses, ports, rates; UI face: system stack (Segoe UI)
- Hierarchy from weight/size steps, not tracked caps
- Motion: shared easing cubic-bezier(.16,1,.3,1); exponential ease-out entrances; packets travel arcs (faster = more traffic); new connections arrive with height+fade and a one-shot ring pulse on the status dot; closing connections collapse away
- Layout: top bar (wordmark + live stats with tooltips) · left map (arcs/ticks/latency rings, legend) · right list (Process / Endpoint / State / Traffic) · selection expands an in-place drawer (What this is · Sockets · Throughput chart)
- Tooltips on every technical label, in plain words; pinned-example tone: "Port 443 is the encrypted web. Every secure website uses this door."

## Constraints

- Windows 10/11 only; the user's machine is the target
- No admin requirement for v1 (netstat + tasklist work unprivileged; ETW needs admin — stretch goal)
- Electron + React + TypeScript + Vite; animations in pure CSS/SVG, no chart library
- Commits: user's identity only, one-line messages, no AI attribution; push to origin after each milestone

## Data sources (my calls, user delegated decisions)

- Connections + PID: poll `netstat -ano` (TCP and UDP) every ~1s; parse into a connection table
- Process names: `tasklist /fo csv` cached, refreshed per PID on demand
- Latency: ICMP ping per remote endpoint, throttled (max ~1 ping per endpoint per 10s), feeds map rings
- Explanations: built-in table of well-known ports (443, 135, 2375, 27017, 5353, ...) + heuristics (0.0.0.0 listeners, loopback, ephemeral ranges); every explanation in the plain-words voice of the approved mockups
- Throughput: per-interface totals via `Get-NetAdapterStatistics` for the header stats; per-connection byte counts need ETW (Kernel-Network) — milestone 2+, needs admin; until then the drawer shows connection activity pulses (state change + packet presence), labeled honestly

## Milestones

1. Scaffold (Electron + Vite + React + TS), app shell renders the approved design with mock data
2. Live connections from netstat polling; process names; arrival/departure detection with animations; age + first-seen history
3. Map with real endpoints, latency pings, rings, ticks, packet motion
4. Tooltip system + explanations database + drawer (sockets, what-this-is)
5. Header throughput from adapter stats; polish pass against the mockups
6. ETW per-connection throughput (stretch, admin)

All visual and copy decisions above were delegated by the user ("make it decide the rest") and are recorded as my calls.

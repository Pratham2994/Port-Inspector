# Port Inspector

A small Windows app that shows what your PC is connected to, and explains it in plain words.

TCPView and `netstat` tell you that `svchost.exe` has 40 sockets open. This tells you what svchost is, why 40 is normal, who is on the other end, and whether any of it is worth a second look.

## What it shows

- **Talking now.** Every program with a live connection, one row per program (Claude, Chrome and friends run as a dozen processes; they show as one). Each row says how many connections go out to the internet and how many stay inside the PC, and who owns the other end (Google, Microsoft, Anthropic, Cloudflare, AWS...).
- **Open ports.** Programs waiting for someone to connect in. Your apps are listed first; the ones Windows always keeps open are folded away.
- **Why.** Click a row and it tells you what the program is, what each connection is usually for, and why there are so many. About 340 common programs are known: Windows parts, browsers, dev tools, AI tools, game launchers, PC-maker utilities, VPNs.
- **Map.** Each network your PC talks to is one line. Thicker means busier. Closer to the middle means it answers faster.
- **Live throughput** for the whole PC in the top bar.
- A short "What am I looking at?" section for anyone who has never heard the word port.

It only reads. Nothing is blocked, killed or changed.

## Run it

Needs Windows 10 or 11 and Node.js 20 or newer. No admin rights.

```bash
npm install
npm run dev
```

Other commands:

```bash
npm run build      # production build into out/
npm start          # run the production build
npm test           # unit tests
npm run typecheck
```

## How it works

Electron app. The main process polls `netstat -ano` every second, maps process IDs to names with `tasklist`, pings remote hosts for latency, and does reverse DNS lookups to name the other end. Throughput comes from one long-running PowerShell that reads `Get-NetAdapterStatistics` once a second. The React side groups all of that and draws it.

Network owners are a best guess from well-known address ranges and DNS names. A few will be wrong.

Per-connection byte counts are not shown yet: Windows only gives those to admin tools.

## Stack

Electron, React, TypeScript, Vite (electron-vite), Vitest, Playwright.

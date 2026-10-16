import { useState } from "react";
import type { Connection } from "../data/types";
import { listenerDoors, talkerGroups, type ListenerDoor, type TalkerGroup } from "../data/clusters";
import type { ProcInfo } from "../data/processes";
import { explainSocket, portInfo } from "../data/ports";
import { orgFor } from "../data/orgs";
import { fmtAge, fmtFirstSeen, shortAddr } from "../fmt";
import { useTip } from "./Tip";

interface Props {
  conns: Connection[];
  hostnames: Record<string, string | null>;
  selectedKey: string | null;
  now: number;
  onSelect: (key: string, procName: string) => void;
}

interface DoorGroup {
  key: string;
  pid: number;
  procName: string;
  proc: ProcInfo;
  doors: ListenerDoor[];
}

const VERDICT_LABEL: Record<ProcInfo["verdict"], string> = {
  windows: "Windows",
  known: "App",
  unknown: "Check",
};

const short = (p: string) => p.replace(/\.exe$/i, "");

function doorGroups(doors: ListenerDoor[]): DoorGroup[] {
  const acc = new Map<string, DoorGroup>();
  for (const d of doors) {
    let g = acc.get(d.procName);
    if (!g) {
      g = { key: `d:${d.procName}`, pid: d.pid, procName: d.procName, proc: d.proc, doors: [] };
      acc.set(d.procName, g);
    }
    // Several processes of one app can open the same port number; show it once.
    if (!g.doors.some((x) => x.port === d.port)) g.doors.push(d);
  }
  // Risky and unknown programs first, then the busiest.
  const rank = (g: DoorGroup) => (g.doors.some((d) => d.port === 2375) ? 0 : g.proc.verdict === "unknown" ? 1 : 2);
  return [...acc.values()].sort((a, b) => rank(a) - rank(b) || b.doors.length - a.doors.length);
}

/** Plain answer to "why is this here and why so many". */
function whyText(proc: ProcInfo, count: number, noun: string): string {
  if (proc.why) return proc.why + ".";
  if (count <= 3) return `Only ${count} ${noun}${count > 1 ? "s" : ""}. Nothing unusual.`;
  if (proc.verdict === "unknown") return `${count} ${noun}s from a program this app does not know. Check its name in Task Manager if you did not install it.`;
  return `${count} ${noun}s. Apps open one connection per job they do at the same time (downloads, sync, live updates).`;
}

/** What a remote port number means, short. */
function portWord(port: number | undefined): string {
  if (port == null) return "";
  if (port === 443) return "secure web";
  if (port === 80) return "plain web";
  return portInfo(port)?.name ?? `port ${port}`;
}

function Badge({ proc }: { proc: ProcInfo }) {
  const tip = useTip();
  return (
    <span className={`badge ${proc.verdict}`} {...tip.for(proc.verdictText)}>
      {VERDICT_LABEL[proc.verdict]}
    </span>
  );
}

function displayName(procName: string): string {
  return procName.startsWith("pid ") ? `Unknown program (${procName})` : short(procName);
}

function TalkerRow({ t, hostnames, selected, now, onSelect }: { t: TalkerGroup; hostnames: Props["hostnames"]; selected: boolean; now: number; onSelect: Props["onSelect"] }) {
  const name = displayName(t.procName);
  const outside = t.sockets - t.localSockets;
  const orgs = [
    ...new Set(t.places.map((p) => orgFor(p.host, hostnames[p.host])).filter((o): o is string => o != null && o !== "this PC")),
  ];
  const where = orgs.length
    ? orgs.slice(0, 2).join(", ") + (orgs.length > 2 ? ` +${orgs.length - 2}` : "")
    : t.localSockets
      ? "inside this PC"
      : "";
  return (
    <div className="item">
      <div className={`prow${selected ? " sel" : ""}`} onClick={() => onSelect(`t:${t.procName}`, t.procName)}>
        <div className="pmain">
          <span className="pname">{name}</span>
          <Badge proc={t.proc} />
          <span className="pwhat">{t.proc.what}</span>
        </div>
        <div className="pmeta mono">
          <span>
            {t.sockets} connection{t.sockets > 1 ? "s" : ""}
          </span>
          {t.localSockets > 0 && outside > 0 && (
            <span>
              {outside} out · {t.localSockets} inside
            </span>
          )}
          <span className="pwhere">{where}</span>
          <span>{fmtAge(now - t.firstSeen)}</span>
        </div>
      </div>
      {selected && (
        <div className="drawer">
          <div className="drawer-grid">
            <div>
              <div className="dlabel">What this is</div>
              <div className="dtext">
                <b>{name}</b> is {t.proc.what}
                {t.pids > 1 ? `, running as ${t.pids} separate processes` : ""}. {t.proc.verdictText}
              </div>
              <div className="dlabel" style={{ marginTop: 10 }}>
                What its {t.sockets} connection{t.sockets > 1 ? "s are" : " is"}
              </div>
              <div className="dtext">
                {outside > 0 && (
                  <>
                    {outside} go{outside === 1 ? "es" : ""} out to the internet{orgs.length ? ` (${orgs.slice(0, 3).join(", ")})` : ""}.{" "}
                  </>
                )}
                {t.localSockets > 0 && (
                  <>{t.localSockets} stay inside this PC: parts of the program talking to each other. They never leave your computer. </>
                )}
                {t.proc.each && <>Each one is usually {t.proc.each}.</>}
              </div>
              <div className="dlabel" style={{ marginTop: 10 }}>Why so many</div>
              <div className="dtext">{whyText(t.proc, t.sockets, "connection")}</div>
            </div>
            <div>
              <div className="dlabel">Who it talks to</div>
              {t.places.slice(0, 8).map((p) => {
                const org = orgFor(p.host, hostnames[p.host]);
                return (
                  <div key={p.host} className="sock">
                    <i /> <span className="sockorg">{org ?? "unknown owner"}</span>
                    <span className="mono sockaddr">{shortAddr(p.host)}</span>
                    <span className="sockn mono">
                      {p.sockets > 1 ? `×${p.sockets} ` : ""}
                      {org === "this PC" ? "" : portWord(p.ports[0])}
                    </span>
                  </div>
                );
              })}
              {t.places.length > 8 && <div className="sock mono dimtext">+{t.places.length - 8} more places</div>}
              <div className="dtext dimtext" style={{ marginTop: 6 }}>
                first seen {fmtFirstSeen(t.firstSeen)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DoorRow({ g, selected, onSelect }: { g: DoorGroup; selected: boolean; onSelect: Props["onSelect"] }) {
  const risky = g.doors.some((d) => d.port === 2375);
  const ports = g.doors.map((d) => d.port);
  const name = displayName(g.procName);
  return (
    <div className="item">
      <div className={`prow${selected ? " sel" : ""}${risky ? " risky" : ""}`} onClick={() => onSelect(g.key, g.procName)}>
        <div className="pmain">
          <span className="pname">{name}</span>
          <Badge proc={g.proc} />
          <span className="pwhat">{g.proc.what}</span>
        </div>
        <div className="pmeta mono">
          <span>
            {g.doors.length} open port{g.doors.length > 1 ? "s" : ""}
          </span>
          <span className="pwhere">
            :{ports.slice(0, 6).join(" :")}
            {ports.length > 6 ? ` +${ports.length - 6}` : ""}
          </span>
        </div>
      </div>
      {selected && (
        <div className="drawer">
          <div className="drawer-grid">
            <div>
              <div className="dlabel">What this is</div>
              <div className="dtext">
                <b>{name}</b> is {g.proc.what}. {g.proc.verdictText}
              </div>
              <div className="dlabel" style={{ marginTop: 10 }}>What an open port means here</div>
              <div className="dtext">
                {name} is waiting for other programs or computers to connect in on these numbers. Nothing is using them until someone connects.
              </div>
              <div className="dlabel" style={{ marginTop: 10 }}>Why so many</div>
              <div className="dtext">{whyText(g.proc, g.doors.length, "open port")}</div>
            </div>
            <div>
              <div className="dlabel">Each open port</div>
              {g.doors.slice(0, 10).map((d) => (
                <div key={d.port} className={`dtext door${d.port === 2375 ? " warn" : ""}`}>
                  <span className="mono">:{d.port}</span> {explainSocket(d.bindAddr, d.port, "listening", short(g.procName))}
                </div>
              ))}
              {g.doors.length > 10 && <div className="dtext dimtext">+{g.doors.length - 10} more ports</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ id, title, count, tipText, open, onToggle, children }: { id: string; title: string; count: string; tipText: string; open: boolean; onToggle: (id: string) => void; children: React.ReactNode }) {
  const tip = useTip();
  return (
    <div className="section">
      <div className="shead" onClick={() => onToggle(id)}>
        <span className="chev">{open ? "▾" : "▸"}</span>
        <span className="stitle" {...tip.for(tipText)}>
          {title}
        </span>
        <span className="scount mono">{count}</span>
      </div>
      {open && children}
    </div>
  );
}

export default function ConnList({ conns, hostnames, selectedKey, now, onSelect }: Props) {
  const [closed, setClosed] = useState<Set<string>>(new Set(["windows", "help"]));
  const toggle = (id: string) =>
    setClosed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { talkers, finished } = talkerGroups(conns);
  const { doors } = listenerDoors(conns);
  const groups = doorGroups(doors);
  const appDoors = groups.filter((g) => g.proc.verdict !== "windows");
  const winDoors = groups.filter((g) => g.proc.verdict === "windows");
  const winDoorCount = winDoors.reduce((n, g) => n + g.doors.length, 0);
  const appDoorCount = appDoors.reduce((n, g) => n + g.doors.length, 0);
  const total = talkers.reduce((n, t) => n + t.sockets, 0);

  return (
    <div className="list">
      <div className="rows">
        <Section id="help" title="What am I looking at?" count="" tipText="A 30-second guide to ports and connections." open={!closed.has("help")} onToggle={toggle}>
          <div className="explain">
            <p>
              <b>Connection</b>: one open conversation between a program on this PC and another computer. Like a phone call that stays open while data moves.
            </p>
            <p>
              <b>Port</b>: a number from 0 to 65535 that tells Windows which program a piece of data belongs to. Your PC has one network card but many programs, so each conversation gets a number. It is a label, not a hole in your PC.
            </p>
            <p>
              <b>Does a program "take" my ports?</b> No. When a program calls out, Windows lends it a spare number (49152 to 65535) and takes it back when the call ends. There are about 16,000 spare numbers, so nothing runs out.
            </p>
            <p>
              <b>Open port</b>: a program waiting for others to call <i>in</i>. That is the kind worth checking, because other computers may reach it.
            </p>
            <p>
              <b>Inside this PC</b>: connections to 127.0.0.1 or ::1 never leave your computer. Apps use them so their own parts can talk.
            </p>
          </div>
        </Section>
        <Section
          id="talk"
          title="Talking now"
          count={`${talkers.length} programs · ${total} connections${finished ? ` · ${finished} just closed` : ""}`}
          tipText="Programs with a live connection right now. Click one to see what it is, who it talks to, and why."
          open={!closed.has("talk")}
          onToggle={toggle}
        >
          {talkers.length === 0 && <div className="empty">Nothing is talking right now.</div>}
          {talkers.map((t) => (
            <TalkerRow key={t.key} t={t} hostnames={hostnames} selected={selectedKey === `t:${t.procName}`} now={now} onSelect={onSelect} />
          ))}
        </Section>
        <Section
          id="apps"
          title="Open ports from your apps"
          count={`${appDoors.length} programs · ${appDoorCount} ports`}
          tipText="Your programs wait on these ports for someone else to connect in. These are the ones worth checking."
          open={!closed.has("apps")}
          onToggle={toggle}
        >
          {appDoors.length === 0 && <div className="empty">No app keeps a port open.</div>}
          {appDoors.map((g) => (
            <DoorRow key={g.key} g={g} selected={selectedKey === g.key} onSelect={onSelect} />
          ))}
        </Section>
        <Section
          id="windows"
          title="Open ports from Windows itself"
          count={`${winDoors.length} programs · ${winDoorCount} ports · normal`}
          tipText="Every Windows PC keeps these open. Folded away because they are normal."
          open={!closed.has("windows")}
          onToggle={toggle}
        >
          {winDoors.map((g) => (
            <DoorRow key={g.key} g={g} selected={selectedKey === g.key} onSelect={onSelect} />
          ))}
        </Section>
      </div>
    </div>
  );
}

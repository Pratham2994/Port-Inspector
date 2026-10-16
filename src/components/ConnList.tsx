import { useState } from "react";
import type { Connection } from "../data/types";
import { listenerDoors, talkerGroups, type ListenerDoor, type TalkerGroup } from "../data/clusters";
import type { ProcInfo } from "../data/processes";
import { explainSocket, portInfo } from "../data/ports";
import { fmtAge, fmtFirstSeen, shortAddr } from "../fmt";
import { useTip } from "./Tip";

interface Props {
  conns: Connection[];
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
  const acc = new Map<number, DoorGroup>();
  for (const d of doors) {
    let g = acc.get(d.pid);
    if (!g) {
      g = { key: `d:${d.pid}`, pid: d.pid, procName: d.procName, proc: d.proc, doors: [] };
      acc.set(d.pid, g);
    }
    g.doors.push(d);
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
  return `${count} ${noun}s. Apps open one line per task they do at the same time (downloads, sync, live updates).`;
}

function Badge({ proc }: { proc: ProcInfo }) {
  const tip = useTip();
  return (
    <span className={`badge ${proc.verdict}`} {...tip.for(proc.verdictText)}>
      {VERDICT_LABEL[proc.verdict]}
    </span>
  );
}

function TalkerRow({ t, selected, now, onSelect }: { t: TalkerGroup; selected: boolean; now: number; onSelect: Props["onSelect"] }) {
  const unresolved = t.procName.startsWith("pid ");
  const name = unresolved ? `Unknown program (${t.procName})` : short(t.procName);
  const where = t.places.slice(0, 2).map((p) => shortAddr(p.host)).join(", ");
  return (
    <div className="item">
      <div className={`prow${selected ? " sel" : ""}`} onClick={() => onSelect(`t:${t.pid}`, t.procName)}>
        <div className="pmain">
          <span className="pname">{name}</span>
          <Badge proc={t.proc} />
          <span className="pwhat">{t.proc.what}</span>
        </div>
        <div className="pmeta mono">
          <span>{t.sockets} line{t.sockets > 1 ? "s" : ""}</span>
          <span>{t.places.length} place{t.places.length > 1 ? "s" : ""}</span>
          <span className="pwhere">{where}{t.places.length > 2 ? ` +${t.places.length - 2}` : ""}</span>
          <span>{fmtAge(now - t.firstSeen)}</span>
        </div>
      </div>
      {selected && (
        <div className="drawer">
          <div className="drawer-grid">
            <div>
              <div className="dlabel">What this is</div>
              <div className="dtext">
                <b>{name}</b> is {t.proc.what}. {t.proc.verdictText}
              </div>
              <div className="dlabel" style={{ marginTop: 10 }}>Why so many lines</div>
              <div className="dtext">{whyText(t.proc, t.sockets, "line")}</div>
            </div>
            <div>
              <div className="dlabel">Where it talks</div>
              {t.places.slice(0, 8).map((p) => (
                <div key={p.host} className="sock mono">
                  <i /> {shortAddr(p.host)} :{p.ports.slice(0, 3).join(",")}
                  <span className="sockn">
                    {p.sockets > 1 ? `×${p.sockets}` : ""} {portInfo(p.ports[0] ?? 0)?.name ?? ""}
                  </span>
                </div>
              ))}
              {t.places.length > 8 && <div className="sock mono dimtext">+{t.places.length - 8} more places</div>}
              <div className="dtext dimtext" style={{ marginTop: 6 }}>first seen {fmtFirstSeen(t.firstSeen)}</div>
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
  const name = g.procName.startsWith("pid ") ? `Unknown program (${g.procName})` : short(g.procName);
  return (
    <div className="item">
      <div className={`prow${selected ? " sel" : ""}${risky ? " risky" : ""}`} onClick={() => onSelect(g.key, g.procName)}>
        <div className="pmain">
          <span className="pname">{name}</span>
          <Badge proc={g.proc} />
          <span className="pwhat">{g.proc.what}</span>
        </div>
        <div className="pmeta mono">
          <span>{g.doors.length} door{g.doors.length > 1 ? "s" : ""}</span>
          <span className="pwhere">:{ports.slice(0, 6).join(" :")}{ports.length > 6 ? ` +${ports.length - 6}` : ""}</span>
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
              <div className="dlabel" style={{ marginTop: 10 }}>Why so many doors</div>
              <div className="dtext">{whyText(g.proc, g.doors.length, "open door")}</div>
            </div>
            <div>
              <div className="dlabel">Each door</div>
              {g.doors.slice(0, 10).map((d) => (
                <div key={d.port} className={`dtext door${d.port === 2375 ? " warn" : ""}`}>
                  <span className="mono">:{d.port}</span> {explainSocket(d.bindAddr, d.port, "listening", short(g.procName))}
                </div>
              ))}
              {g.doors.length > 10 && <div className="dtext dimtext">+{g.doors.length - 10} more doors</div>}
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
        <span className="stitle" {...tip.for(tipText)}>{title}</span>
        <span className="scount mono">{count}</span>
      </div>
      {open && children}
    </div>
  );
}

export default function ConnList({ conns, selectedKey, now, onSelect }: Props) {
  const [closed, setClosed] = useState<Set<string>>(new Set(["windows"]));
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
  const lines = talkers.reduce((n, t) => n + t.sockets, 0);

  return (
    <div className="list">
      <div className="rows">
        <Section
          id="talk"
          title="Talking now"
          count={`${talkers.length} programs · ${lines} lines${finished ? ` · ${finished} just closed` : ""}`}
          tipText="Programs with a live line to another computer. Click one to see what it is and where it talks."
          open={!closed.has("talk")}
          onToggle={toggle}
        >
          {talkers.length === 0 && <div className="empty">Nothing is talking right now.</div>}
          {talkers.map((t) => (
            <TalkerRow key={t.key} t={t} selected={selectedKey === `t:${t.pid}`} now={now} onSelect={onSelect} />
          ))}
        </Section>
        <Section
          id="apps"
          title="Open doors from your apps"
          count={`${appDoors.length} programs · ${appDoorCount} doors`}
          tipText="Ports your installed programs keep open, waiting for someone to connect. These are the ones worth checking."
          open={!closed.has("apps")}
          onToggle={toggle}
        >
          {appDoors.length === 0 && <div className="empty">No app keeps a door open.</div>}
          {appDoors.map((g) => (
            <DoorRow key={g.key} g={g} selected={selectedKey === g.key} onSelect={onSelect} />
          ))}
        </Section>
        <Section
          id="windows"
          title="Open doors from Windows itself"
          count={`${winDoors.length} programs · ${winDoorCount} doors · normal`}
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

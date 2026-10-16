import type { ConnGroup } from "../data/types";
import { fmtAge } from "../fmt";
import { useTip } from "./Tip";

interface Props {
  group: ConnGroup;
  selected: boolean;
  now: number;
  onSelect: (key: string) => void;
}

const stateDot: Record<ConnGroup["state"], string> = {
  established: "ok",
  listening: "ls",
  wait: "ls",
  close: "ls",
  other: "ls",
};

const stateTip: Record<ConnGroup["state"], string> = {
  established: "Connected and talking right now.",
  listening: "Waiting for a knock on the door.",
  wait: "Just closed. Windows keeps the door a moment before clearing it.",
  close: "Closing down.",
  other: "In a Windows in-between state.",
};

export default function ConnRow({ group, selected, now, onSelect }: Props) {
  const tip = useTip();
  const port = group.remotePort ?? group.listenPort;
  const host = group.remoteAddr ?? group.conns[0].localAddr;
  return (
    <div className={`row${selected ? " sel" : ""}`} onClick={() => onSelect(group.key)}>
      <div className="proc">
        {group.procName}
        <span
          className="small"
          {...tip.for("Each socket is one open line between two programs. The second part says how long ago this connection started.")}
        >
          {group.conns.length} socket{group.conns.length > 1 ? "s" : ""} · {fmtAge(now - group.firstSeen)}
        </span>
      </div>
      <div className="ep mono">
        {host}
        <span
          className="small"
          {...tip.for(`Port ${port} is a door number. Click the row to open it and read what this port is for.`)}
        >
          :{port} · {group.proto}
        </span>
      </div>
      <div className="statecell">
        <span className={`sdot ${stateDot[group.state]}`} />
        <span className="stateword" {...tip.for(stateTip[group.state])}>
          {group.state}
        </span>
      </div>
      <div className="traffic">
        <span className={`rate mono${group.state === "listening" ? " idle" : ""}`}>
          {group.state === "listening" ? "idle" : <small>live</small>}
        </span>
      </div>
    </div>
  );
}

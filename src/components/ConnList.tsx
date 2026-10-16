import { useLayoutEffect, useRef, useState } from "react";
import type { ConnGroup } from "../data/types";
import ConnRow from "./ConnRow";
import Drawer from "./Drawer";
import { useTip } from "./Tip";

interface Props {
  groups: ConnGroup[];
  selectedKey: string | null;
  now: number;
  onSelect: (key: string) => void;
}

const ANIM_CAP = 30;
const LEAVE_MS = 420;

export default function ConnList({ groups, selectedKey, now, onSelect }: Props) {
  const tip = useTip();
  const prevGroups = useRef<ConnGroup[] | null>(null);
  const [entering, setEntering] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<ConnGroup[]>([]);
  const [burst, setBurst] = useState(false);

  useLayoutEffect(() => {
    const before = prevGroups.current;
    prevGroups.current = groups;
    if (!before) return;

    const beforeKeys = new Set(before.map((g) => g.key));
    const nowKeys = new Set(groups.map((g) => g.key));
    const arrived = groups.filter((g) => !beforeKeys.has(g.key));
    const gone = before.filter((g) => !nowKeys.has(g.key));

    if (arrived.length + gone.length > ANIM_CAP) {
      setBurst(true);
      setEntering(new Set());
      setLeaving([]);
      return;
    }
    setBurst(false);
    setEntering(new Set(arrived.map((g) => g.key)));
    if (gone.length) {
      const goneKeys = new Set(gone.map((g) => g.key));
      setLeaving((cur) => [...cur.filter((g) => !goneKeys.has(g.key)), ...gone]);
      setTimeout(() => {
        setLeaving((cur) => cur.filter((g) => !goneKeys.has(g.key)));
      }, LEAVE_MS);
    }
  }, [groups]);

  const leavingVisible = leaving.filter((g) => !groups.some((n) => n.key === g.key));

  return (
    <div className="list">
      <div className="cols">
        <span className="col">Process</span>
        <span className="col" {...tip.for("The other computer this one talks to, and which door number it uses.")}>Endpoint</span>
        <span className="col" {...tip.for("Live means talking right now. Listening means waiting for a knock on the door.")}>State</span>
        <span className="col">Traffic</span>
      </div>
      <div className={`rows${burst ? " burst" : ""}`}>
        {groups.map((g) => (
          <div key={g.key} className={`item${entering.has(g.key) ? " entering" : ""}`}>
            <ConnRow group={g} selected={g.key === selectedKey} now={now} onSelect={onSelect} />
            {g.key === selectedKey && <Drawer group={g} />}
          </div>
        ))}
        {leavingVisible.map((g) => (
          <div key={g.key} className="item leaving">
            <ConnRow group={g} selected={false} now={now} onSelect={() => {}} />
          </div>
        ))}
      </div>
    </div>
  );
}

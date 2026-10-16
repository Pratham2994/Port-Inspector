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

export default function ConnList({ groups, selectedKey, now, onSelect }: Props) {
  const tip = useTip();
  return (
    <div className="list">
      <div className="cols">
        <span className="col">Process</span>
        <span className="col" {...tip.for("The other computer this one talks to, and which door number it uses.")}>Endpoint</span>
        <span className="col" {...tip.for("Live means talking right now. Listening means waiting for a knock on the door.")}>State</span>
        <span className="col">Traffic</span>
      </div>
      <div className="rows">
        {groups.map((g) => (
          <div key={g.key} className="item">
            <ConnRow group={g} selected={g.key === selectedKey} now={now} onSelect={onSelect} />
            {g.key === selectedKey && <Drawer group={g} />}
          </div>
        ))}
      </div>
    </div>
  );
}

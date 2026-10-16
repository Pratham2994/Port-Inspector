import { useEffect, useState } from "react";
import type { Snapshot } from "./data/types";
import { mockSnapshot } from "./data/mock";
import { groupByEndpoint } from "./data/grouping";
import { hasBridge } from "./env";
import TopBar from "./components/TopBar";
import MapCanvas from "./components/MapCanvas";
import ConnList from "./components/ConnList";
import { TipProvider } from "./components/Tip";

export default function App() {
  const [snap, setSnap] = useState<Snapshot>(() => mockSnapshot(Date.now()));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (hasBridge()) {
      return window.portInspector!.onSnapshot(setSnap);
    }
    const id = setInterval(() => setSnap(mockSnapshot(Date.now())), 1_000);
    return () => clearInterval(id);
  }, []);

  const groups = groupByEndpoint(snap.conns);

  return (
    <TipProvider>
      <div className="app">
        <TopBar totals={snap.totals} />
        <div className="main">
          <MapCanvas groups={groups} selectedKey={selectedKey} />
          <ConnList
            groups={groups}
            selectedKey={selectedKey}
            now={snap.t}
            onSelect={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
          />
        </div>
      </div>
    </TipProvider>
  );
}

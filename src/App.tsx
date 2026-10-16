import { useEffect, useState } from "react";
import type { Snapshot } from "./data/types";
import { mockSnapshot, demoArrival } from "./data/mock";
import { groupByEndpoint } from "./data/grouping";
import { hasBridge } from "./env";
import TopBar from "./components/TopBar";
import MapCanvas from "./components/MapCanvas";
import ConnList from "./components/ConnList";
import { TipProvider } from "./components/Tip";

export default function App() {
  const [snap, setSnap] = useState<Snapshot>(() => mockSnapshot(Date.now()));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [demoOn, setDemoOn] = useState(false);

  useEffect(() => {
    if (hasBridge()) {
      return window.portInspector!.onSnapshot(setSnap);
    }
    const id = setInterval(() => setSnap(mockSnapshot(Date.now())), 1_000);
    return () => clearInterval(id);
  }, []);

  // Demo arrival loop: the onedrive row appears, lives, then closes.
  useEffect(() => {
    const add = setTimeout(() => setDemoOn(true), 2_500);
    const remove = setTimeout(() => setDemoOn(false), 9_500);
    const loop = setInterval(() => {
      setDemoOn(true);
      setTimeout(() => setDemoOn(false), 7_000);
    }, 14_000);
    return () => {
      clearTimeout(add);
      clearTimeout(remove);
      clearInterval(loop);
    };
  }, []);

  const conns = demoOn ? [...snap.conns, { ...demoArrival, firstSeen: Date.now() }] : snap.conns;
  const groups = groupByEndpoint(conns);

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

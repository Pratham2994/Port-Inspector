import { useEffect, useState } from "react";
import type { Snapshot } from "./data/types";
import { mockSnapshot } from "./data/mock";
import { hasBridge } from "./env";
import TopBar from "./components/TopBar";
import MapCanvas from "./components/MapCanvas";
import ConnList from "./components/ConnList";
import { TipProvider } from "./components/Tip";

export default function App() {
  const [snap, setSnap] = useState<Snapshot | null>(hasBridge() ? null : mockSnapshot(Date.now()));
  const [selected, setSelected] = useState<{ key: string; proc: string } | null>(null);

  useEffect(() => {
    if (hasBridge()) {
      return window.portInspector!.onSnapshot(setSnap);
    }
    const id = setInterval(() => setSnap(mockSnapshot(Date.now())), 1_000);
    return () => clearInterval(id);
  }, []);

  const conns = snap?.conns ?? [];
  const totals = snap?.totals ?? { conns: 0, listening: 0, down: 0, up: 0 };

  return (
    <TipProvider>
      <div className="app">
        <TopBar totals={totals} />
        <div className="main">
          <MapCanvas conns={conns} selectedProc={selected?.proc ?? null} latencies={snap?.latencies ?? {}} hostnames={snap?.hostnames ?? {}} />
          {snap ? (
            <ConnList
              conns={conns}
              hostnames={snap.hostnames ?? {}}
              selectedKey={selected?.key ?? null}
              now={snap.t}
              onSelect={(key, proc) => setSelected((cur) => (cur?.key === key ? null : { key, proc }))}
            />
          ) : (
            <div className="list">
              <div className="empty">Reading connections...</div>
            </div>
          )}
        </div>
      </div>
    </TipProvider>
  );
}

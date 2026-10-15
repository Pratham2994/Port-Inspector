import { contextBridge, ipcRenderer } from "electron";
import type { Snapshot } from "../src/data/types";

contextBridge.exposeInMainWorld("portInspector", {
  onSnapshot(cb: (s: Snapshot) => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, s: Snapshot) => cb(s);
    ipcRenderer.on("snapshot", listener);
    return () => ipcRenderer.removeListener("snapshot", listener);
  },
});

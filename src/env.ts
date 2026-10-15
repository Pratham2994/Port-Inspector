import type { Snapshot } from "./data/types";

declare global {
  interface Window {
    portInspector?: {
      onSnapshot(cb: (s: Snapshot) => void): () => void;
    };
  }
}

export const hasBridge = (): boolean => typeof window !== "undefined" && !!window.portInspector;

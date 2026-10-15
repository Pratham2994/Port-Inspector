import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      lib: { entry: { index: resolve(__dirname, "electron/main.ts") } },
    },
  },
  preload: {
    build: {
      outDir: "out/preload",
      lib: { entry: { index: resolve(__dirname, "electron/preload.ts") } },
    },
  },
  renderer: {
    root: "src",
    build: {
      outDir: "out/renderer",
      rollupOptions: { input: resolve(__dirname, "src/index.html") },
    },
    plugins: [react()],
  },
});

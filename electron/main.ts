import { app, BrowserWindow } from "electron";
import { join } from "path";
import { startCollector } from "../src/data/collector";

let win: BrowserWindow | null = null;
let stopCollector: (() => void) | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#131211",
    title: "Port Inspector",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  stopCollector = startCollector((snapshot) => {
    if (win && !win.isDestroyed()) win.webContents.send("snapshot", snapshot);
  });
});

app.on("before-quit", () => {
  stopCollector?.();
  stopCollector = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";

// Placeholder emitter until Task 3 replaces it with the live collector.
import { mockSnapshot } from "../src/data/mock";

let win: BrowserWindow | null = null;

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

  const timer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send("snapshot", mockSnapshot(Date.now()));
  }, 1_000);

  ipcMain.handle("ready", () => true);
  app.on("before-quit", () => clearInterval(timer));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

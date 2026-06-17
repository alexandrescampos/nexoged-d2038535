// NexoGED Assinador — processo principal Electron.
// - Tray icon (sem janela principal).
// - Inicia o bridge HTTP local (bridge.cjs).
// - Mostra código de pareamento de 6 dígitos rotacionável.
// - Diálogo de confirmação para cada assinatura.

const { app, Tray, Menu, dialog, nativeImage, clipboard, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const crypto = require("crypto");
const startBridge = require("./bridge.cjs");

let tray = null;
let pairToken = null;
let bridgePort = null;
let pairWindow = null;

function generatePairToken() {
  // 6 dígitos numéricos
  pairToken = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  return pairToken;
}

function getStatusText() {
  return [
    `NexoGED Assinador`,
    `Porta: ${bridgePort ?? "—"}`,
    `Pareamento: ${pairToken ?? "—"}`,
  ].join("\n");
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: "NexoGED Assinador", enabled: false },
    { type: "separator" },
    { label: `Porta: 127.0.0.1:${bridgePort ?? "—"}`, enabled: false },
    { label: `Pareamento: ${pairToken ?? "—"}`, enabled: false },
    {
      label: "Copiar código de pareamento",
      click: () => { if (pairToken) clipboard.writeText(pairToken); },
    },
    {
      label: "Gerar novo código",
      click: () => { generatePairToken(); refreshTray(); },
    },
    { type: "separator" },
    {
      label: "Mostrar status",
      click: () => {
        dialog.showMessageBox({
          type: "info",
          title: "NexoGED Assinador",
          message: getStatusText(),
          buttons: ["OK"],
        });
      },
    },
    { type: "separator" },
    { label: "Sair", click: () => app.quit() },
  ]);
}

function refreshTray() {
  if (!tray) return;
  tray.setToolTip(getStatusText());
  tray.setContextMenu(buildMenu());
}

// Diálogo nativo de confirmação para cada assinatura.
// Retorna boolean.
async function confirmSign({ subject, hashHex, intent }) {
  const r = await dialog.showMessageBox({
    type: "question",
    title: "Confirmar assinatura",
    message: "Autorizar assinatura digital?",
    detail:
      `Certificado: ${subject}\n` +
      `Hash do documento (SHA-256):\n${hashHex}\n\n` +
      (intent ? `Intenção: ${intent}\n` : ""),
    buttons: ["Cancelar", "Assinar"],
    defaultId: 1,
    cancelId: 0,
  });
  return r.response === 1;
}

app.whenReady().then(async () => {
  // Evita 2ª instância
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) { app.quit(); return; }

  generatePairToken();

  // Inicia bridge HTTP
  try {
    const info = await startBridge({
      getPairToken: () => pairToken,
      confirmSign,
    });
    bridgePort = info.port;
  } catch (e) {
    dialog.showErrorBox("Erro ao iniciar bridge", String(e?.message || e));
    app.quit();
    return;
  }

  // Tray
  const iconPath = path.join(__dirname, "assets", process.platform === "win32" ? "tray.ico" : "tray.png");
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    // fallback 16x16 transparent
    image = nativeImage.createEmpty();
  }
  tray = new Tray(image);
  refreshTray();

  // macOS: não sair quando a última janela fecha
  app.on("window-all-closed", (e) => e.preventDefault());
});

app.on("before-quit", () => {
  // bridge fecha junto com o processo
});

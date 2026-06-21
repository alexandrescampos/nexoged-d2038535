// NexoGED Assinador — processo principal Electron.
// - Tray icon (sem janela principal).
// - Inicia o bridge HTTP local (bridge.cjs).
// - Mostra código de pareamento de 6 dígitos rotacionável.
// - Diálogo de confirmação para cada assinatura.

const { app, Tray, Menu, dialog, nativeImage, clipboard, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const crypto = require("crypto");
const startBridge = require("./bridge.cjs");
const appVersion = require("./package.json").version;

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

  // Tray — usa tray.png em todas as plataformas (Electron suporta PNG no Windows).
  // Fallback para icon.png se tray.png não existir.
  const candidates = [
    path.join(__dirname, "assets", "tray.png"),
    path.join(__dirname, "assets", "icon.png"),
  ];
  let image = nativeImage.createEmpty();
  for (const p of candidates) {
    const img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) { image = img; break; }
  }
  // No Windows o ícone da bandeja deve ser 16x16.
  if (process.platform === "win32" && !image.isEmpty()) {
    image = image.resize({ width: 16, height: 16 });
  }
  tray = new Tray(image);
  refreshTray();

  // Notificação inicial para o usuário saber que o app subiu e ver o código.
  try {
    tray.displayBalloon?.({
      title: "NexoGED Assinador iniciado",
      content: `Porta 127.0.0.1:${bridgePort}\nCódigo de pareamento: ${pairToken}\nClique com o botão direito no ícone da bandeja.`,
    });
  } catch {}

  // Abre uma janela informativa na primeira execução para garantir que o usuário veja.
  try {
    const win = new BrowserWindow({
      width: 460, height: 280, resizable: false, minimizable: true, maximizable: false,
      title: "NexoGED Assinador",
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    win.setMenu(null);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>NexoGED Assinador</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:24px;background:#0F172A;color:#fff}
        h1{font-size:18px;margin:0 0 8px}
        .code{font-family:Consolas,monospace;font-size:32px;letter-spacing:8px;background:#1A2332;padding:12px 16px;border-radius:8px;text-align:center;margin:16px 0;border:1px solid #1565C0}
        p{font-size:13px;color:#cbd5e1;margin:6px 0;line-height:1.5}
        small{color:#94a3b8}
      </style></head>
      <body>
        <h1>✅ Assinador em execução</h1>
        <p>Versão: <strong>${appVersion}</strong></p>
        <p>Porta local: <strong>127.0.0.1:${bridgePort}</strong></p>
        <p>Cole este código no campo de pareamento do navegador:</p>
        <div class="code">${pairToken}</div>
        <small>Você pode fechar esta janela — o app continua rodando na bandeja do sistema.</small>
      </body></html>`;
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  } catch {}

  // macOS: não sair quando a última janela fecha
  app.on("window-all-closed", (e) => e.preventDefault());
});

app.on("before-quit", () => {
  // bridge fecha junto com o processo
});

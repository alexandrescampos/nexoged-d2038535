// Bridge HTTP local — escuta APENAS em 127.0.0.1.
// Endpoints:
//   GET  /health
//   GET  /certs           (X-Pair-Token)
//   POST /cert  {thumbprint}              (X-Pair-Token)
//   POST /sign  {thumbprint,hashHex,intent} (X-Pair-Token)

const http = require("http");
const certStore = require("./cert-store.cjs");
const pkcs11Store = require("./pkcs11.cjs");

const ORIGIN_ALLOWLIST = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/nexoged\.lovable\.app$/,
  /^https:\/\/nexoged\.tecnologianexo\.com\.br$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/,
];

function originAllowed(origin) {
  if (!origin) return true; // CLI/curl
  return ORIGIN_ALLOWLIST.some((re) => re.test(origin));
}

async function start({ getPairToken, confirmSign }) {
  function sendJson(res, statusCode, payload, origin) {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
    };
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers.Vary = "Origin";
      headers["Access-Control-Allow-Headers"] = "Content-Type, X-Pair-Token";
      headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      headers["Access-Control-Allow-Private-Network"] = "true";
    }
    res.writeHead(statusCode, headers);
    res.end(payload === undefined ? "" : JSON.stringify(payload));
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) {
          reject(new Error("request-too-large"));
          req.destroy();
        }
      });
      req.on("end", () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          reject(new Error("invalid-json"));
        }
      });
      req.on("error", reject);
    });
  }

  function requirePair(req, res, origin) {
    const expected = getPairToken();
    const sent = req.headers["x-pair-token"];
    if (!expected || !sent || sent !== expected) {
      sendJson(res, 401, { error: "unpaired" }, origin);
      return false;
    }
    return true;
  }
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!originAllowed(origin)) {
      sendJson(res, 403, { error: "origin-not-allowed", origin }, null);
      return;
    }

    if (req.method === "OPTIONS") {
      sendJson(res, 204, undefined, origin);
      return;
    }

    const path = new URL(req.url || "/", "http://127.0.0.1").pathname;

    try {
      if (req.method === "GET" && path === "/health") {
        sendJson(res, 200, {
          ok: true,
          version: require("./package.json").version,
          platform: process.platform,
        }, origin);
        return;
      }

      if (req.method === "GET" && path === "/certs") {
        if (!requirePair(req, res, origin)) return;
        const [osCerts, tokenCerts] = await Promise.all([
          certStore.list().catch(() => []),
          pkcs11Store.list().catch(() => []),
        ]);
        sendJson(res, 200, { certs: [...osCerts, ...tokenCerts] }, origin);
        return;
      }

      if (req.method === "POST" && path === "/cert") {
        if (!requirePair(req, res, origin)) return;
        const { thumbprint } = await readJsonBody(req);
        if (!thumbprint) return sendJson(res, 400, { error: "missing-thumbprint" }, origin);
        const b64 =
          (await certStore.read(thumbprint).catch(() => null)) ||
          (await pkcs11Store.read(thumbprint).catch(() => null));
        if (!b64) return sendJson(res, 404, { error: "cert-not-found" }, origin);
        sendJson(res, 200, { certificateB64: b64 }, origin);
        return;
      }

      if (req.method === "POST" && path === "/sign") {
        if (!requirePair(req, res, origin)) return;
        const { thumbprint, hashHex, intent } = await readJsonBody(req);
        if (!thumbprint || !hashHex) return sendJson(res, 400, { error: "missing-params" }, origin);

        // descobre subject p/ diálogo
        const all = [
          ...(await certStore.list().catch(() => [])),
          ...(await pkcs11Store.list().catch(() => [])),
        ];
        const cert = all.find((c) => c.thumbprint === thumbprint);
        if (!cert) return sendJson(res, 404, { error: "cert-not-found" }, origin);

        const ok = await confirmSign({
          subject: cert.subjectName || thumbprint,
          hashHex,
          intent: intent || "",
        });
        if (!ok) return sendJson(res, 409, { error: "user-cancelled" }, origin);

        try {
          const sig =
            cert.source === "A3-PKCS11"
              ? await pkcs11Store.sign(thumbprint, hashHex)
              : await certStore.sign(thumbprint, hashHex);
          sendJson(res, 200, { signatureB64: sig }, origin);
        } catch (e) {
          if (String(e?.message || "").includes("PIN")) {
            sendJson(res, 423, { error: "pin-failed", detail: String(e.message) }, origin);
            return;
          }
          sendJson(res, 500, { error: "sign-failed", detail: String(e?.message || e) }, origin);
        }
        return;
      }

      sendJson(res, 404, { error: "not-found" }, origin);
    } catch (e) {
      const message = String(e?.message || e);
      const status = message === "invalid-json" || message === "request-too-large" ? 400 : 500;
      sendJson(res, status, { error: message }, origin);
    }
  });

  // Tenta 59123, depois 59124, 59125
  let port = null;
  for (const p of [59123, 59124, 59125]) {
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(p, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      port = p;
      break;
    } catch (_) { /* tenta a próxima */ }
  }
  if (!port) throw new Error("Nenhuma porta livre (59123-59125)");

  return { port };
}

module.exports = start;

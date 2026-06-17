// Bridge HTTP local — escuta APENAS em 127.0.0.1.
// Endpoints:
//   GET  /health
//   GET  /certs           (X-Pair-Token)
//   POST /cert  {thumbprint}              (X-Pair-Token)
//   POST /sign  {thumbprint,hashHex,intent} (X-Pair-Token)

const Fastify = require("fastify");
const certStore = require("./cert-store.cjs");
const pkcs11Store = require("./pkcs11.cjs");

const ORIGIN_ALLOWLIST = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/nexoged\.lovable\.app$/,
  /^https:\/\/nexoged\.tecnologianexo\.com\.br$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/,
];

function originAllowed(origin) {
  if (!origin) return true; // CLI/curl
  return ORIGIN_ALLOWLIST.some((re) => re.test(origin));
}

async function start({ getPairToken, confirmSign }) {
  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (!originAllowed(origin)) {
      reply.code(403).send({ error: "origin-not-allowed", origin });
      return reply;
    }
    if (origin) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
      reply.header("Access-Control-Allow-Headers", "Content-Type, X-Pair-Token");
      reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
  });

  app.options("/*", async (_req, reply) => reply.code(204).send());

  app.get("/health", async () => ({
    ok: true,
    version: require("./package.json").version,
    platform: process.platform,
  }));

  function requirePair(req, reply) {
    const expected = getPairToken();
    const sent = req.headers["x-pair-token"];
    if (!expected || !sent || sent !== expected) {
      reply.code(401).send({ error: "unpaired" });
      return false;
    }
    return true;
  }

  app.get("/certs", async (req, reply) => {
    if (!requirePair(req, reply)) return;
    const [osCerts, tokenCerts] = await Promise.all([
      certStore.list().catch(() => []),
      pkcs11Store.list().catch(() => []),
    ]);
    return { certs: [...osCerts, ...tokenCerts] };
  });

  app.post("/cert", async (req, reply) => {
    if (!requirePair(req, reply)) return;
    const { thumbprint } = req.body || {};
    if (!thumbprint) return reply.code(400).send({ error: "missing-thumbprint" });
    const b64 =
      (await certStore.read(thumbprint).catch(() => null)) ||
      (await pkcs11Store.read(thumbprint).catch(() => null));
    if (!b64) return reply.code(404).send({ error: "cert-not-found" });
    return { certificateB64: b64 };
  });

  app.post("/sign", async (req, reply) => {
    if (!requirePair(req, reply)) return;
    const { thumbprint, hashHex, intent } = req.body || {};
    if (!thumbprint || !hashHex) return reply.code(400).send({ error: "missing-params" });

    // descobre subject p/ diálogo
    const all = [
      ...(await certStore.list().catch(() => [])),
      ...(await pkcs11Store.list().catch(() => [])),
    ];
    const cert = all.find((c) => c.thumbprint === thumbprint);
    if (!cert) return reply.code(404).send({ error: "cert-not-found" });

    const ok = await confirmSign({
      subject: cert.subjectName || thumbprint,
      hashHex,
      intent: intent || "",
    });
    if (!ok) return reply.code(409).send({ error: "user-cancelled" });

    try {
      const sig =
        cert.source === "A3-PKCS11"
          ? await pkcs11Store.sign(thumbprint, hashHex)
          : await certStore.sign(thumbprint, hashHex);
      return { signatureB64: sig };
    } catch (e) {
      if (String(e?.message || "").includes("PIN")) {
        return reply.code(423).send({ error: "pin-failed", detail: String(e.message) });
      }
      return reply.code(500).send({ error: "sign-failed", detail: String(e?.message || e) });
    }
  });

  // Tenta 59123, depois 59124, 59125
  let port = null;
  for (const p of [59123, 59124, 59125]) {
    try {
      await app.listen({ host: "127.0.0.1", port: p });
      port = p;
      break;
    } catch (_) { /* tenta a próxima */ }
  }
  if (!port) throw new Error("Nenhuma porta livre (59123-59125)");

  return { port };
}

module.exports = start;

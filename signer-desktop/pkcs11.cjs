// PKCS#11 — acesso a tokens A3 (SafeNet eToken, Watchdata, GemPC, etc.).
// Procura módulos conhecidos no sistema; lista certs + chaves; assina SHA256withRSA.
//
// Observação: o módulo nativo do fabricante precisa estar instalado no SO
// (ex.: SafeNet Authentication Client). Nós só carregamos a .dll/.so/.dylib.

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let pkcs11;
try { pkcs11 = require("pkcs11js"); } catch { pkcs11 = null; }

const CANDIDATES = {
  win32: [
    "C:\\Windows\\System32\\eTPKCS11.dll",                 // SafeNet eToken
    "C:\\Windows\\System32\\aetpkss1.dll",                 // Athena/SafeSign
    "C:\\Windows\\System32\\gclib.dll",                    // GemPC
    "C:\\Windows\\System32\\WDPKCS.dll",                   // Watchdata
    "C:\\Windows\\System32\\acospkcs11.dll",
    "C:\\Windows\\System32\\asepkcs.dll",
  ],
  darwin: [
    "/Library/Frameworks/eToken.framework/Versions/A/libeToken.dylib",
    "/usr/local/lib/libwdpkcs.dylib",
  ],
  linux: [
    "/usr/lib/libeToken.so",
    "/usr/lib/pkcs11/libeToken.so",
    "/usr/lib/x86_64-linux-gnu/pkcs11/libwdpkcs.so",
    "/usr/lib/libwdpkcs.so",
    "/usr/lib/x86_64-linux-gnu/opensc-pkcs11.so",
  ],
};

function findModule() {
  const list = CANDIDATES[process.platform] || [];
  return list.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || process.env.NEXOGED_PKCS11_MODULE || null;
}

function withSession(fn) {
  if (!pkcs11) throw new Error("pkcs11js-not-available");
  const mod = findModule();
  if (!mod) throw new Error("pkcs11-module-not-found");
  const p11 = new pkcs11.PKCS11();
  p11.load(mod);
  p11.C_Initialize();
  try {
    const slots = p11.C_GetSlotList(true);
    const results = [];
    for (const slot of slots) {
      const session = p11.C_OpenSession(slot, pkcs11.CKF_SERIAL_SESSION | pkcs11.CKF_RW_SESSION);
      try {
        const out = fn(p11, session, slot);
        if (Array.isArray(out)) results.push(...out);
        else if (out !== undefined) results.push(out);
      } finally {
        try { p11.C_CloseSession(session); } catch {}
      }
    }
    return results;
  } finally {
    try { p11.C_Finalize(); } catch {}
  }
}

function findCertificates(p11, session) {
  const certs = [];
  p11.C_FindObjectsInit(session, [{ type: pkcs11.CKA_CLASS, value: pkcs11.CKO_CERTIFICATE }]);
  let obj;
  while ((obj = p11.C_FindObjects(session))) {
    const attrs = p11.C_GetAttributeValue(session, obj, [
      { type: pkcs11.CKA_VALUE },
      { type: pkcs11.CKA_ID },
      { type: pkcs11.CKA_LABEL },
    ]);
    const der = attrs[0].value;
    const id = attrs[1].value;
    const label = attrs[2].value?.toString("utf8") || "";
    const tp = crypto.createHash("sha1").update(der).digest("hex").toUpperCase();
    certs.push({ der, id, label, thumbprint: tp });
  }
  p11.C_FindObjectsFinal(session);
  return certs;
}

function parseCert(der) {
  try {
    const forge = require("node-forge");
    const c = forge.pki.certificateFromAsn1(forge.asn1.fromDer(Buffer.from(der).toString("binary")));
    return {
      subjectName: c.subject.attributes.map((a) => `${a.shortName}=${a.value}`).join(", "),
      issuerName: c.issuer.attributes.map((a) => `${a.shortName}=${a.value}`).join(", "),
      validityStart: c.validity.notBefore.toISOString(),
      validityEnd: c.validity.notAfter.toISOString(),
      serialNumber: c.serialNumber,
    };
  } catch {
    return { subjectName: "(certificado A3)", issuerName: "" };
  }
}

async function list() {
  if (!pkcs11) return [];
  try {
    return withSession((p11, session) => {
      return findCertificates(p11, session).map((c) => ({
        thumbprint: c.thumbprint,
        ...parseCert(c.der),
        source: "A3-PKCS11",
      }));
    });
  } catch {
    return [];
  }
}

async function read(thumbprint) {
  try {
    const arr = withSession((p11, session) => {
      const c = findCertificates(p11, session).find((x) => x.thumbprint === thumbprint);
      return c ? Buffer.from(c.der).toString("base64") : null;
    }).filter(Boolean);
    return arr[0] || null;
  } catch {
    return null;
  }
}

async function sign(thumbprint, hashHex) {
  if (!pkcs11) throw new Error("pkcs11js-not-available");
  // Pede PIN — em produção, o módulo SafeNet abre janela própria de PIN.
  // Aqui usamos C_Login com PIN do usuário; se módulo tiver protected-auth-path, passa null.
  return withSession((p11, session) => {
    // Localiza cert + chave por CKA_ID
    const cert = findCertificates(p11, session).find((c) => c.thumbprint === thumbprint);
    if (!cert) return null;

    // Login (PIN). Tentamos protected-auth-path primeiro.
    try { p11.C_Login(session, pkcs11.CKU_USER, null); }
    catch {
      // Sem protected-auth-path; sem UI nativa nossa para PIN: erro instrutivo.
      throw new Error("PIN-required: token sem protected-auth-path. Configure o middleware do fabricante.");
    }

    try {
      p11.C_FindObjectsInit(session, [
        { type: pkcs11.CKA_CLASS, value: pkcs11.CKO_PRIVATE_KEY },
        { type: pkcs11.CKA_ID, value: cert.id },
      ]);
      const key = p11.C_FindObjects(session);
      p11.C_FindObjectsFinal(session);
      if (!key) throw new Error("private-key-not-found");

      // DigestInfo prefix p/ SHA-256 + hash
      const prefix = Buffer.from("3031300d060960864801650304020105000420", "hex");
      const hash = Buffer.from(hashHex, "hex");
      const data = Buffer.concat([prefix, hash]);

      p11.C_SignInit(session, { mechanism: pkcs11.CKM_RSA_PKCS }, key);
      const sig = p11.C_Sign(session, data, Buffer.alloc(512));
      return Buffer.from(sig).toString("base64");
    } finally {
      try { p11.C_Logout(session); } catch {}
    }
  })[0];
}

module.exports = { list, read, sign };

// Acesso ao certificate store do SO (A1).
// Windows  → PowerShell + Cert:\CurrentUser\My
// macOS    → /usr/bin/security + identidade no Keychain
// Linux    → não há store padrão; retorna vazio (use A3 via PKCS#11 ou A1 via arquivo .pfx — futuro).

const { spawn } = require("child_process");
const crypto = require("crypto");

function run(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err.trim() || `exit ${code}`));
    });
    if (input) p.stdin.end(input);
  });
}

// === Windows ===
async function listWin() {
  const ps = `
    $ErrorActionPreference='Stop'
    $certs = Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.HasPrivateKey -eq $true }
    $arr = @()
    foreach($c in $certs){
      $arr += [pscustomobject]@{
        thumbprint = $c.Thumbprint
        subjectName = $c.Subject
        issuerName  = $c.Issuer
        validityStart = $c.NotBefore.ToString("o")
        validityEnd   = $c.NotAfter.ToString("o")
        serialNumber  = $c.SerialNumber
      }
    }
    $arr | ConvertTo-Json -Compress
  `;
  const out = await run("powershell.exe", ["-NoProfile", "-Command", ps]);
  const parsed = JSON.parse(out || "[]");
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.map((c) => ({ ...c, source: "A1-OS" }));
}

async function readWin(thumbprint) {
  const ps = `
    $c = Get-Item -LiteralPath Cert:\\CurrentUser\\My\\${thumbprint}
    [System.Convert]::ToBase64String($c.RawData)
  `;
  return (await run("powershell.exe", ["-NoProfile", "-Command", ps])).trim();
}

async function signWin(thumbprint, hashHex) {
  // Usa RSACryptoServiceProvider para assinar o hash já calculado.
  const ps = `
    $c = Get-Item -LiteralPath Cert:\\CurrentUser\\My\\${thumbprint}
    $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($c)
    if($null -eq $rsa){ throw "no-private-key" }
    $hash = [byte[]]@(${hashHex.match(/.{2}/g).map((b) => parseInt(b, 16)).join(",")})
    $sig = $rsa.SignHash($hash, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    [System.Convert]::ToBase64String($sig)
  `;
  return (await run("powershell.exe", ["-NoProfile", "-Command", ps])).trim();
}

// === macOS ===
async function listMac() {
  // 'security find-identity -v -p codesigning' não filtra ICP; usar 'find-certificate -a'
  const out = await run("/usr/bin/security", ["find-certificate", "-a", "-p"]);
  // Parse blocos PEM; calcula thumbprint SHA-1 do DER.
  const blocks = out.split(/-----END CERTIFICATE-----/).map((b) => b.trim()).filter(Boolean);
  const result = [];
  for (const b of blocks) {
    const pem = b.replace(/-----BEGIN CERTIFICATE-----/, "").trim() + "\n";
    try {
      const der = Buffer.from(pem.replace(/\s+/g, ""), "base64");
      const tp = crypto.createHash("sha1").update(der).digest("hex").toUpperCase();
      // Subject/issuer rápidos: usa node-forge se disponível
      let subjectName = "(certificado)", issuerName = "";
      try {
        const forge = require("node-forge");
        const c = forge.pki.certificateFromAsn1(forge.asn1.fromDer(der.toString("binary")));
        subjectName = c.subject.attributes.map((a) => `${a.shortName}=${a.value}`).join(", ");
        issuerName  = c.issuer.attributes.map((a) => `${a.shortName}=${a.value}`).join(", ");
        result.push({
          thumbprint: tp,
          subjectName,
          issuerName,
          validityStart: c.validity.notBefore.toISOString(),
          validityEnd: c.validity.notAfter.toISOString(),
          serialNumber: c.serialNumber,
          source: "A1-OS",
          _der: der.toString("base64"),
        });
      } catch {/* skip */}
    } catch {/* skip */}
  }
  return result;
}

async function readMac(thumbprint) {
  const list = await listMac();
  const found = list.find((c) => c.thumbprint === thumbprint);
  return found ? found._der : null;
}

async function signMac(thumbprint, hashHex) {
  // macOS Keychain não expõe SignHash direto via CLI.
  // Estratégia: extrair a chave privada via 'security' requer export — não seguro.
  // Para MVP, retornamos erro instruindo uso de A3 ou Windows.
  throw new Error("macOS-A1-not-implemented — use token A3 ou aguarde próxima versão.");
}

// === Linux ===
async function listLinux() { return []; }
async function readLinux() { return null; }
async function signLinux() { throw new Error("linux-A1-not-implemented"); }

const impl =
  process.platform === "win32" ? { list: listWin, read: readWin, sign: signWin } :
  process.platform === "darwin" ? { list: listMac, read: readMac, sign: signMac } :
  { list: listLinux, read: readLinux, sign: signLinux };

module.exports = impl;

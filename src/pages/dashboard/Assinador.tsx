import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Download, Shield, CheckCircle2, XCircle, Loader2, MonitorSmartphone, Apple, Terminal } from "lucide-react";
import { toast } from "sonner";
import winSignerAsset from "@/assets/nexoged-assinador-win.zip.asset.json";
import linuxSignerAsset from "@/assets/nexoged-assinador-linux.zip.asset.json";
import macSignerAsset from "@/assets/nexoged-assinador-mac.zip.asset.json";
// Versão atual publicada do app desktop (mantenha em sincronia com signer-desktop/package.json)
const SIGNER_VERSION = "0.1.3";
const WIN_URL = winSignerAsset.url;
const MAC_URL = macSignerAsset.url;
const LINUX_URL = linuxSignerAsset.url;
const WIN_FILENAME = `NexoGED-Assinador-v${SIGNER_VERSION}-win-x64.zip`;
const MAC_FILENAME = `NexoGED-Assinador-v${SIGNER_VERSION}-macos-x64.zip`;
const LINUX_FILENAME = `NexoGED-Assinador-v${SIGNER_VERSION}-linux-x64.zip`;
import {
  initPki,
  listCertificates,
  getPairToken,
  getBridgePort,
  setPairToken,
  setBridgePort,
  clearPairToken,
  describeBridgeError,
} from "@/lib/signerBridge";

type Status = "checking" | "ok" | "unpaired" | "missing" | "error";

export default function AssinadorPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [version, setVersion] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  const [errMsg, setErrMsg] = useState<string>("");
  const [pair, setPair] = useState<string>(getPairToken() || "");
  const [port, setPort] = useState<string>(getBridgePort());
  const [certCount, setCertCount] = useState<number | null>(null);

  const check = async () => {
    setStatus("checking");
    setErrMsg("");
    try {
      const h = await initPki();
      setVersion(h.version);
      setPlatform(h.platform);
      try {
        const list = await listCertificates();
        setCertCount(list.length);
        setStatus("ok");
      } catch (e: unknown) {
        if (String((e as { message?: unknown })?.message || "").includes("bridge-unpaired")) {
          setStatus("unpaired");
        } else {
          setStatus("error");
          setErrMsg(describeBridgeError(e));
        }
      }
    } catch (e: unknown) {
      const rawMessage = String((e as { message?: unknown })?.message || "");
      if (rawMessage.includes("bridge-not-running")) {
        setStatus("missing");
      } else {
        setStatus("error");
        setErrMsg(describeBridgeError(e));
      }
    }
  };

  useEffect(() => { check(); }, []);

  const handlePair = async () => {
    const t = pair.trim();
    if (!/^\d{6}$/.test(t)) { toast.error("Cole o código de 6 dígitos"); return; }
    try {
      setBridgePort(port);
    } catch {
      toast.error("Use uma porta válida: 59123, 59124 ou 59125");
      return;
    }
    setPairToken(t);
    setStatus("checking");
    setErrMsg("");
    try {
      const h = await initPki();
      setVersion(h.version);
      setPlatform(h.platform);
      const list = await listCertificates();
      setCertCount(list.length);
      setStatus("ok");
      toast.success("Pareado com sucesso");
    } catch (e: unknown) {
      const message = describeBridgeError(e);
      setStatus(String((e as { message?: unknown })?.message || "").includes("bridge-unpaired") ? "unpaired" : "error");
      setErrMsg(message);
      toast.error(message);
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">NexoGED Assinador</h1>
        <p className="text-muted-foreground mt-1">
          Aplicativo desktop que acessa seu certificado A1 ou token A3 (ICP-Brasil) para assinar documentos pelo web app.
        </p>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Status nesta máquina
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "checking" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
            </div>
          )}
          {status === "ok" && (
            <Alert className="border-green-500/40 bg-green-500/5">
              <AlertDescription className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>
                  Assinador conectado e pareado.{" "}
                  <Badge variant="secondary">v{version}</Badge>{" "}
                  <Badge variant="outline">{platform}</Badge>{" "}
                  {certCount !== null && (
                    <span className="text-xs text-muted-foreground">· {certCount} certificado(s) detectado(s)</span>
                  )}
                </span>
              </AlertDescription>
            </Alert>
          )}
          {status === "unpaired" && (
            <Alert>
              <AlertDescription className="space-y-3">
                <p className="text-sm">
                  Assinador detectado, mas este navegador ainda não foi autorizado. Abra o ícone do <strong>NexoGED Assinador</strong> na bandeja do sistema e copie o <strong>código de pareamento de 6 dígitos</strong>.
                </p>
                <div className="flex items-center gap-2 max-w-xs">
                  <Input
                    value={pair}
                    onChange={(e) => setPair(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    className="font-mono tracking-widest text-center text-lg"
                  />
                  <Button onClick={handlePair}>Parear</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          {status === "missing" && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Não consegui localizar o assinador em 127.0.0.1:{port}. Confirme se a porta abaixo é a mesma exibida no app desktop e se você está rodando a versão <strong>0.1.3</strong> ou superior (versões antigas não suportam Local Network Access do Chrome).
              </AlertDescription>
            </Alert>
          )}
          {status === "error" && (
            <Alert variant="destructive">
              <AlertDescription>
                {errMsg || "Erro desconhecido."}
                <div className="text-xs mt-1 opacity-80">Se a mensagem mencionar bloqueio local, feche totalmente o app na bandeja e abra a versão <strong>0.1.3</strong> ou superior.</div>
              </AlertDescription>
            </Alert>
          )}

          {/* Campo de pareamento sempre visível para permitir colar o código a qualquer momento */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Código de pareamento (6 dígitos)</p>
            <p className="text-xs text-muted-foreground">
              Informe a mesma porta e o código exibidos na janela do app desktop.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:max-w-md">
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="59123"
                inputMode="numeric"
                maxLength={5}
                aria-label="Porta do assinador"
                className="font-mono text-center sm:w-28"
              />
              <Input
                value={pair}
                onChange={(e) => setPair(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                aria-label="Código de pareamento"
                className="font-mono tracking-widest text-center text-lg"
              />
              <Button onClick={handlePair}>Parear</Button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={check}>Verificar novamente</Button>
            {getPairToken() && (
              <Button variant="ghost" size="sm" onClick={() => { clearPairToken(); setPair(""); check(); }}>
                Remover pareamento
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Downloads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Baixar instalador</CardTitle>
          <CardDescription>
            Versão mais recente: <Badge variant="secondary">v{SIGNER_VERSION}</Badge> · Escolha o sistema operacional abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DownloadCard
            icon={<MonitorSmartphone className="h-5 w-5" />}
            os="Windows"
            arch="10 / 11 · x64"
            version={SIGNER_VERSION}
            filename={WIN_FILENAME}
            href={WIN_URL}
          />
          <DownloadCard
            icon={<Apple className="h-5 w-5" />}
            os="macOS"
            arch="11+ · Intel/Apple Silicon"
            version={SIGNER_VERSION}
            filename={MAC_FILENAME}
            href={MAC_URL}
          />
          <DownloadCard
            icon={<Terminal className="h-5 w-5" />}
            os="Linux"
            arch="x64 · zip"
            version={SIGNER_VERSION}
            filename={LINUX_FILENAME}
            href={LINUX_URL}
          />
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Como usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Step n={1} title="Instale o aplicativo">
            Baixe o instalador para o seu sistema e execute. Em macOS pode aparecer aviso de "desenvolvedor não identificado" — clique com o botão direito → Abrir.
          </Step>
          <Step n={2} title="Abra o assinador">
            O app fica como ícone na bandeja do sistema (perto do relógio). Clique nele para ver o status e o código de pareamento.
          </Step>
          <Step n={3} title="Conecte seu token A3 (se aplicável)">
            Para token físico, certifique-se de que o driver PKCS#11 do fabricante (SafeNet, Watchdata, Valid, GemPC etc.) já esteja instalado.
          </Step>
          <Step n={4} title="Pareie este navegador">
            Copie o código de 6 dígitos exibido na bandeja e cole no campo acima. O pareamento fica salvo neste navegador.
          </Step>
          <Step n={5} title="Assine documentos">
            Volte para o documento e clique em assinar. O app desktop pedirá o PIN do token (apenas para A3) e devolverá a assinatura.
          </Step>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segurança</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• O assinador escuta apenas em <code className="text-xs">127.0.0.1</code> (loopback) — inacessível pela rede.</p>
          <p>• Apenas origens autorizadas (este domínio e o do app) podem listar certificados ou solicitar assinatura.</p>
          <p>• Cada assinatura exige confirmação na sua máquina (diálogo nativo + PIN do token para A3).</p>
          <p>• Sua chave privada nunca sai do token/repositório do SO — apenas o hash do documento é assinado.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function DownloadCard({ icon, os, arch, version, filename, href, disabled }: { icon: React.ReactNode; os: string; arch: string; version?: string; filename?: string; href: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <div className="block border rounded-md p-4 opacity-60 cursor-not-allowed">
        <div className="flex items-center gap-2 mb-1">{icon}<span className="font-medium">{os}</span></div>
        <div className="text-xs text-muted-foreground">{arch}</div>
        <div className="text-xs text-muted-foreground mt-2">Em breve</div>
      </div>
    );
  }
  return (
    <a
      href={href}
      className="block border rounded-md p-4 hover:bg-accent transition-colors"
      download={filename}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}<span className="font-medium">{os}</span>
        {version && <Badge variant="secondary" className="ml-auto text-[10px]">v{version}</Badge>}
      </div>
      <div className="text-xs text-muted-foreground">{arch}</div>
      {filename && (
        <div className="text-[11px] text-muted-foreground mt-1 font-mono break-all">{filename}</div>
      )}
      <div className="text-xs text-primary mt-2 inline-flex items-center gap-1"><Download className="h-3 w-3" /> Baixar</div>
    </a>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">{n}</div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

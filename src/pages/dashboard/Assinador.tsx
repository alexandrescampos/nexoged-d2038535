import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Download, Shield, CheckCircle2, XCircle, Loader2, MonitorSmartphone, Apple, Terminal } from "lucide-react";
import { toast } from "sonner";
const RELEASE_BASE = "https://github.com/alexandrescampos/nexoged-d2038535/releases/latest/download";
const WIN_URL = `${RELEASE_BASE}/NexoGED-Assinador-win32-x64.zip`;
const MAC_URL = `${RELEASE_BASE}/NexoGED-Assinador-darwin-x64.zip`;
const LINUX_URL = `${RELEASE_BASE}/NexoGED-Assinador-linux-x64.zip`;
import {
  initPki,
  listCertificates,
  getPairToken,
  setPairToken,
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
      } catch (e: any) {
        if (String(e?.message || "").includes("bridge-unpaired")) {
          setStatus("unpaired");
        } else {
          setStatus("error");
          setErrMsg(describeBridgeError(e));
        }
      }
    } catch (e: any) {
      if (String(e?.message || "").includes("bridge-not-running")) {
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
    setPairToken(t);
    await check();
    if (status === "ok") toast.success("Pareado com sucesso");
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
                <XCircle className="h-4 w-4" /> Assinador não está em execução (ou o navegador não consegue alcançar 127.0.0.1). Baixe/abra o app abaixo.
              </AlertDescription>
            </Alert>
          )}
          {status === "error" && (
            <Alert variant="destructive">
              <AlertDescription>{errMsg || "Erro desconhecido."}</AlertDescription>
            </Alert>
          )}

          {/* Campo de pareamento sempre visível para permitir colar o código a qualquer momento */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Código de pareamento (6 dígitos)</p>
            <p className="text-xs text-muted-foreground">
              Pegue o código na janela inicial do app desktop ou no menu da bandeja do sistema (botão direito no ícone).
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
          </div>
        </CardContent>
      </Card>

      {/* Downloads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Baixar instalador</CardTitle>
          <CardDescription>Escolha o sistema operacional. Os instaladores estarão disponíveis após o empacotamento.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DownloadCard
            icon={<MonitorSmartphone className="h-5 w-5" />}
            os="Windows"
            arch="10 / 11 · x64"
            href={WIN_URL}
          />
          <DownloadCard
            icon={<Apple className="h-5 w-5" />}
            os="macOS"
            arch="11+ · Intel/Apple Silicon"
            href={MAC_URL}
          />
          <DownloadCard
            icon={<Terminal className="h-5 w-5" />}
            os="Linux"
            arch="x64 · zip"
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

function DownloadCard({ icon, os, arch, href, disabled }: { icon: React.ReactNode; os: string; arch: string; href: string; disabled?: boolean }) {
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
      download
    >
      <div className="flex items-center gap-2 mb-1">{icon}<span className="font-medium">{os}</span></div>
      <div className="text-xs text-muted-foreground">{arch}</div>
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

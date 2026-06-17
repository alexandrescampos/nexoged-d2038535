import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, KeyRound, FileBadge2, Loader2, ExternalLink, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import type { TipoAssinatura } from "@/repository/policyFlowRepository";
import {
  initPki,
  listCertificates,
  readCertificate,
  signHash,
  sha256Hex,
  resetPki,
  getPairToken,
  setPairToken,
  describeBridgeError,
  SIGNER_INSTALL_URL,
  type PkiCertificate,
} from "@/lib/signerBridge";
import { documentVersionRepository } from "@/repository/documentVersionRepository";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoAssinatura;
  onConfirm: (payload: { hashEvidencia: string; certificado?: any }) => void;
  isSigning: boolean;
  documentId?: string;
  versaoId?: string | null;
}

const sha256Text = async (input: string) => {
  const buf = new TextEncoder().encode(input);
  return sha256Hex(buf.buffer as ArrayBuffer);
};

export function SignatureCaptureModal({
  open,
  onOpenChange,
  tipo,
  onConfirm,
  isSigning,
  documentId,
  versaoId,
}: Props) {
  const [password, setPassword] = useState("");
  const [govbrToken, setGovbrToken] = useState("");
  const [intent, setIntent] = useState("");

  // Lacuna state
  const useToken = tipo === "QUALIFICADA" || tipo === "AVANCADA";
  const [pkiStatus, setPkiStatus] = useState<"idle" | "loading" | "ready" | "not-installed" | "error">("idle");
  const [pkiError, setPkiError] = useState<string | null>(null);
  const [certs, setCerts] = useState<PkiCertificate[]>([]);
  const [selectedThumb, setSelectedThumb] = useState<string>("");
  const [loadingCerts, setLoadingCerts] = useState(false);

  const reset = () => {
    setPassword("");
    setGovbrToken("");
    setIntent("");
    setSelectedThumb("");
    setCerts([]);
    setPkiError(null);
  };

  const loadPki = async () => {
    setPkiStatus("loading");
    setPkiError(null);
    try {
      await initPki();
      setPkiStatus("ready");
      await refreshCerts();
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.startsWith("web-pki-not-installed")) {
        setPkiStatus("not-installed");
      } else {
        setPkiStatus("error");
        setPkiError(msg);
      }
    }
  };

  const refreshCerts = async () => {
    setLoadingCerts(true);
    try {
      const list = await listCertificates();
      // Apenas válidos hoje
      const today = new Date();
      const valid = list.filter((c: any) => {
        const end = c.validityEnd ? new Date(c.validityEnd) : null;
        return !end || end > today;
      });
      setCerts(valid);
      if (valid.length === 1) setSelectedThumb(valid[0].thumbprint);
    } catch (e: any) {
      toast.error("Falha ao listar certificados: " + (e?.message || e));
    } finally {
      setLoadingCerts(false);
    }
  };

  useEffect(() => {
    if (open && useToken && pkiStatus === "idle") {
      loadPki();
    }
    if (!open) {
      resetPki();
      setPkiStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, useToken]);

  const handleSubmitSimple = async () => {
    if ((tipo === "SIMPLES" || tipo === "NENHUMA") && !password) return;
    if (tipo === "AVANCADA" && !govbrToken && pkiStatus !== "ready") return;
    const src =
      tipo === "AVANCADA"
        ? `avancada:${govbrToken}:${Date.now()}`
        : `simples:${password}:${Date.now()}`;
    const hash = await sha256Text(src + "|" + intent);
    onConfirm({ hashEvidencia: hash, certificado: undefined });
    reset();
  };

  const handleSubmitToken = async () => {
    if (!selectedThumb) {
      toast.error("Selecione um certificado");
      return;
    }
    if (!documentId) {
      toast.error("Documento sem versão para assinar");
      return;
    }
    try {
      console.log("[Sign] start", { documentId, versaoId, selectedThumb });
      // 1. Buscar file_path da versão (fallback: última versão do documento)
      let query = supabase
        .from("ged_document_versions")
        .select("id, file_path, file_name")
        .eq("document_id", documentId);
      if (versaoId) {
        query = query.eq("id", versaoId);
      } else {
        query = query
          .neq("status", "CANCELADA")
          .order("version_number", { ascending: false })
          .limit(1);
      }
      const { data: versao, error: vErr } = await query.maybeSingle();
      console.log("[Sign] versao", { versao, vErr });
      if (vErr) throw new Error("Versão: " + vErr.message);
      if (!versao) throw new Error("Nenhuma versão ativa encontrada para o documento");

      // 2. Download do arquivo
      const url = await documentVersionRepository.getDownloadUrl(versao.file_path);
      console.log("[Sign] signed url ok");
      const fileRes = await fetch(url);
      if (!fileRes.ok) throw new Error("Falha download HTTP " + fileRes.status);
      const buffer = await fileRes.arrayBuffer();
      console.log("[Sign] file bytes", buffer.byteLength);

      // 3. SHA-256 do conteúdo
      const docHash = await sha256Hex(buffer);
      console.log("[Sign] hash", docHash);

      // 4. Ler certificado + assinar hash via token
      const cert = certs.find((c) => c.thumbprint === selectedThumb)!;
      const certBase64 = await readCertificate(selectedThumb);
      console.log("[Sign] cert read ok, length", certBase64?.length);
      const signatureB64 = await signHash(selectedThumb, docHash);
      console.log("[Sign] signature ok, length", signatureB64?.length);

      // 5. Payload de evidência
      const certificado = {
        tipo: tipo === "QUALIFICADA" ? "ICP-Brasil A1/A3" : "ICP-Brasil",
        subjectName: cert.subjectName,
        issuerName: cert.issuerName,
        email: cert.email,
        validityStart: cert.validityStart,
        validityEnd: cert.validityEnd,
        thumbprint: cert.thumbprint,
        serialNumber: (cert as any).serialNumber,
        pkiBrazil: cert.pkiBrazil,
        certificateBase64: certBase64,
        signature: signatureB64,
        signatureAlgorithm: "SHA256withRSA",
        documentHash: docHash,
        documentHashAlgorithm: "SHA-256",
        intent,
        signedAt: new Date().toISOString(),
      };

      onConfirm({ hashEvidencia: docHash, certificado });
      reset();
    } catch (e: any) {
      console.error("[Sign] error", e);
      toast.error("Erro ao assinar: " + (e?.message || JSON.stringify(e)));
    }
  };

  const icon =
    tipo === "QUALIFICADA" ? <FileBadge2 className="h-5 w-5" /> :
    tipo === "AVANCADA" ? <Shield className="h-5 w-5" /> :
    <KeyRound className="h-5 w-5" />;

  const showToken = useToken;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{icon} Assinar Documento</DialogTitle>
          <DialogDescription>
            Tipo exigido pela política: <strong>{tipo}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {(tipo === "SIMPLES" || tipo === "NENHUMA") && (
            <div className="space-y-2">
              <Label>Confirme sua senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha atual" />
              <p className="text-xs text-muted-foreground">Assinatura simples: confirmação por senha do usuário.</p>
            </div>
          )}

          {showToken && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <FileBadge2 className="h-4 w-4" /> Certificado ICP-Brasil (Token A3 ou A1)
              </Label>

              {pkiStatus === "loading" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Detectando Web PKI...
                </div>
              )}

              {pkiStatus === "not-installed" && (
                <Alert>
                  <AlertDescription className="text-xs space-y-2">
                    <p>O componente <strong>Web PKI</strong> não foi detectado no navegador.</p>
                    <p>Instale a extensão e o componente nativo para acessar seu certificado/token:</p>
                    <a
                      href={WEB_PKI_INSTALL_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline"
                    >
                      Instalar Web PKI <ExternalLink className="h-3 w-3" />
                    </a>
                    <div>
                      <Button size="sm" variant="outline" onClick={loadPki} className="mt-2">
                        Já instalei, tentar novamente
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {pkiStatus === "error" && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">
                    Erro ao iniciar Web PKI: {pkiError}
                    <Button size="sm" variant="outline" onClick={loadPki} className="mt-2 ml-2">
                      Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {pkiStatus === "ready" && (
                <>
                  <div className="flex items-center gap-2">
                    <Select value={selectedThumb} onValueChange={setSelectedThumb}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={certs.length === 0 ? "Nenhum certificado encontrado" : "Selecione o certificado"} />
                      </SelectTrigger>
                      <SelectContent>
                        {certs.map((c) => (
                          <SelectItem key={c.thumbprint} value={c.thumbprint}>
                            <div className="flex flex-col">
                              <span className="text-sm">{c.subjectName}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {c.issuerName} · até {c.validityEnd ? new Date(c.validityEnd).toLocaleDateString("pt-BR") : "—"}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="outline" onClick={refreshCerts} disabled={loadingCerts} title="Atualizar lista">
                      <RefreshCw className={`h-4 w-4 ${loadingCerts ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  {certs.length === 0 && !loadingCerts && (
                    <p className="text-xs text-muted-foreground">
                      Conecte o token/leitor e atualize. Para A1, verifique se o certificado está importado no repositório do sistema.
                    </p>
                  )}
                </>
              )}

              {tipo === "AVANCADA" && pkiStatus !== "ready" && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs">Alternativa: Código Gov.br / OTP</Label>
                  <Input value={govbrToken} onChange={(e) => setGovbrToken(e.target.value)} placeholder="Token recebido" />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Intenção da assinatura (opcional)</Label>
            <Textarea value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="Ex.: Aprovo o conteúdo deste documento." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {showToken && pkiStatus === "ready" && certs.length > 0 ? (
            <Button onClick={handleSubmitToken} disabled={isSigning || !selectedThumb}>
              {isSigning ? "Assinando..." : "Assinar com Token"}
            </Button>
          ) : (
            <Button
              onClick={handleSubmitSimple}
              disabled={
                isSigning ||
                ((tipo === "SIMPLES" || tipo === "NENHUMA") && !password) ||
                (tipo === "AVANCADA" && !govbrToken) ||
                tipo === "QUALIFICADA"
              }
            >
              {isSigning ? "Assinando..." : "Confirmar Assinatura"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

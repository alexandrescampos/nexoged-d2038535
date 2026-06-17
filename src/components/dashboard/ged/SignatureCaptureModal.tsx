import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, KeyRound, FileBadge2 } from "lucide-react";
import type { TipoAssinatura } from "@/repository/policyFlowRepository";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoAssinatura;
  onConfirm: (payload: { hashEvidencia: string; certificado?: any }) => void;
  isSigning: boolean;
}

const sha256 = async (input: string) => {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export function SignatureCaptureModal({ open, onOpenChange, tipo, onConfirm, isSigning }: Props) {
  const [password, setPassword] = useState("");
  const [govbrToken, setGovbrToken] = useState("");
  const [certInfo, setCertInfo] = useState("");
  const [intent, setIntent] = useState("");

  const reset = () => {
    setPassword("");
    setGovbrToken("");
    setCertInfo("");
    setIntent("");
  };

  const handleSubmit = async () => {
    let evidenceSource = "";
    let cert: any = undefined;

    if (tipo === "SIMPLES" || tipo === "NENHUMA") {
      if (!password) return;
      evidenceSource = `simples:${password}:${Date.now()}`;
    } else if (tipo === "AVANCADA") {
      if (!govbrToken) return;
      evidenceSource = `avancada:${govbrToken}:${Date.now()}`;
    } else if (tipo === "QUALIFICADA") {
      if (!certInfo) return;
      evidenceSource = `qualificada:${certInfo}:${Date.now()}`;
      cert = { tipo: "ICP-Brasil", info: certInfo, intent };
    }

    const hash = await sha256(evidenceSource + "|" + intent);
    onConfirm({ hashEvidencia: hash, certificado: cert });
    reset();
  };

  const icon =
    tipo === "QUALIFICADA" ? <FileBadge2 className="h-5 w-5" /> :
    tipo === "AVANCADA" ? <Shield className="h-5 w-5" /> :
    <KeyRound className="h-5 w-5" />;

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

          {tipo === "AVANCADA" && (
            <div className="space-y-2">
              <Label>Código Gov.br / OTP</Label>
              <Input value={govbrToken} onChange={(e) => setGovbrToken(e.target.value)} placeholder="Token recebido" />
              <Alert>
                <AlertDescription className="text-xs">
                  Assinatura avançada: requer segundo fator (Gov.br, MFA ou OTP).
                </AlertDescription>
              </Alert>
            </div>
          )}

          {tipo === "QUALIFICADA" && (
            <div className="space-y-2">
              <Label>Identificador do Certificado ICP-Brasil (A1/A3)</Label>
              <Input value={certInfo} onChange={(e) => setCertInfo(e.target.value)} placeholder="CN do certificado" />
              <Alert>
                <AlertDescription className="text-xs">
                  Assinatura qualificada: requer certificado ICP-Brasil. Integração completa com leitor de token será habilitada futuramente.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="space-y-2">
            <Label>Intenção da assinatura (opcional)</Label>
            <Textarea value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="Ex.: Aprovo o conteúdo deste documento." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSigning}>
            {isSigning ? "Assinando..." : "Confirmar Assinatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

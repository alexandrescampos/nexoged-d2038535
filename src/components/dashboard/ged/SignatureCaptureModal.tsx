import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { FileBadge2, Loader2, PenLine, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatBrasiliaDateTime } from "@/lib/timezone";
import { useDigitalCertificates, daysUntil } from "@/hooks/useDigitalCertificates";
import { certificateRepository, describeSignError } from "@/repository/certificateRepository";
import type { TipoAssinatura } from "@/repository/policyFlowRepository";

export interface SignatureCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Documento a ser assinado */
  documentId?: string;
  /** Etapa do fluxo de assinatura, quando houver */
  assinaturaId?: string;
  tipo?: TipoAssinatura;
  /** Chamado após a assinatura ser concluída com sucesso */
  onSigned?: () => void;
}

export function SignatureCaptureModal({
  open,
  onOpenChange,
  documentId,
  assinaturaId,
  tipo,
  onSigned,
}: SignatureCaptureModalProps) {
  const { certificates, isLoading } = useDigitalCertificates();
  const [selectedId, setSelectedId] = useState("");
  const [intent, setIntent] = useState("");
  const [isSigning, setIsSigning] = useState(false);

  const usable = useMemo(
    () => certificates.filter((c) => daysUntil(c.valido_ate) >= 0),
    [certificates],
  );

  useEffect(() => {
    if (!open) {
      setIntent("");
      setSelectedId("");
      return;
    }
    if (usable.length === 1) setSelectedId(usable[0].id);
  }, [open, usable]);

  const handleSign = async () => {
    if (!documentId || !selectedId) return;
    setIsSigning(true);
    try {
      const results = await certificateRepository.signDocuments({
        certificateId: selectedId,
        documentIds: [documentId],
        intent: intent.trim() || undefined,
        assinaturaId,
        tipo,
      });
      const failure = results.find((r) => !r.ok);
      if (failure) throw new Error(describeSignError(failure.error));
      toast.success("Documento assinado digitalmente");
      onSigned?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao assinar o documento");
    } finally {
      setIsSigning(false);
    }
  };

  const expiredOnly = certificates.length > 0 && usable.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" /> Assinar digitalmente
          </DialogTitle>
          <DialogDescription>
            A assinatura é aplicada no servidor com o seu certificado A1 (ICP-Brasil).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando certificados...
          </div>
        ) : usable.length === 0 ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p>
                {expiredOnly
                  ? "Seu certificado está vencido."
                  : "Nenhum certificado digital cadastrado para o seu usuário."}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/certificados">Cadastrar certificado</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Certificado</Label>
              <RadioGroup value={selectedId} onValueChange={setSelectedId} className="space-y-2">
                {usable.map((cert) => (
                  <label
                    key={cert.id}
                    htmlFor={`cert-${cert.id}`}
                    className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors"
                  >
                    <RadioGroupItem value={cert.id} id={`cert-${cert.id}`} className="mt-1" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileBadge2 className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{cert.titular_nome}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {cert.owner_type === "USUARIO" ? "e-CPF" : "e-CNPJ"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Válido até {formatBrasiliaDateTime(cert.valido_ate)}
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sign-intent">Finalidade da assinatura (opcional)</Label>
              <Textarea
                id="sign-intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="Ex.: Aprovação do contrato de prestação de serviços"
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSigning}>
            Cancelar
          </Button>
          <Button onClick={handleSign} disabled={!selectedId || isSigning || usable.length === 0}>
            {isSigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PenLine className="h-4 w-4 mr-2" />}
            Assinar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

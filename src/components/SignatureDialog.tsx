import { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, PenLine, ShieldCheck } from "lucide-react";
import SignaturePad, { type SignaturePadRef } from "./SignaturePad";
import { toast } from "@/hooks/use-toast";
import { captureGeolocation, type CapturedGeo } from "@/lib/geo";

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  employeeName: string;
  summary?: React.ReactNode;
  /**
   * Recebe a assinatura e as evidências capturadas no navegador.
   * O servidor complementará com IP, user-agent e carimbo de tempo.
   */
  onConfirm: (signatureDataUrl: string, geo: CapturedGeo) => Promise<void>;
}

export default function SignatureDialog({
  open,
  onOpenChange,
  title = "Assinatura Digital",
  employeeName,
  summary,
  onConfirm,
}: SignatureDialogProps) {
  const padRef = useRef<SignaturePadRef>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  // Geo pré-capturada assim que o diálogo abre (paraleliza com o tempo do usuário assinando)
  const geoPromiseRef = useRef<Promise<CapturedGeo> | null>(null);

  useEffect(() => {
    if (open) {
      geoPromiseRef.current = captureGeolocation();
    } else {
      geoPromiseRef.current = null;
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast({ title: "Assinatura obrigatória", description: "Por favor, assine antes de confirmar.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const dataUrl = padRef.current.toDataURL();
      const geo = await (geoPromiseRef.current ?? captureGeolocation());
      await onConfirm(dataUrl, geo);
      onOpenChange(false);
    } catch {
      // error handled by caller
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {summary && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              {summary}
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-2">
              <strong>{employeeName}</strong>, assine no campo abaixo:
            </p>
            <SignaturePad ref={padRef} height={180} onChange={setHasSignature} />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <p>
              Ao confirmar, serão registrados como prova de autenticidade: data e hora oficiais do servidor,
              endereço IP, navegador (user-agent), localização aproximada (GPS se autorizado, ou via IP) e
              um hash criptográfico SHA-256. O termo é gravado de forma imutável.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || !hasSignature}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PenLine className="mr-2 h-4 w-4" />
            )}
            Confirmar Assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

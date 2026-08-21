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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, FileBadge2, Loader2, PenLine, ShieldAlert, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatBrasiliaDateTime } from "@/lib/timezone";
import { useDigitalCertificates, daysUntil } from "@/hooks/useDigitalCertificates";
import { certificateRepository, describeSignError } from "@/repository/certificateRepository";

export interface BulkSignDoc {
  id: string;
  title: string;
  mime_type?: string | null;
  file_name?: string | null;
}

type ItemStatus = "pending" | "done" | "error";

interface BulkItem extends BulkSignDoc {
  status: ItemStatus;
  message?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: BulkSignDoc[];
  onFinished?: () => void;
}

const BATCH_SIZE = 10;

export function BulkSignDialog({ open, onOpenChange, documents, onFinished }: Props) {
  const pdfs = useMemo(
    () =>
      documents.filter((d) => {
        const mime = (d.mime_type || "").toLowerCase();
        const name = (d.file_name || d.title || "").toLowerCase();
        return mime.includes("pdf") || name.endsWith(".pdf");
      }),
    [documents],
  );

  const { certificates, isLoading } = useDigitalCertificates();
  const usable = useMemo(() => certificates.filter((c) => daysUntil(c.valido_ate) >= 0), [certificates]);

  const [selectedId, setSelectedId] = useState("");
  const [intent, setIntent] = useState("");
  const [items, setItems] = useState<BulkItem[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems(pdfs.map((d) => ({ ...d, status: "pending" as ItemStatus })));
    setFinished(false);
    setRunning(false);
    setIntent("");
    if (usable.length === 1) setSelectedId(usable[0].id);
  }, [open, pdfs, usable]);

  const processed = items.filter((i) => i.status !== "pending").length;
  const succeeded = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "error").length;
  const progress = items.length ? Math.round((processed / items.length) * 100) : 0;

  const handleStart = async () => {
    if (!selectedId || items.length === 0) return;
    setRunning(true);
    try {
      // Processa em lotes para respeitar o limite da função e dar feedback incremental
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const results = await certificateRepository.signDocuments({
          certificateId: selectedId,
          documentIds: batch.map((b) => b.id),
          intent: intent.trim() || undefined,
        });
        setItems((prev) =>
          prev.map((item) => {
            const result = results.find((r) => r.documentId === item.id);
            if (!result) return item;
            return result.ok
              ? { ...item, status: "done" }
              : { ...item, status: "error", message: describeSignError(result.error) };
          }),
        );
      }
      setFinished(true);
      onFinished?.();
    } catch (e) {
      toast.error((e as Error).message || "Falha ao assinar os documentos");
    } finally {
      setRunning(false);
    }
  };

  const noCertificate = !isLoading && usable.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) onOpenChange(o); }}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" /> Assinatura digital em massa
          </DialogTitle>
          <DialogDescription>
            {pdfs.length} documento(s) PDF selecionado(s). A assinatura é aplicada no servidor com o seu
            certificado A1.
          </DialogDescription>
        </DialogHeader>

        {documents.length !== pdfs.length && (
          <Alert>
            <AlertDescription>
              {documents.length - pdfs.length} arquivo(s) não são PDF e foram ignorados.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando certificados...
          </div>
        ) : noCertificate ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p>Nenhum certificado digital válido cadastrado.</p>
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
                    htmlFor={`bulk-cert-${cert.id}`}
                    className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors"
                  >
                    <RadioGroupItem value={cert.id} id={`bulk-cert-${cert.id}`} className="mt-1" disabled={running} />
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
              <Label htmlFor="bulk-intent">Finalidade da assinatura (opcional)</Label>
              <Textarea
                id="bulk-intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                rows={2}
                maxLength={500}
                disabled={running}
              />
            </div>

            {(running || finished) && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  {processed}/{items.length} processado(s) · {succeeded} assinado(s) · {failed} com erro
                </p>
              </div>
            )}

            <ScrollArea className="max-h-56 rounded-md border">
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                    {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />}
                    {item.status === "error" && <XCircle className="h-4 w-4 text-destructive mt-0.5" />}
                    {item.status === "pending" && (
                      <span className="h-4 w-4 rounded-full border mt-0.5" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="truncate">{item.title}</p>
                      {item.message && <p className="text-xs text-destructive">{item.message}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            {finished ? "Fechar" : "Cancelar"}
          </Button>
          <Button onClick={handleStart} disabled={running || finished || noCertificate || !selectedId}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PenLine className="h-4 w-4 mr-2" />}
            Assinar {items.length} documento(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

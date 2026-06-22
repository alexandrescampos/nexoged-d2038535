import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, ShieldAlert, ExternalLink, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  initPki, listCertificates, readCertificate, signHash, sha256Hex,
  describeBridgeError, type PkiCertificate,
} from "@/lib/signerBridge";
import { supabase } from "@/integrations/supabase/client";
import { documentVersionRepository } from "@/repository/documentVersionRepository";

export interface BulkSignDoc {
  id: string;
  title: string;
  mime_type?: string | null;
  file_name?: string | null;
}

type ItemStatus = "pending" | "signing" | "done" | "error" | "skipped";
interface BulkItem extends BulkSignDoc {
  status: ItemStatus;
  message?: string;
}

type PkiStatus = "checking" | "ready" | "unpaired" | "missing" | "error";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: BulkSignDoc[];
  onFinished?: () => void;
}

export function BulkSignDialog({ open, onOpenChange, documents, onFinished }: Props) {
  const pdfs = documents.filter((d) => {
    const m = (d.mime_type || "").toLowerCase();
    const n = (d.file_name || d.title || "").toLowerCase();
    return m.includes("pdf") || n.endsWith(".pdf");
  });

  const [pkiStatus, setPkiStatus] = useState<PkiStatus>("checking");
  const [pkiErr, setPkiErr] = useState("");
  const [certs, setCerts] = useState<PkiCertificate[]>([]);
  const [selectedThumb, setSelectedThumb] = useState<string>("");
  const [intent, setIntent] = useState("");
  const [items, setItems] = useState<BulkItem[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setItems(pdfs.map((d) => ({ ...d, status: "pending" })));
    setFinished(false);
    setRunning(false);
    cancelRef.current = false;
    loadPki();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadPki = async () => {
    setPkiStatus("checking");
    setPkiErr("");
    try {
      await initPki();
      try {
        const list = await listCertificates();
        const today = new Date();
        const valid = list.filter((c) => !c.validityEnd || new Date(c.validityEnd) > today);
        setCerts(valid);
        if (valid.length === 1) setSelectedThumb(valid[0].thumbprint);
        setPkiStatus("ready");
      } catch (e: any) {
        if (String(e?.message || "").includes("bridge-unpaired")) setPkiStatus("unpaired");
        else { setPkiStatus("error"); setPkiErr(describeBridgeError(e)); }
      }
    } catch (e: any) {
      if (String(e?.message || "").includes("bridge-not-running")) setPkiStatus("missing");
      else { setPkiStatus("error"); setPkiErr(describeBridgeError(e)); }
    }
  };

  const updateItem = (id: string, patch: Partial<BulkItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const signOne = async (doc: BulkItem, cert: PkiCertificate, certBase64: string) => {
    // 1. última versão
    const { data: versao, error: vErr } = await supabase
      .from("ged_document_versions")
      .select("id, file_path, file_name, mime_type")
      .eq("document_id", doc.id)
      .neq("status", "CANCELADA")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vErr) throw new Error("Versão: " + vErr.message);
    if (!versao) throw new Error("Sem versão ativa");
    const mime = (versao.mime_type || "").toLowerCase();
    const fname = (versao.file_name || "").toLowerCase();
    if (!mime.includes("pdf") && !fname.endsWith(".pdf")) throw new Error("Não é PDF");

    // 2. download + hash
    const url = await documentVersionRepository.getDownloadUrl(versao.file_path);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download HTTP " + res.status);
    const buf = await res.arrayBuffer();
    const docHash = await sha256Hex(buf);

    // 3. assinar via bridge
    const signatureB64 = await signHash(cert.thumbprint, docHash);

    // 4. RPC
    const certificado = {
      tipo: "ICP-Brasil A1/A3",
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
      intent: intent || null,
      signedAt: new Date().toISOString(),
      bulk: true,
    };
    const { error } = await supabase.rpc("sign_document_adhoc", {
      p_documento_id: doc.id,
      p_versao_id: versao.id,
      p_hash: docHash,
      p_certificado: certificado as any,
      p_intent: intent || null,
    });
    if (error) throw new Error(error.message);
  };

  const handleStart = async () => {
    if (!selectedThumb) { toast.error("Selecione um certificado"); return; }
    const cert = certs.find((c) => c.thumbprint === selectedThumb);
    if (!cert) return;
    setRunning(true);
    cancelRef.current = false;
    let certBase64 = "";
    try {
      certBase64 = await readCertificate(selectedThumb);
    } catch (e: any) {
      toast.error("Falha ao ler certificado: " + describeBridgeError(e));
      setRunning(false);
      return;
    }
    for (const it of items) {
      if (cancelRef.current) {
        setItems((prev) => prev.map((x) => (x.status === "pending" ? { ...x, status: "skipped", message: "Cancelado" } : x)));
        break;
      }
      if (it.status !== "pending") continue;
      updateItem(it.id, { status: "signing" });
      try {
        await signOne(it, cert, certBase64);
        updateItem(it.id, { status: "done" });
      } catch (e: any) {
        updateItem(it.id, { status: "error", message: e?.message || String(e) });
      }
    }
    setRunning(false);
    setFinished(true);
    onFinished?.();
  };

  const handleCancel = () => { cancelRef.current = true; };

  const handleDownloadReport = () => {
    const rows = [
      ["Documento", "Status", "Mensagem"],
      ...items.map((i) => [i.title, i.status, i.message || ""]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `assinatura-lote-${Date.now()}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const total = items.length;
  const completed = items.filter((i) => i.status === "done" || i.status === "error" || i.status === "skipped").length;
  const okCount = items.filter((i) => i.status === "done").length;
  const errCount = items.filter((i) => i.status === "error").length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[720px] max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" /> Assinar PDFs em lote
          </DialogTitle>
          <DialogDescription>
            {pdfs.length} PDF(s) selecionado(s){documents.length !== pdfs.length && ` · ${documents.length - pdfs.length} ignorado(s) (não-PDF)`}.
          </DialogDescription>
        </DialogHeader>

        {pdfs.length === 0 && (
          <Alert variant="destructive">
            <AlertDescription>Nenhum PDF entre os documentos selecionados.</AlertDescription>
          </Alert>
        )}

        {pdfs.length > 0 && (
          <div className="space-y-4">
            {/* Status do assinador */}
            {pkiStatus === "checking" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Verificando assinador...
              </div>
            )}
            {(pkiStatus === "missing" || pkiStatus === "unpaired" || pkiStatus === "error") && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p>
                    {pkiStatus === "missing" && "Assinador desktop não localizado."}
                    {pkiStatus === "unpaired" && "Assinador detectado, mas este navegador ainda não foi pareado."}
                    {pkiStatus === "error" && (pkiErr || "Erro de comunicação com o assinador.")}
                  </p>
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <Link to="/dashboard/assinador" target="_blank">
                      Configurar assinador <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {pkiStatus === "ready" && !finished && (
              <>
                <div className="grid gap-2">
                  <Label>Certificado</Label>
                  <Select value={selectedThumb} onValueChange={setSelectedThumb} disabled={running}>
                    <SelectTrigger><SelectValue placeholder="Selecione o certificado" /></SelectTrigger>
                    <SelectContent>
                      {certs.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum certificado válido</div>}
                      {certs.map((c) => (
                        <SelectItem key={c.thumbprint} value={c.thumbprint}>
                          {c.subjectName}{c.validityEnd ? ` · até ${new Date(c.validityEnd).toLocaleDateString("pt-BR")}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Intenção / justificativa (opcional)</Label>
                  <Input
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    placeholder="Ex.: Aprovação de procedimentos do mês"
                    disabled={running}
                  />
                </div>

                <Alert>
                  <AlertDescription className="text-xs">
                    Cada PDF exigirá uma confirmação no app desktop (e PIN, no caso de token A3).
                    O processo é sequencial e pode levar alguns minutos.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {/* Lista + progresso */}
            {(running || finished) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{completed} de {total} processados</span>
                  <span className="text-muted-foreground">{okCount} ok · {errCount} erro</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <ScrollArea className="max-h-[280px] border rounded-md">
              <div className="divide-y">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="flex-1 truncate">{it.title}</span>
                    {it.status === "pending" && <span className="text-xs text-muted-foreground">aguardando</span>}
                    {it.status === "signing" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {it.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {it.status === "error" && (
                      <span className="flex items-center gap-1 text-xs text-destructive max-w-[260px] truncate" title={it.message}>
                        <XCircle className="h-4 w-4" /> {it.message}
                      </span>
                    )}
                    {it.status === "skipped" && <span className="text-xs text-muted-foreground">cancelado</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2">
          {finished ? (
            <>
              <Button variant="outline" onClick={handleDownloadReport}>Baixar relatório CSV</Button>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </>
          ) : running ? (
            <Button variant="destructive" onClick={handleCancel}>Cancelar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                onClick={handleStart}
                disabled={pkiStatus !== "ready" || !selectedThumb || pdfs.length === 0}
              >
                Assinar {pdfs.length} documento(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useDocumentWorkflow } from "@/hooks/useDocumentWorkflow";
import { SignatureCaptureModal } from "./SignatureCaptureModal";
import { CheckCircle2, XCircle, Clock, Send, Archive, PenLine, FileText } from "lucide-react";
import { formatBrasiliaDateTime } from "@/lib/timezone";
import type { DocumentoAssinatura } from "@/repository/policyExecutionRepository";

interface Props {
  doc: any | null;
  onOpenChange: (open: boolean) => void;
}

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    PENDENTE: { label: "Pendente", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    APROVADA: { label: "Aprovada", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    REPROVADA: { label: "Reprovada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
    ASSINADA: { label: "Assinada", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    RECUSADA: { label: "Recusada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
  };
  const m = map[status] || { label: status, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};

const docStatusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    RASCUNHO: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
    EM_REVISAO: { label: "Em revisão", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    AGUARDANDO_APROVACAO: { label: "Aguardando aprovação", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    AGUARDANDO_ASSINATURA: { label: "Aguardando assinatura", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
    APROVADO: { label: "Aprovado", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    ASSINADO: { label: "Assinado", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    ARQUIVADO: { label: "Arquivado", cls: "bg-slate-500/10 text-slate-700 border-slate-500/30" },
  };
  const m = map[status] || { label: status, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};

export function DocumentDetailDialog({ doc, onOpenChange }: Props) {
  const open = !!doc;
  const { approvals, signatures, isLoading, submit, approve, reject, sign, archive, canApprove, canSign } =
    useDocumentWorkflow(doc?.id || null);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [approveComment, setApproveComment] = useState<Record<string, string>>({});
  const [signing, setSigning] = useState<DocumentoAssinatura | null>(null);

  if (!doc) return null;

  // Próxima etapa pendente (em ordem)
  const nextApprovalIdx = approvals.findIndex((a) => a.status === "PENDENTE");
  const nextSignatureIdx = signatures.findIndex((s) => s.status === "PENDENTE");
  const allApproved = approvals.length > 0 && approvals.every((a) => a.status === "APROVADA");
  const allSigned = signatures.length > 0 && signatures.every((s) => s.status === "ASSINADA");
  const hasPendingApprovals = approvals.some((a) => a.status === "PENDENTE");

  const canSubmit = doc.status === "RASCUNHO" || doc.status === "EM_REVISAO";
  const canArchive = doc.status === "ASSINADO" || doc.status === "APROVADO";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> {doc.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 pt-1">
              {docStatusBadge(doc.status)}
              {doc.document_type_data?.name && (
                <span className="text-xs text-muted-foreground">{doc.document_type_data.name}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="approvals">Aprovações {approvals.length > 0 && <Badge variant="secondary" className="ml-2">{approvals.length}</Badge>}</TabsTrigger>
              <TabsTrigger value="signatures">Assinaturas {signatures.length > 0 && <Badge variant="secondary" className="ml-2">{signatures.length}</Badge>}</TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Tipo" value={doc.document_type_data?.name || doc.document_type || "—"} />
                <Info label="Sigilo" value={doc.sigilo || "—"} />
                <Info label="Criado em" value={doc.created_at ? formatBrasiliaDateTime(doc.created_at) : "—"} />
                <Info label="Atualizado em" value={doc.updated_at ? formatBrasiliaDateTime(doc.updated_at) : "—"} />
                <Info label="Páginas" value={String(doc.page_count ?? "—")} />
                <Info label="Versões" value={String(doc.versions_count ?? "—")} />
              </div>

              {doc.description && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Descrição</div>
                  <p className="text-sm">{doc.description}</p>
                </div>
              )}

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!canSubmit || submit.isPending}
                  onClick={() => submit.mutate()}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" /> Submeter para aprovação
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canArchive || archive.isPending}
                  onClick={() => archive.mutate()}
                  className="gap-2"
                >
                  <Archive className="h-4 w-4" /> Arquivar
                </Button>
              </div>

              {approvals.length === 0 && signatures.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground">
                  Este documento ainda não possui fluxo aplicado. Submeter aplicará automaticamente a política do tipo configurado.
                </p>
              )}
            </TabsContent>

            {/* APPROVALS */}
            <TabsContent value="approvals" className="space-y-3 mt-4">
              {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
              {!isLoading && approvals.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma etapa de aprovação configurada.</p>
              )}
              {approvals.map((a, idx) => {
                const isCurrent = idx === nextApprovalIdx;
                const enabled = isCurrent && canApprove(a);
                return (
                  <div key={a.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Etapa {a.ordem}</Badge>
                        <span className="text-sm font-medium">{a.nome_etapa}</span>
                        {statusBadge(a.status)}
                      </div>
                      {a.status === "PENDENTE" && <Clock className="h-4 w-4 text-muted-foreground" />}
                      {a.status === "APROVADA" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {a.status === "REPROVADA" && <XCircle className="h-4 w-4 text-red-600" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Responsável: <strong>{a.perfil_nome || "—"}</strong>
                      {a.aprovador_nome && (
                        <> · Por: {a.aprovador_nome} · {a.decidido_em && formatBrasiliaDateTime(a.decidido_em)}</>
                      )}
                    </div>
                    {a.comentario && <p className="text-xs italic">"{a.comentario}"</p>}

                    {enabled && (
                      <div className="space-y-2 pt-2 border-t">
                        <Textarea
                          placeholder="Comentário (opcional para aprovar, obrigatório para reprovar)"
                          rows={2}
                          value={approveComment[a.id] || ""}
                          onChange={(e) => setApproveComment({ ...approveComment, [a.id]: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approve.mutate({ etapaId: a.id, comentario: approveComment[a.id] })}
                            disabled={approve.isPending}
                            className="gap-1"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setRejectingId(a.id); setRejectComment(approveComment[a.id] || ""); }}
                            className="gap-1"
                          >
                            <XCircle className="h-4 w-4" /> Reprovar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </TabsContent>

            {/* SIGNATURES */}
            <TabsContent value="signatures" className="space-y-3 mt-4">
              {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
              {!isLoading && signatures.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum signatário configurado.</p>
              )}
              {hasPendingApprovals && signatures.length > 0 && (
                <p className="text-xs text-amber-600">As aprovações precisam ser concluídas antes das assinaturas.</p>
              )}
              {signatures.map((s, idx) => {
                const isCurrent = idx === nextSignatureIdx && !hasPendingApprovals;
                const enabled = isCurrent && canSign(s);
                return (
                  <div key={s.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{s.ordem}</Badge>
                        <span className="text-sm font-medium">{s.perfil_nome || "—"}</span>
                        <Badge variant="secondary" className="text-xs">{s.tipo_assinatura}</Badge>
                        {!s.assinatura_obrigatoria && <Badge variant="outline" className="text-xs">Opcional</Badge>}
                        {statusBadge(s.status)}
                      </div>
                      {s.status === "ASSINADA" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    </div>
                    {s.assinante_nome && (
                      <div className="text-xs text-muted-foreground">
                        Por: {s.assinante_nome} · {s.assinado_em && formatBrasiliaDateTime(s.assinado_em)}
                      </div>
                    )}
                    {enabled && (
                      <Button size="sm" onClick={() => setSigning(s)} className="gap-1">
                        <PenLine className="h-4 w-4" /> Assinar
                      </Button>
                    )}
                  </div>
                );
              })}
              {allApproved && allSigned && (
                <p className="text-xs text-emerald-600">Fluxo completo. Documento pode ser arquivado.</p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectingId} onOpenChange={(o) => { if (!o) setRejectingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reprovar etapa</DialogTitle>
            <DialogDescription>Informe o motivo da reprovação.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} rows={3} placeholder="Motivo" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectingId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!rejectComment.trim() || reject.isPending}
              onClick={() => {
                reject.mutate({ etapaId: rejectingId!, comentario: rejectComment.trim() });
                setRejectingId(null);
                setRejectComment("");
              }}
            >
              Confirmar Reprovação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signature modal */}
      {signing && (
        <SignatureCaptureModal
          open={!!signing}
          onOpenChange={(o) => { if (!o) setSigning(null); }}
          tipo={signing.tipo_assinatura}
          isSigning={sign.isPending}
          onConfirm={({ hashEvidencia, certificado }) => {
            sign.mutate(
              { assinaturaId: signing.id, tipo: signing.tipo_assinatura, hashEvidencia, certificado },
              { onSuccess: () => setSigning(null) },
            );
          }}
        />
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  policyExecutionRepository,
  DocumentoAprovacao,
  DocumentoAssinatura,
} from "@/repository/policyExecutionRepository";
import type { TipoAssinatura } from "@/repository/policyFlowRepository";

export function useDocumentWorkflow(documentId: string | null) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const userId = profile?.id;

  const approvals = useQuery({
    queryKey: ["doc-approvals", documentId],
    queryFn: () => policyExecutionRepository.listApprovals(documentId!),
    enabled: !!documentId,
  });

  const signatures = useQuery({
    queryKey: ["doc-signatures", documentId],
    queryFn: () => policyExecutionRepository.listSignatures(documentId!),
    enabled: !!documentId,
  });

  const userPerfis = useQuery({
    queryKey: ["user-perfis", userId],
    queryFn: () => policyExecutionRepository.getUserPerfilIds(userId!),
    enabled: !!userId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["doc-approvals", documentId] });
    qc.invalidateQueries({ queryKey: ["doc-signatures", documentId] });
    qc.invalidateQueries({ queryKey: ["ged-documents"] });
    qc.invalidateQueries({ queryKey: ["my-pending-approvals"] });
    qc.invalidateQueries({ queryKey: ["my-pending-signatures"] });
    qc.invalidateQueries({ queryKey: ["org-pending-approvals"] });
    qc.invalidateQueries({ queryKey: ["org-pending-signatures"] });
    qc.invalidateQueries({ queryKey: ["workflow-approvals"] });
    qc.invalidateQueries({ queryKey: ["workflow-signatures"] });
  };

  const submit = useMutation({
    mutationFn: () => policyExecutionRepository.submitForApproval(documentId!),
    onSuccess: () => {
      toast.success("Documento submetido para aprovação");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const approve = useMutation({
    mutationFn: ({ etapaId, comentario }: { etapaId: string; comentario?: string }) =>
      policyExecutionRepository.approveStep(etapaId, comentario),
    onSuccess: () => {
      toast.success("Etapa aprovada");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const reject = useMutation({
    mutationFn: ({ etapaId, comentario }: { etapaId: string; comentario: string }) =>
      policyExecutionRepository.rejectStep(etapaId, comentario),
    onSuccess: () => {
      toast.success("Etapa reprovada");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const sign = useMutation({
    mutationFn: ({
      assinaturaId,
      tipo,
      hashEvidencia,
      certificado,
    }: {
      assinaturaId: string;
      tipo: TipoAssinatura;
      hashEvidencia?: string | null;
      certificado?: any;
    }) =>
      policyExecutionRepository.signDocument(assinaturaId, tipo, hashEvidencia, certificado),
    onSuccess: () => {
      toast.success("Assinatura registrada");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro ao assinar: " + e.message),
  });

  const archive = useMutation({
    mutationFn: () => policyExecutionRepository.archiveDocument(documentId!),
    onSuccess: () => {
      toast.success("Documento arquivado");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const perfilIds = userPerfis.data || [];

  const canApprove = (a: DocumentoAprovacao) => {
    if (a.status !== "PENDENTE") return false;
    // Etapa atual = primeira pendente em ordem
    return !!a.perfil_responsavel_id && perfilIds.includes(a.perfil_responsavel_id);
  };

  const canSign = (s: DocumentoAssinatura) => {
    if (s.status !== "PENDENTE") return false;
    return !!s.perfil_assinante_id && perfilIds.includes(s.perfil_assinante_id);
  };

  return {
    approvals: approvals.data || [],
    signatures: signatures.data || [],
    isLoading: approvals.isLoading || signatures.isLoading,
    submit,
    approve,
    reject,
    sign,
    archive,
    canApprove,
    canSign,
  };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { documentVersionRepository } from "@/repository/documentVersionRepository";

export function useDocumentVersions(documentId: string | null) {
  const qc = useQueryClient();

  const versionsQuery = useQuery({
    queryKey: ["document-versions", documentId],
    queryFn: () => documentVersionRepository.listVersions(documentId!),
    enabled: !!documentId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["document-versions", documentId] });
    qc.invalidateQueries({ queryKey: ["ged-documents"] });
  };

  const create = useMutation({
    mutationFn: (p: { bumpType: "minor" | "major"; changeDescription: string; file: File; title?: string }) =>
      documentVersionRepository.createVersion({ documentId: documentId!, ...p }),
    onSuccess: () => {
      toast.success("Nova versão criada");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro ao criar versão: " + e.message),
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => documentVersionRepository.restoreVersion(versionId),
    onSuccess: () => {
      toast.success("Versão restaurada");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro ao restaurar: " + e.message),
  });

  const cancel = useMutation({
    mutationFn: (p: { versionId: string; reason?: string }) =>
      documentVersionRepository.cancelVersion(p.versionId, p.reason),
    onSuccess: () => {
      toast.success("Versão cancelada");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro ao cancelar: " + e.message),
  });

  const approve = useMutation({
    mutationFn: (versionId: string) => documentVersionRepository.approveVersion(versionId),
    onSuccess: () => {
      toast.success("Versão aprovada");
      invalidate();
    },
    onError: (e: any) => toast.error("Erro ao aprovar: " + e.message),
  });

  return {
    versions: versionsQuery.data || [],
    isLoading: versionsQuery.isLoading,
    createVersion: create.mutateAsync,
    isCreating: create.isPending,
    restoreVersion: restore.mutate,
    cancelVersion: cancel.mutate,
    approveVersion: approve.mutate,
    getDownloadUrl: documentVersionRepository.getDownloadUrl,
    getVersionText: documentVersionRepository.getVersionText,
  };
}

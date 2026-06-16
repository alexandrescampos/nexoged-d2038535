import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { policyFlowRepository, PoliticaAssinatura, FluxoAprovacao, FluxoAprovacaoEtapa } from "@/repository/policyFlowRepository";
import { accessControlRepository } from "@/repository/accessControlRepository";
import { toast } from "sonner";

export function usePolicies() {
  const { organization } = useAuth();
  const qc = useQueryClient();
  const orgId = organization?.id;

  const list = useQuery({
    queryKey: ["signature-policies", orgId],
    queryFn: () => policyFlowRepository.listPolicies(orgId!),
    enabled: !!orgId,
  });

  const upsert = useMutation({
    mutationFn: (p: Partial<PoliticaAssinatura> & { nome: string }) =>
      policyFlowRepository.upsertPolicy({ ...p, organization_id: orgId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature-policies"] });
      toast.success("Política salva!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => policyFlowRepository.deletePolicy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature-policies"] });
      toast.success("Política excluída!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return { policies: list.data || [], isLoading: list.isLoading, upsert, remove };
}

export function useApprovalFlows() {
  const { organization } = useAuth();
  const qc = useQueryClient();
  const orgId = organization?.id;

  const list = useQuery({
    queryKey: ["approval-flows", orgId],
    queryFn: () => policyFlowRepository.listFlows(orgId!),
    enabled: !!orgId,
  });

  const upsert = useMutation({
    mutationFn: ({ flow, etapas }: { flow: Partial<FluxoAprovacao> & { nome: string }; etapas: Omit<FluxoAprovacaoEtapa, "id" | "fluxo_id">[] }) =>
      policyFlowRepository.upsertFlow({ ...flow, organization_id: orgId! }, etapas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval-flows"] });
      toast.success("Fluxo salvo!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => policyFlowRepository.deleteFlow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval-flows"] });
      toast.success("Fluxo excluído!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return { flows: list.data || [], isLoading: list.isLoading, upsert, remove };
}

export function usePerfis() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ["perfis-org", organization?.id],
    queryFn: () => accessControlRepository.getProfiles(organization!.id),
    enabled: !!organization?.id,
  });
}

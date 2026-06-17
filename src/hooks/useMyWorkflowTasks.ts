import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { policyExecutionRepository } from "@/repository/policyExecutionRepository";

export function useMyWorkflowTasks() {
  const { profile } = useAuth();
  const userId = profile?.id;

  const perfis = useQuery({
    queryKey: ["user-perfis", userId],
    queryFn: () => policyExecutionRepository.getUserPerfilIds(userId!),
    enabled: !!userId,
  });

  const perfilIds = perfis.data || [];

  const approvals = useQuery({
    queryKey: ["my-pending-approvals", perfilIds],
    queryFn: () => policyExecutionRepository.listMyPendingApprovals(perfilIds),
    enabled: !!userId && perfis.isSuccess,
    refetchInterval: 60_000,
  });

  const signatures = useQuery({
    queryKey: ["my-pending-signatures", perfilIds],
    queryFn: () => policyExecutionRepository.listMyPendingSignatures(perfilIds),
    enabled: !!userId && perfis.isSuccess,
    refetchInterval: 60_000,
  });

  return {
    approvals: (approvals.data || []) as any[],
    signatures: (signatures.data || []) as any[],
    totalPending: (approvals.data?.length || 0) + (signatures.data?.length || 0),
    isLoading: perfis.isLoading || approvals.isLoading || signatures.isLoading,
  };
}

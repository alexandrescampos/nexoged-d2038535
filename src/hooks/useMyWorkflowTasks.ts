import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { policyExecutionRepository } from "@/repository/policyExecutionRepository";

export function useMyWorkflowTasks(options?: { viewAll?: boolean }) {
  const { profile, isOrgAdmin, isSuperAdmin, organization } = useAuth();
  const userId = profile?.id;
  const orgId = organization?.id;
  const canViewAll = !!(options?.viewAll && (isOrgAdmin || isSuperAdmin) && orgId);

  const perfis = useQuery({
    queryKey: ["user-perfis", userId],
    queryFn: () => policyExecutionRepository.getUserPerfilIds(userId!),
    enabled: !!userId && !canViewAll,
  });

  const perfilIds = perfis.data || [];

  const approvals = useQuery({
    queryKey: canViewAll
      ? ["org-pending-approvals", orgId]
      : ["my-pending-approvals", perfilIds],
    queryFn: () =>
      canViewAll
        ? policyExecutionRepository.listAllPendingApprovalsForOrg(orgId!)
        : policyExecutionRepository.listMyPendingApprovals(perfilIds),
    enabled: canViewAll ? !!orgId : !!userId && perfis.isSuccess,
    refetchInterval: 60_000,
  });

  const signatures = useQuery({
    queryKey: canViewAll
      ? ["org-pending-signatures", orgId]
      : ["my-pending-signatures", perfilIds],
    queryFn: () =>
      canViewAll
        ? policyExecutionRepository.listAllPendingSignaturesForOrg(orgId!)
        : policyExecutionRepository.listMyPendingSignatures(perfilIds),
    enabled: canViewAll ? !!orgId : !!userId && perfis.isSuccess,
    refetchInterval: 60_000,
  });

  return {
    approvals: (approvals.data || []) as any[],
    signatures: (signatures.data || []) as any[],
    totalPending: (approvals.data?.length || 0) + (signatures.data?.length || 0),
    isLoading: (!canViewAll && perfis.isLoading) || approvals.isLoading || signatures.isLoading,
    canViewAll: isOrgAdmin || isSuperAdmin,
  };
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook that returns the CNPJ IDs and Sector IDs a manager is associated with.
 * For org_admin/super_admin, returns null (no filtering needed).
 * For managers with no CNPJs, returns empty array (no employees visible).
 * For managers with no sectors, returns null for sectors (no sector filtering).
 *
 * IMPORTANT: filters joined rows by the user's CURRENT organization to ignore
 * any stale/orphan associations pointing to CNPJs/sectors of other orgs.
 */
export function useManagerCnpjs() {
  const { user, organization, isUser, isOrgAdmin, isSuperAdmin } = useAuth();
  const orgId = organization?.id ?? null;

  // Scoped roles: manager and org_admin (both can be restricted by CNPJ).
  // Super admin is never scoped. Admin without manager_cnpjs rows = full access.
  const isScoped = !!user?.id && !!orgId && (isUser || isOrgAdmin) && !isSuperAdmin;
  const isUserOnly = !!user?.id && !!orgId && isUser && !isOrgAdmin && !isSuperAdmin;

  const { data: cnpjRows = null, isLoading: isLoadingCnpjs } = useQuery({
    queryKey: ["manager-cnpjs", user?.id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_cnpjs" as any)
        .select("organization_cnpj_id, organization_cnpjs!inner(organization_id)")
        .eq("user_id", user!.id)
        .eq("organization_cnpjs.organization_id", orgId!);
      if (error) throw error;
      return (data as any[]).map((r: any) => r.organization_cnpj_id as string);
    },
    enabled: isScoped,
  });

  const { data: sectorRows = null, isLoading: isLoadingSectors } = useQuery({
    queryKey: ["manager-sectors", user?.id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_sectors" as any)
        .select("sector_id, sectors!inner(organization_id)")
        .eq("user_id", user!.id)
        .eq("sectors.organization_id", orgId!);
      if (error) throw error;
      return (data as any[]).map((r: any) => r.sector_id as string);
    },
    enabled: isUserOnly, // sectors only restrict users, never admins
  });

  if (!isScoped) {
    return { managerCnpjIds: null, managerSectorIds: null, isLoading: false };
  }

  // Empty CNPJ list = full access (null) for both managers and admins.
  // Only non-empty list scopes the user to specific CNPJs.
  const managerCnpjIds: string[] | null =
    cnpjRows && cnpjRows.length > 0 ? cnpjRows : null;

  return {
    managerCnpjIds,
    managerSectorIds: sectorRows && sectorRows.length > 0 ? sectorRows : null,
    isLoading: isLoadingCnpjs || isLoadingSectors,
  };
}

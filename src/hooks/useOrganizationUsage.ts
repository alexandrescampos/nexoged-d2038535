import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrganizationUsage {
  organization_id: string;
  organization_name: string;
  contracted_pages: number;
  contracted_storage_gb: number;
  used_pages: number;
  used_storage_bytes: number;
  used_storage_gb: number;
}

export function useOrganizationUsage(organizationId?: string) {
  return useQuery({
    queryKey: ["organization-usage", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      
      const { data, error } = await supabase
        .from("organization_usage")
        .select("*")
        .eq("organization_id", organizationId)
        .single();
        
      if (error) throw error;
      return data as OrganizationUsage;
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

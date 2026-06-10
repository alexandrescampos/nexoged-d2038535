import { supabase } from "@/integrations/supabase/client";
import { GedPermission } from "@/types/ged";

/**
 * Hook para centralizar verificações de permissão RBAC.
 */
export async function checkServerPermission(userId: string, permission: GedPermission): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_permission', {
    _user_id: userId,
    _permission: permission as any
  });

  if (error) {
    console.error("Erro ao verificar permissão no servidor:", error);
    return false;
  }

  return !!data;
}

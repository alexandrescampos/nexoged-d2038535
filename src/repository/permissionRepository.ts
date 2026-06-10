import { supabase } from "@/integrations/supabase/client";
import { GedPermission } from "@/types/ged";

export const permissionRepository = {
  async getByUserId(userId: string, organizationId: string): Promise<GedPermission[]> {
    const { data, error } = await supabase
      .from("user_permissions")
      .select("permission")
      .eq("user_id", userId)
      .eq("organization_id", organizationId);
    
    if (error) throw error;
    return (data || []).map(p => p.permission as GedPermission);
  },

  async setUserPermissions(userId: string, organizationId: string, permissions: GedPermission[]): Promise<void> {
    // 1. Delete existing
    const { error: deleteError } = await supabase
      .from("user_permissions")
      .delete()
      .eq("user_id", userId)
      .eq("organization_id", organizationId);
    
    if (deleteError) throw deleteError;

    if (permissions.length === 0) return;

    // 2. Insert new
    const inserts = permissions.map(p => ({
      user_id: userId,
      organization_id: organizationId,
      permission: p
    }));

    const { error: insertError } = await supabase
      .from("user_permissions")
      .insert(inserts as any);
    
    if (insertError) throw insertError;
  },

  async logAction(organizationId: string | null, userId: string | null, action: string, details: any = {}): Promise<void> {
    const { error } = await supabase
      .from("system_audit_log")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        action,
        details
      });
    
    if (error) console.error("Audit log error:", error);
  }
};

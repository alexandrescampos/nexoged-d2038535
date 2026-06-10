import { supabase } from "@/integrations/supabase/client";
import { Perfil, Permissao, UsuarioEscopo, SigiloNivel, TipoEscopo } from "@/types/ged";

export const accessControlRepository = {
  // Profiles (Perfis)
  async getProfiles(organizationId: string): Promise<Perfil[]> {
    const { data, error } = await supabase
      .from("perfil")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("ativo", true);
    if (error) throw error;
    return data as Perfil[];
  },

  async createProfile(profile: Partial<Perfil>): Promise<Perfil> {
    const { data, error } = await supabase
      .from("perfil")
      .insert([profile as any])
      .select()
      .single();
    if (error) throw error;
    return data as Perfil;
  },

  async updateProfile(id: string, updates: Partial<Perfil>): Promise<Perfil> {
    const { data, error } = await supabase
      .from("perfil")
      .update(updates)
      .eq("perfil_id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Perfil;
  },

  // Permissions (Permissões)
  async getAllPermissions(): Promise<Permissao[]> {
    const { data, error } = await supabase
      .from("permissao")
      .select("*");
    if (error) throw error;
    return data as Permissao[];
  },

  async getProfilePermissions(profileId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("perfil_permissao")
      .select("perm_id")
      .eq("perfil_id", profileId);
    if (error) throw error;
    return data.map(p => p.perm_id);
  },

  async setProfilePermissions(profileId: string, permissionIds: string[]): Promise<void> {
    const { error: deleteError } = await supabase
      .from("perfil_permissao")
      .delete()
      .eq("perfil_id", profileId);
    if (deleteError) throw deleteError;

    if (permissionIds.length === 0) return;

    const inserts = permissionIds.map(permId => ({
      perfil_id: profileId,
      perm_id: permId
    }));

    const { error: insertError } = await supabase
      .from("perfil_permissao")
      .insert(inserts);
    if (insertError) throw insertError;
  },

  // User Profile Assignment
  async getUserProfiles(userId: string): Promise<Perfil[]> {
    const { data, error } = await supabase
      .from("usuario_perfil")
      .select("perfil(*)")
      .eq("usuario_id", userId);
    if (error) throw error;
    return (data || []).map(d => d.perfil) as unknown as Perfil[];
  },

  async setUserProfiles(userId: string, profileIds: string[], organizationId: string): Promise<void> {
    const { error: deleteError } = await supabase
      .from("usuario_perfil")
      .delete()
      .eq("usuario_id", userId)
      .eq("organization_id", organizationId);
    if (deleteError) throw deleteError;

    if (profileIds.length === 0) return;

    const inserts = profileIds.map(profileId => ({
      usuario_id: userId,
      perfil_id: profileId,
      organization_id: organizationId
    }));

    const { error: insertError } = await supabase
      .from("usuario_perfil")
      .insert(inserts);
    if (insertError) throw insertError;
  },

  // User Scope (Escopo)
  async getUserScopes(userId: string): Promise<UsuarioEscopo[]> {
    const { data, error } = await supabase
      .from("usuario_escopo")
      .select("*")
      .eq("usuario_id", userId);
    if (error) throw error;
    return data as UsuarioEscopo[];
  },

  async addUserScope(scope: Partial<UsuarioEscopo>): Promise<UsuarioEscopo> {
    const { data, error } = await supabase
      .from("usuario_escopo")
      .insert([scope])
      .select()
      .single();
    if (error) throw error;
    return data as UsuarioEscopo;
  },

  async removeUserScope(scopeId: string): Promise<void> {
    const { error } = await supabase
      .from("usuario_escopo")
      .delete()
      .eq("escopo_id", scopeId);
    if (error) throw error;
  },

  // Authorized Users
  async addFolderAuthorizedUser(folderId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("folder_authorized_users")
      .insert([{ past_id: folderId, usuario_id: userId }]);
    if (error) throw error;
  },

  async addDocumentAuthorizedUser(documentId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("documento_usuario_autorizado")
      .insert([{ documento_id: documentId, usuario_id: userId }]);
    if (error) throw error;
  },

  // Simulator / Effective Permissions
  async getEffectivePermissions(userId: string, organizationId: string) {
    // This would call a complex RPC or logic to find all permissions through profiles and scopes
    // For now, we'll fetch profiles and their permissions
    const { data: profiles } = await supabase
      .from("usuario_perfil")
      .select(`
        perfil (
          perfil_id,
          perfil_nome,
          perfil_permissao (
            permissao (
              perm_codigo,
              perm_nome
            )
          )
        )
      `)
      .eq("usuario_id", userId);

    const { data: scopes } = await supabase
      .from("usuario_escopo")
      .select("*")
      .eq("usuario_id", userId);

    return {
      profiles: profiles?.map(p => p.perfil) || [],
      scopes: scopes || []
    };
  }
};

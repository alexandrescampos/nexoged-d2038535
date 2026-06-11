import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDocumentPermissions() {
  const { organization, user, isSuperAdmin, isOrgAdmin } = useAuth();

  const { data: effectivePermissions } = useQuery({
    queryKey: ["user-effective-permissions", user?.id, organization?.id],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
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
        .eq("usuario_id", user?.id);

      if (error) throw error;
      return {
        profiles: (profiles || []).map((p: any) => p.perfil)
      };
    },
    enabled: !!user?.id && !!organization?.id,
  });

  const userHasDownloadPermission = isSuperAdmin || isOrgAdmin || effectivePermissions?.profiles.some((p: any) => 
    p?.perfil_permissao?.some((pp: any) => pp.permissao?.perm_codigo === "baixar_documento")
  );

  const userHasDeletePermission = isSuperAdmin || isOrgAdmin || effectivePermissions?.profiles.some((p: any) => 
    p?.perfil_permissao?.some((pp: any) => pp.permissao?.perm_codigo === "excluir_documento")
  );

  const userHasEditPermission = isSuperAdmin || isOrgAdmin || effectivePermissions?.profiles.some((p: any) => 
    p?.perfil_permissao?.some((pp: any) => pp.permissao?.perm_codigo === "editar_documento")
  );

  const canUserDownload = (doc: any) => {
    if (isSuperAdmin || isOrgAdmin) return true;
    if (doc.owner_id === user?.id || doc.created_by === user?.id) return true;
    return !!userHasDownloadPermission;
  };

  const canUserDelete = (doc: any) => {
    if (isSuperAdmin || isOrgAdmin) return true;
    // Don't allow owners to delete if they don't have the global permission, 
    // unless the business rule explicitly says owners can delete their own stuff.
    // Given the user's complaint, we should strictly follow the global permission.
    return !!userHasDeletePermission;
  };

  const canUserEdit = (doc: any) => {
    if (isSuperAdmin || isOrgAdmin) return true;
    if (doc.owner_id === user?.id || doc.created_by === user?.id) return true;
    return !!userHasEditPermission;
  };

  return {
    canUserDownload,
    canUserDelete,
    canUserEdit,
    userHasDownloadPermission,
    userHasDeletePermission,
    userHasEditPermission,
    isLoading: !effectivePermissions && !!user?.id
  };
}

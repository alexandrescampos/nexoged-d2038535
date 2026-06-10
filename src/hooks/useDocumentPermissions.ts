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

  const canUserDownload = (doc: any) => {
    // Admins can download everything
    if (isSuperAdmin || isOrgAdmin) return true;
    // Owners can download their own documents
    if (doc.owner_id === user?.id || doc.created_by === user?.id) return true;
    // Otherwise, check for the explicit download permission
    return !!userHasDownloadPermission;
  };

  return {
    canUserDownload,
    userHasDownloadPermission,
    isLoading: !effectivePermissions && !!user?.id
  };
}

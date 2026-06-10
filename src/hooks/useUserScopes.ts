import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserScopes {
  unrestricted: boolean;
  departmentIds: Set<string>;
  sectorIds: Set<string>;
  folderIds: Set<string>;
}

/**
 * Busca todos os escopos (departamentos / setores / pastas) que o usuário pode acessar
 * por meio dos seus perfis ativos (usuario_perfil → perfil → perfil_escopo).
 *
 * - Super Admins e Org Admins têm acesso irrestrito (unrestricted: true).
 * - Usuários comuns só veem o que foi explicitamente concedido em algum dos seus perfis.
 * - Caso o usuário não tenha NENHUM escopo definido em seus perfis, considera-se
 *   acesso irrestrito (compatibilidade com cadastros antigos que ainda não usam escopo).
 */
export function useUserScopes() {
  const { user, organization, isSuperAdmin, isOrgAdmin, isAuthReady } = useAuth();

  const enabled = !!user?.id && !!organization?.id && isAuthReady && !isSuperAdmin && !isOrgAdmin;

  const query = useQuery<UserScopes>({
    queryKey: ["user-scopes", user?.id, organization?.id],
    enabled,
    queryFn: async () => {
      // Perfis ativos do usuário
      const { data: perfis, error: errPerfis } = await supabase
        .from("usuario_perfil")
        .select("perfil_id, perfil:perfil_id(ativo, organization_id)")
        .eq("usuario_id", user!.id);

      if (errPerfis) throw errPerfis;

      const activePerfilIds = (perfis || [])
        .filter((p: any) => p.perfil?.ativo && p.perfil?.organization_id === organization!.id)
        .map((p: any) => p.perfil_id);

      if (activePerfilIds.length === 0) {
        return {
          unrestricted: false,
          departmentIds: new Set<string>(),
          sectorIds: new Set<string>(),
          folderIds: new Set<string>(),
        };
      }

      const { data: escopos, error: errEsc } = await supabase
        .from("perfil_escopo")
        .select("tipo_escopo, referencia_id")
        .in("perfil_id", activePerfilIds)
        .eq("organization_id", organization!.id);

      if (errEsc) throw errEsc;

      const departmentIds = new Set<string>();
      const sectorIds = new Set<string>();
      const folderIds = new Set<string>();

      (escopos || []).forEach((e: any) => {
        if (e.tipo_escopo === "DEPARTAMENTO") departmentIds.add(e.referencia_id);
        else if (e.tipo_escopo === "SETOR") sectorIds.add(e.referencia_id);
        else if (e.tipo_escopo === "PASTA") folderIds.add(e.referencia_id);
      });

      // Se nenhum escopo foi configurado em nenhum dos perfis, tratamos como acesso total
      // (perfis sem restrição explícita). Caso contrário, aplicamos a lista.
      const totalScopes = departmentIds.size + sectorIds.size + folderIds.size;
      const unrestricted = totalScopes === 0;

      return { unrestricted, departmentIds, sectorIds, folderIds };
    },
  });

  if (isSuperAdmin || isOrgAdmin) {
    return {
      scopes: {
        unrestricted: true,
        departmentIds: new Set<string>(),
        sectorIds: new Set<string>(),
        folderIds: new Set<string>(),
      } as UserScopes,
      isLoading: false,
    };
  }

  return {
    scopes: query.data ?? {
      unrestricted: false,
      departmentIds: new Set<string>(),
      sectorIds: new Set<string>(),
      folderIds: new Set<string>(),
    },
    isLoading: query.isLoading,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { permissionRepository } from "@/repository/permissionRepository";
import { useAuth } from "@/hooks/useAuth";
import { GedPermission } from "@/types/ged";
import { toast } from "sonner";

export function useUserPermissions(targetUserId?: string) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  const { data: userPermissions = [], isLoading } = useQuery({
    queryKey: ["user-permissions", targetUserId, organization?.id],
    queryFn: () => permissionRepository.getByUserId(targetUserId!, organization!.id),
    enabled: !!targetUserId && !!organization?.id,
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: (permissions: GedPermission[]) => 
      permissionRepository.setUserPermissions(targetUserId!, organization!.id, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", targetUserId] });
      toast.success("Permissões atualizadas com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar permissões: " + error.message);
    }
  });

  return {
    userPermissions,
    isLoading,
    updatePermissions: updatePermissionsMutation.mutate,
    isUpdating: updatePermissionsMutation.isPending,
  };
}

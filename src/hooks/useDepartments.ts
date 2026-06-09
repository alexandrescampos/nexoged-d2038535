import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { departmentRepository } from "@/repository/departmentRepository";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useDepartments() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments", organization?.id],
    queryFn: () => departmentRepository.getAll(organization!.id),
    enabled: !!organization?.id,
  });

  const createMutation = useMutation({
    mutationFn: departmentRepository.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departamento criado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar departamento: " + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      departmentRepository.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departamento atualizado com sucesso!");
    },
  });

  return {
    departments,
    isLoading,
    createDepartment: createMutation.mutate,
    updateDepartment: updateMutation.mutate,
    isCreating: createMutation.isPending,
  };
}

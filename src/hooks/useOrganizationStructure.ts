import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgStructureRepository } from "@/repository/orgStructureRepository";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Department, Sector, Folder } from "@/types/ged";
import { supabase } from "@/integrations/supabase/client";

export function useOrganizationStructure() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  // Queries
  const { data: departments = [], isLoading: isLoadingDepts } = useQuery<Department[]>({
    queryKey: ["departments", organization?.id],
    queryFn: () => orgStructureRepository.getDepartments(organization!.id),
    enabled: !!organization?.id,
  });

  const { data: sectors = [], isLoading: isLoadingSectors } = useQuery<Sector[]>({
    queryKey: ["sectors", organization?.id],
    queryFn: () => orgStructureRepository.getSectors(organization!.id),
    enabled: !!organization?.id,
  });

  const { data: folders = [], isLoading: isLoadingFolders } = useQuery<Folder[]>({
    queryKey: ["folders-all", organization?.id],
    queryFn: () => orgStructureRepository.getFolders(organization!.id),
    enabled: !!organization?.id,
  });

  // Mutations
  const createDeptMutation = useMutation({
    mutationFn: orgStructureRepository.createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departamento criado com sucesso!");
    },
    onError: (error: any) => toast.error("Erro ao criar departamento: " + error.message)
  });

  const createSectorMutation = useMutation({
    mutationFn: orgStructureRepository.createSector,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
      toast.success("Setor criado com sucesso!");
    },
    onError: (error: any) => toast.error("Erro ao criar setor: " + error.message)
  });

  const createFolderMutation = useMutation({
    mutationFn: orgStructureRepository.createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders-all"] });
      toast.success("Pasta criada com sucesso!");
    },
    onError: (error: any) => toast.error("Erro ao criar pasta: " + error.message)
  });

  const moveItemMutation = useMutation({
    mutationFn: async ({ type, id, targetId }: { type: 'DEPARTMENT' | 'SECTOR' | 'FOLDER' | 'DOCUMENT', id: string, targetId: string }) => {
      if (type === 'SECTOR') {
        return supabase.from('sectors').update({ dept_id: targetId }).eq('set_id', id);
      } else if (type === 'FOLDER') {
        // Here we'd need to know if target is a sector or folder
        // Simplified logic: first try sector, then folder if target is parent
        // For simplicity in this implementation, we just update the field
        const { data: sectorCheck } = await supabase.from('sectors').select('set_id').eq('set_id', targetId).maybeSingle();
        if (sectorCheck) {
          return supabase.from('folders').update({ set_id: targetId, past_id_pai: null }).eq('past_id', id);
        } else {
          return supabase.from('folders').update({ past_id_pai: targetId }).eq('past_id', id);
        }
      } else if (type === 'DOCUMENT') {
        return supabase.from('ged_documents').update({ past_id: targetId }).eq('id', id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
      queryClient.invalidateQueries({ queryKey: ["folders-all"] });
      queryClient.invalidateQueries({ queryKey: ["ged-documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Movimentação realizada com sucesso!");
    }
  });

  return {
    departments,
    sectors,
    folders,
    isLoading: isLoadingDepts || isLoadingSectors || isLoadingFolders,
    createDepartment: createDeptMutation.mutate,
    createSector: createSectorMutation.mutate,
    createFolder: createFolderMutation.mutate,
    moveItem: moveItemMutation.mutate
  };
}

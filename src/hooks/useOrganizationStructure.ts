import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gedRepository } from "@/repository/gedRepository";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Department, Sector, Folder } from "@/types/ged";

export function useOrganizationStructure() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  // Queries
  const { data: departments = [], isLoading: isLoadingDepts } = useQuery<Department[]>({
    queryKey: ["departments", organization?.id],
    queryFn: async () => {
      const { data, error } = await (window as any).supabase
        .from("departments")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("dept_nm_departamento");
      if (error) throw error;
      return data as unknown as Department[];
    },
    enabled: !!organization?.id,
  });

  const { data: sectors = [], isLoading: isLoadingSectors } = useQuery<Sector[]>({
    queryKey: ["sectors", organization?.id],
    queryFn: async () => {
      const { data, error } = await (window as any).supabase
        .from("sectors")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("set_nm_setor");
      if (error) throw error;
      return data as unknown as Sector[];
    },
    enabled: !!organization?.id,
  });

  const { data: folders = [], isLoading: isLoadingFolders } = useQuery<Folder[]>({
    queryKey: ["folders-all", organization?.id],
    queryFn: async () => {
      const { data, error } = await (window as any).supabase
        .from("folders")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("past_nm_pasta");
      if (error) throw error;
      return data as unknown as Folder[];
    },
    enabled: !!organization?.id,
  });

  // Mutations
  const moveItemMutation = useMutation({
    mutationFn: async ({ type, id, targetId }: { type: 'DEPARTMENT' | 'SECTOR' | 'FOLDER' | 'DOCUMENT', id: string, targetId: string }) => {
      const supabase = (window as any).supabase;
      if (type === 'SECTOR') {
        return supabase.from('sectors').update({ dept_id: targetId }).eq('set_id', id);
      } else if (type === 'FOLDER') {
        // Here we'd need to know if target is a sector or folder
        // Simplified: assuming targetId is what was dropped on
        return supabase.from('folders').update({ past_id_pai: targetId }).eq('past_id', id);
      } else if (type === 'DOCUMENT') {
        return supabase.from('ged_documents').update({ past_id: targetId }).eq('id', id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
      queryClient.invalidateQueries({ queryKey: ["folders-all"] });
      toast.success("Movimentação realizada com sucesso!");
    }
  });

  return {
    departments,
    sectors,
    folders,
    isLoading: isLoadingDepts || isLoadingSectors || isLoadingFolders,
    moveItem: moveItemMutation.mutate
  };
}
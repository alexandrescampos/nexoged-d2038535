import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gedSettingsRepository } from "@/repository/gedSettingsRepository";
import { useAuth } from "@/hooks/useAuth";
import { DocumentType } from "@/types/ged";
import { toast } from "sonner";

export function useGEDSettings() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  const { data: documentTypes = [], isLoading } = useQuery({
    queryKey: ["ged-document-types", organization?.id],
    queryFn: () => gedSettingsRepository.getDocumentTypes(organization!.id),
    enabled: !!organization?.id,
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ["custom-fields", organization?.id],
    queryFn: () => gedSettingsRepository.getCustomFields(organization!.id),
    enabled: !!organization?.id,
  });

  const createTypeMutation = useMutation({
    mutationFn: ({ type, customFieldIds }: { type: Partial<DocumentType>, customFieldIds?: string[] }) => {
      if (!type.name || !type.initials) throw new Error("Nome e Sigla são obrigatórios");
      return gedSettingsRepository.createDocumentType({
        name: type.name,
        initials: type.initials,
        organization_id: organization!.id,
        description: type.description,
        requires_expiration_date: !!type.requires_expiration_date,
        requires_creation_date: !!type.requires_creation_date
      }, customFieldIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ged-document-types"] });
      toast.success("Tipo de documento criado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar tipo: " + error.message);
    }
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, updates, customFieldIds }: { id: string, updates: Partial<DocumentType>, customFieldIds?: string[] }) => 
      gedSettingsRepository.updateDocumentType(id, updates, customFieldIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ged-document-types"] });
      toast.success("Tipo de documento atualizado!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar tipo: " + error.message);
    }
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => gedSettingsRepository.deleteDocumentType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ged-document-types"] });
      toast.success("Tipo de documento excluído!");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir tipo: " + error.message);
    }
  });

  return {
    documentTypes,
    customFields,
    isLoading,
    createType: createTypeMutation.mutate,
    isCreating: createTypeMutation.isPending,
    updateType: updateTypeMutation.mutate,
    isUpdating: updateTypeMutation.isPending,
    deleteType: deleteTypeMutation.mutate,
    isDeleting: deleteTypeMutation.isPending
  };
}

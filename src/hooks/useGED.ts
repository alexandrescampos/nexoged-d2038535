import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gedRepository } from "@/repository/gedRepository";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useGED(folderId: string | null = null, filterFavorites: boolean = false, filterRecent: boolean = false) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const { profile } = useAuth();

  // Documentos
  const { data: documentsData, isLoading: isLoadingDocs } = useQuery({
    queryKey: ["ged-documents", organization?.id, profile?.id, folderId, searchTerm, selectedTags, page, filterFavorites, filterRecent],
    queryFn: () => {
      if (filterRecent && profile?.id) {
        return gedRepository.getRecentDocuments({
          organizationId: organization!.id,
          userId: profile.id
        });
      }
      return gedRepository.getDocuments({
        organizationId: organization!.id,
        folderId,
        searchTerm,
        tags: selectedTags,
        page,
        isFavorite: filterFavorites
      });
    },
    enabled: !!organization?.id,
  });

  // Pastas
  const { data: folders = [], isLoading: isLoadingFolders } = useQuery({
    queryKey: ["ged-folders", organization?.id, folderId],
    queryFn: () => gedRepository.getFolders(organization!.id, folderId),
    enabled: !!organization?.id,
  });

  // Mutações
  const uploadMutation = useMutation({
    mutationFn: ({ doc, file }: { doc: any, file: File }) => gedRepository.createDocument(doc, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ged-documents"] });
      queryClient.invalidateQueries({ queryKey: ["ged-documents-total"] });
      queryClient.invalidateQueries({ queryKey: ["ged-tags"] });
      queryClient.invalidateQueries({ queryKey: ["organization-usage"] });
      toast.success("Documento enviado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro no upload: " + error.message);
    }
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string, isFavorite: boolean }) => 
      gedRepository.toggleFavorite(id, isFavorite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ged-documents"] });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string) => gedRepository.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ged-documents"] });
      queryClient.invalidateQueries({ queryKey: ["ged-documents-total"] });
      queryClient.invalidateQueries({ queryKey: ["organization-usage"] });
      toast.success("Documento excluído com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir documento: " + error.message);
    }
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: any }) => gedRepository.updateDocument(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ged-documents"] });
      toast.success("Documento atualizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar documento: " + error.message);
    }
  });

  return {
    documents: documentsData?.data || [],
    totalCount: documentsData?.count || 0,
    folders,
    isLoading: isLoadingDocs || isLoadingFolders,
    uploadDocument: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    toggleFavorite: toggleFavoriteMutation.mutate,
    deleteDocument: deleteDocumentMutation.mutate,
    updateDocument: updateDocumentMutation.mutate,
    isUpdatingDoc: updateDocumentMutation.isPending,
    searchTerm,

    setSearchTerm,
    selectedTags,
    setSelectedTags,
    page,
    setPage,
    getDownloadUrl: (id: string) => gedRepository.getDownloadUrl(id)
  };
}

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
          organizationId: organization?.id || "",
          userId: profile.id
        });
      }
      
      return gedRepository.getDocuments({
        organizationId: organization?.id || "",
        folderId,
        searchTerm,
        tags: selectedTags,
        page,
        isFavorite: filterFavorites,
        userId: profile?.id
      });
    },
    enabled: true, // Allow fetching even without organizationId for global views like Favorites
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
    onMutate: async ({ id, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ["ged-documents"] });
      const previous = queryClient.getQueriesData<any>({ queryKey: ["ged-documents"] });

      queryClient.setQueriesData<any>({ queryKey: ["ged-documents"] }, (old: any) => {
        if (!old?.data) return old;
        if (!isFavorite) {
          // Optimistically remove from favorites-filtered lists, flip flag elsewhere
          const filtered = old.data.filter((d: any) => d.id !== id || !old.__isFavoriteList);
          return {
            ...old,
            data: old.data.map((d: any) =>
              d.id === id ? { ...d, is_favorite: false } : d
            ).filter((d: any) => !(old.__isFavoriteList && d.id === id)),
            count: old.count,
          };
        }
        return {
          ...old,
          data: old.data.map((d: any) =>
            d.id === id ? { ...d, is_favorite: true } : d
          ),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous) {
        context.previous.forEach(([key, data]: any) => queryClient.setQueryData(key, data));
      }
    },
    onSettled: () => {
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
      queryClient.invalidateQueries({ queryKey: ["ged-tags"] });
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

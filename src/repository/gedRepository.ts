import { supabase } from "@/integrations/supabase/client";
import { Document, Folder, Sector } from "@/types/ged";

export const gedRepository = {
  // Documentos
  async getDocuments(params: {
    organizationId: string;
    folderId?: string | null;
    isFavorite?: boolean;
    status?: string;
    searchTerm?: string;
    page?: number;
    pageSize?: number;
  }) {
    let query = supabase
      .from("ged_documents")
      .select(`
        *,
        versions:ged_document_versions(mime_type, version_number, file_name),
        document_type_data:ged_document_types(*)
      `, { count: "exact" })
      .eq("organization_id", params.organizationId);

    if (params.folderId !== undefined) {
      if (params.folderId === null) {
        query = query.is("folder_id", null);
      } else {
        query = query.eq("folder_id", params.folderId);
      }
    }

    if (params.isFavorite) {
      // Nota: Esta lógica assume a tabela de favoritos simplificada ou joins
      // Por simplicidade na primeira iteração, usamos o booleano global ou um filtro posterior
      query = query.eq("is_favorite", true);
    }

    if (params.status) {
      query = query.eq("status", params.status);
    } else {
      query = query.neq("status", "deleted");
    }

    if (params.searchTerm) {
      query = query.or(`title.ilike.%${params.searchTerm}%,description.ilike.%${params.searchTerm}%`);
    }

    const from = (params.page || 0) * (params.pageSize || 20);
    const to = from + (params.pageSize || 20) - 1;

    const { data, error, count } = await query
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    const formattedData = (data || []).map(doc => {
      const versions = (doc as any).versions || [];
      const latestVersion = [...versions].sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];

      return {
        ...doc,
        has_file: versions.length > 0,
        file_name: latestVersion?.file_name,
        mime_type: latestVersion?.mime_type || 'application/octet-stream'
      };
    });

    return { data: formattedData as unknown as Document[], count };
  },

  async getRecentDocuments(params: {
    organizationId: string;
    userId: string;
    limit?: number;
  }) {
    // Get recent actions from audit log for this user
    const { data: recentActions, error: logError } = await supabase
      .from("ged_audit_log")
      .select("document_id, created_at")
      .eq("organization_id", params.organizationId)
      .eq("user_id", params.userId)
      .not("document_id", "is", null)
      .in("action", ["viewed", "downloaded", "uploaded", "created"])
      .order("created_at", { ascending: false })
      .limit(params.limit || 50);

    if (logError) throw logError;

    if (!recentActions || recentActions.length === 0) {
      return { data: [], count: 0 };
    }

    // Extract unique document IDs in order of recency
    const documentIds = Array.from(new Set(recentActions.map(a => a.document_id)));
    
    // Fetch the actual documents
    const { data: docs, error: docError } = await supabase
      .from("ged_documents")
      .select(`
        *,
        versions:ged_document_versions(mime_type, version_number, file_name)
      `)
      .in("id", documentIds)
      .neq("status", "deleted");

    if (docError) throw docError;

    // Sort documents according to the order in documentIds (recency)
    const sortedDocs = documentIds
      .map(id => docs.find(d => d.id === id))
      .filter(Boolean) as any[];

    const formattedData = sortedDocs.map(doc => {
      const versions = doc.versions || [];
      const latestVersion = [...versions].sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];

      return {
        ...doc,
        has_file: versions.length > 0,
        file_name: latestVersion?.file_name,
        mime_type: latestVersion?.mime_type || 'application/octet-stream'
      };
    });

    return { data: formattedData as unknown as Document[], count: formattedData.length };
  },

  async createDocument(doc: any, file?: File) {
    // 1. Inserir documento
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: document, error: docError } = await supabase
      .from("ged_documents")
      .insert([{
        ...doc,
        created_by: user?.id,
        page_count: doc.page_count || 1
      }])
      .select()
      .single();

    if (docError) throw docError;

    // 2. Se houver arquivo, fazer upload e criar versão
    if (file && document) {
      try {
        await this.uploadVersion(document.id, 1, file);
      } catch (error) {
        await supabase
          .from("ged_documents")
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq("id", document.id);
        throw error;
      }
    }

    return document;
  },

  async updateDocument(id: string, updates: any) {
    const { data, error } = await supabase
      .from("ged_documents")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },


  async uploadVersion(documentId: string, versionNumber: number, file: File) {
    // Sanitiza o nome do arquivo: remove acentos, espaços e caracteres especiais
    const sanitizedName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `documents/${documentId}/v${versionNumber}_${sanitizedName}`;
    
    const { error: uploadError } = await supabase.storage
      .from("ged_files")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: version, error: versionError } = await supabase
      .from("ged_document_versions")
      .insert([{
        document_id: documentId,
        version_number: versionNumber,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }])
      .select()
      .single();

    if (versionError) throw versionError;

    // Atualizar timestamp do documento
    await supabase.from("ged_documents").update({ updated_at: new Date().toISOString() }).eq("id", documentId);

    return version;
  },

  // Hierarquia
  async getSectors(departmentId: string) {
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .eq("department_id", departmentId)
      .eq("is_active", true);
    if (error) throw error;
    return data;
  },

  async getFolders(organizationId: string, parentId: string | null = null, sectorId: string | null = null) {
    let query = supabase
      .from("folders")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    if (parentId) {
      query = query.eq("parent_id", parentId);
    } else {
      query = query.is("parent_id", null);
    }

    if (sectorId) {
      query = query.eq("sector_id", sectorId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Auditoria
  async logAction(organizationId: string, action: string, documentId?: string, details?: any) {
    const { error } = await supabase.from("ged_audit_log").insert([{
      organization_id: organizationId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      document_id: documentId,
      action,
      details: details || {},
    }]);
    if (error) console.error("Erro ao registrar log:", error);
  },
  
  async toggleFavorite(documentId: string, isFavorite: boolean) {
    const { error } = await supabase
      .from("ged_documents")
      .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
      .eq("id", documentId);

    if (error) throw error;
    return true;
  },

  async deleteDocument(documentId: string) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("ged_documents")
      .update({ status: 'deleted', deleted_at: nowIso, updated_at: nowIso })
      .eq("id", documentId);

    if (error) throw error;
    return true;
  },

  async getDownloadUrl(documentId: string) {
    // Log the action
    const { data: { user } } = await supabase.auth.getUser();
    const { data: doc } = await supabase.from("ged_documents").select("organization_id").eq("id", documentId).single();
    if (user && doc) {
      await this.logAction(doc.organization_id, "viewed", documentId);
    }

    // Buscar a versão mais recente
    const { data: version, error: versionError } = await supabase
      .from("ged_document_versions")
      .select("file_path, file_name")
      .eq("document_id", documentId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) throw versionError;
    if (!version?.file_path) {
      throw new Error("Este documento não possui arquivo anexado.");
    }

    const { data, error } = await supabase.storage
      .from("ged_files")
      .createSignedUrl(version.file_path, 3600); // URL válida por 1 hora

    if (error) throw error;
    return { url: data.signedUrl, fileName: version.file_name };
  }
};

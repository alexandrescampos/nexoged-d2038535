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
    tags?: string[];
    page?: number;
    pageSize?: number;
    userId?: string;
  }) {
    // Pre-fetch favorite doc ids for this user (used both for is_favorite flag and filtering)
    let favoriteIds: string[] = [];
    if (params.userId) {
      console.log("[gedRepository] Fetching favorites for userId:", params.userId);
      const { data: favs, error: favError } = await supabase
        .from("ged_user_favorites")
        .select("document_id")
        .eq("user_id", params.userId);
      
      if (favError) {
        console.error("[gedRepository] Error fetching favorites:", favError);
      }
      
      favoriteIds = (favs || []).map((f: any) => f.document_id);
      console.log("[gedRepository] Found favoriteIds:", favoriteIds);
    }

    let query = supabase
      .from("ged_documents")
      .select(`
        *,
        versions:ged_document_versions(mime_type, version_number, file_name, file_size, created_by),
        document_type_data:ged_document_types(*)
      `, { count: "exact" });
    
    if (params.organizationId) {
      query = query.eq("organization_id", params.organizationId);
    }

    // When searching, look across the whole organization (ignore current folder)
    if (params.folderId !== undefined && !params.searchTerm) {
      if (params.folderId === null) {
        query = query.is("past_id", null);
      } else {
        query = query.eq("past_id", params.folderId);
      }
    }

    if (params.isFavorite) {
      if (favoriteIds.length === 0) {
        return { data: [], count: 0 };
      }
      query = query.in("id", favoriteIds);
    }

    if (params.status) {
      query = query.eq("status", params.status);
    } else {
      query = query.neq("status", "deleted");
    }

    if (params.searchTerm) {
      // Sanitize term to avoid breaking the PostgREST `or` syntax
      const term = params.searchTerm.replace(/[,(){}"]/g, " ").trim();
      if (term) {
        // PostgREST can't do partial ilike on array columns, so we pre-resolve
        // which document ids have any tag/keyword that partially matches the term.
        const lowerTerm = term.toLowerCase();
        const { data: allTagRows } = await supabase
          .from("ged_documents")
          .select("id, tags, keywords")
          .eq("organization_id", params.organizationId)
          .neq("status", "deleted")
          .limit(5000);
        const matchedIds: string[] = [];
        (allTagRows || []).forEach((row: any) => {
          const tags: string[] = Array.isArray(row.tags) ? row.tags : [];
          const kws: string[] = Array.isArray(row.keywords) ? row.keywords : [];
          if (
            tags.some(t => typeof t === "string" && t.toLowerCase().includes(lowerTerm)) ||
            kws.some(k => typeof k === "string" && k.toLowerCase().includes(lowerTerm))
          ) {
            matchedIds.push(row.id);
          }
        });

        const idsClause = matchedIds.length > 0
          ? `,id.in.(${matchedIds.join(",")})`
          : "";

        query = query.or(
          `title.ilike.%${term}%,description.ilike.%${term}%${idsClause}`
        );
      }
    }

    if (params.tags && params.tags.length > 0) {
      // Documents whose tags array overlaps any of the selected tags
      const sanitized = params.tags
        .map(t => t.replace(/[,(){}"]/g, " ").trim())
        .filter(Boolean);
      if (sanitized.length > 0) {
        query = query.overlaps("tags", sanitized);
      }
    }

    const from = (params.page || 0) * (params.pageSize || 20);
    const to = from + (params.pageSize || 20) - 1;

    const { data, error, count } = await query
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    const favoriteSet = new Set(favoriteIds);
    const formattedData = (data || []).map(doc => {
      const versions = (doc as any).versions || [];
      const latestVersion = [...versions].sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];

      return {
        ...doc,
        is_favorite: favoriteSet.has(doc.id),
        has_file: versions.length > 0,
        file_name: latestVersion?.file_name,
        file_size: latestVersion?.file_size,
        mime_type: latestVersion?.mime_type || 'application/octet-stream'
      };
    });

    // Fetch uploader names
    const creatorIds = Array.from(new Set(formattedData.map((d: any) => d.created_by).filter(Boolean)));
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds);
      const nameMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
      formattedData.forEach((d: any) => { d.creator_name = nameMap.get(d.created_by) || null; });
    }

    return { data: formattedData as unknown as Document[], count };
  },

  async getRecentDocuments(params: {
    organizationId: string;
    userId: string;
    limit?: number;
  }) {
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

    const documentIds = Array.from(new Set(recentActions.map(a => a.document_id)));
    
    const { data: docs, error: docError } = await supabase
      .from("ged_documents")
      .select(`
        *,
        versions:ged_document_versions(mime_type, version_number, file_name)
      `)
      .in("id", documentIds)
      .neq("status", "deleted");

    if (docError) throw docError;

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
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: document, error: docError } = await supabase
      .from("ged_documents")
      .insert([{
        ...doc,
        created_by: user?.id,
        owner_id: doc.owner_id || user?.id,
        sigilo: doc.sigilo || 'PUBLICO',
        page_count: doc.page_count || 1
      }])
      .select()
      .single();

    if (docError) throw docError;

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

    await supabase.from("ged_documents").update({ updated_at: new Date().toISOString() }).eq("id", documentId);

    return version;
  },

  // Hierarquia
  async getSectors(departmentId: string): Promise<Sector[]> {
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .eq("dept_id", departmentId)
      .eq("set_in_ativo", true);
    if (error) throw error;
    return data as unknown as Sector[];
  },

  async getFolders(organizationId: string, parentId: string | null = null, sectorId: string | null = null): Promise<Folder[]> {
    let query = supabase
      .from("folders")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("past_in_ativa", true);

    if (parentId) {
      query = query.eq("past_id_pai", parentId);
    } else {
      query = query.is("past_id_pai", null);
    }

    if (sectorId) {
      query = query.eq("set_id", sectorId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as unknown as Folder[];
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    if (isFavorite) {
      const { error } = await supabase
        .from("ged_user_favorites")
        .upsert([{ user_id: user.id, document_id: documentId }], { onConflict: "user_id,document_id" });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("ged_user_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("document_id", documentId);
      if (error) throw error;
    }
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
    const { data: { user } } = await supabase.auth.getUser();
    const { data: doc } = await supabase.from("ged_documents").select("organization_id").eq("id", documentId).single();
    if (user && doc) {
      await this.logAction(doc.organization_id, "viewed", documentId);
    }

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
      .createSignedUrl(version.file_path, 3600); 

    if (error) throw error;
    return { url: data.signedUrl, fileName: version.file_name };
  }
};
import { supabase } from "@/integrations/supabase/client";

export type VersionStatus = "RASCUNHO" | "EM_REVISAO" | "APROVADA" | "ASSINADA" | "ARQUIVADA" | "CANCELADA";

export interface DocumentVersion {
  id: string;
  document_id: string;
  organization_id: string | null;
  version_number: number;
  version_label: string;
  version_major: number;
  version_minor: number;
  title: string | null;
  change_description: string;
  status: VersionStatus;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  checksum: string | null;
  created_by: string | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  based_on_version_id: string | null;
  is_restoration: boolean;
  creator_name?: string;
}

export const documentVersionRepository = {
  async listVersions(documentId: string): Promise<DocumentVersion[]> {
    const { data, error } = await supabase
      .from("ged_document_versions")
      .select("*, creator:profiles!ged_document_versions_created_by_fkey(full_name)")
      .eq("document_id", documentId)
      .order("version_major", { ascending: false })
      .order("version_minor", { ascending: false });
    if (error) throw error;
    return (data || []).map((v: any) => ({ ...v, creator_name: v.creator?.full_name }));
  },

  async createVersion(params: {
    documentId: string;
    bumpType: "minor" | "major";
    changeDescription: string;
    file: File;
    title?: string;
  }): Promise<DocumentVersion> {
    const { documentId, bumpType, changeDescription, file, title } = params;

    const { data: doc, error: docErr } = await supabase
      .from("ged_documents")
      .select("organization_id")
      .eq("id", documentId)
      .single();
    if (docErr) throw docErr;

    const path = `${doc.organization_id}/${documentId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("ged_files").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data, error } = await supabase.rpc("create_document_version", {
      p_document_id: documentId,
      p_bump_type: bumpType,
      p_change_description: changeDescription,
      p_file_path: path,
      p_file_name: file.name,
      p_file_size: file.size,
      p_mime_type: file.type,
      p_title: title ?? null,
      p_based_on: null,
      p_is_restoration: false,
    });
    if (error) throw error;
    return data as DocumentVersion;
  },

  async restoreVersion(versionId: string): Promise<DocumentVersion> {
    const { data, error } = await supabase.rpc("restore_document_version", { p_version_id: versionId });
    if (error) throw error;
    return data as DocumentVersion;
  },

  async cancelVersion(versionId: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc("cancel_document_version", {
      p_version_id: versionId,
      p_reason: reason ?? null,
    });
    if (error) throw error;
  },

  async approveVersion(versionId: string): Promise<void> {
    const { error } = await supabase.rpc("approve_document_version", { p_version_id: versionId });
    if (error) throw error;
  },

  async getDownloadUrl(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage.from("ged_files").createSignedUrl(filePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async getVersionText(versionId: string): Promise<string> {
    const q: any = supabase.from("documento_ocr_pagina");
    const { data, error } = await q
      .select("numero_pagina, texto_original")
      .eq("versao_id", versionId)
      .order("numero_pagina");
    if (error) return "";
    return (data || []).map((p: any) => p.texto_original || "").join("\n\n");
  },
};

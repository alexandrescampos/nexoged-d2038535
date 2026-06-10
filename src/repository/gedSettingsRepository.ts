import { supabase } from "@/integrations/supabase/client";
import { DocumentType } from "@/types/ged";

export const gedSettingsRepository = {
  async getDocumentTypes(organizationId: string) {
    const { data, error } = await supabase
      .from("ged_document_types")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (error) throw error;
    return data as DocumentType[];
  },

  async createDocumentType(type: Partial<DocumentType>) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ged_document_types")
      .insert([{
        ...type,
        created_by: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data as DocumentType;
  },

  async updateDocumentType(id: string, updates: Partial<DocumentType>) {
    const { data, error } = await supabase
      .from("ged_document_types")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as DocumentType;
  },

  async deleteDocumentType(id: string) {
    const { error } = await supabase
      .from("ged_document_types")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  }
};

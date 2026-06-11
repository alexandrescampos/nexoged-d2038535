import { supabase } from "@/integrations/supabase/client";
import { DocumentType, CustomField } from "@/types/ged";

export const gedSettingsRepository = {
  async getDocumentTypes(organizationId: string) {
    const { data, error } = await supabase
      .from("ged_document_types")
      .select("*, associated_fields:ged_document_type_custom_fields(custom_field:custom_fields(*))")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (error) throw error;
    return (data || []).map((type: any) => ({
      ...type,
      associated_fields: (type.associated_fields || []).map((af: any) => af.custom_field)
    })) as DocumentType[];
  },

  async getCustomFields(organizationId: string) {
    // Note: custom_fields might be user-specific or organization-specific depending on how they were created
    // Given the prompt "authenticated users can manage their own lists", let's assume they are shared in the org for now
    // or just fetch all for the user. Profiles table has organization_id.
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("user_id", user?.id)
      .order("name", { ascending: true });

    if (error) throw error;
    return data as CustomField[];
  },

  async createDocumentType(type: Omit<DocumentType, 'id' | 'created_at' | 'updated_at'>, customFieldIds?: string[]) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ged_document_types")
      .insert([{
        name: type.name,
        initials: type.initials,
        organization_id: type.organization_id,
        description: type.description,
        requires_expiration_date: type.requires_expiration_date,
        requires_creation_date: type.requires_creation_date,
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

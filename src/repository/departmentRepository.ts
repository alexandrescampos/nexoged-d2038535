import { supabase } from "@/integrations/supabase/client";
import { Department } from "@/types/ged";

export const departmentRepository = {
  async getAll(organizationId: string): Promise<Department[]> {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");
    
    if (error) throw error;
    return data as Department[];
  },

  async getById(id: string): Promise<Department | null> {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("id", id)
      .single();
    
    if (error) throw error;
    return data as Department;
  },

  async create(department: Omit<Department, "id" | "created_at" | "updated_at">): Promise<Department> {
    const { data, error } = await supabase
      .from("departments")
      .insert(department)
      .select()
      .single();
    
    if (error) throw error;
    return data as Department;
  },

  async update(id: string, updates: Partial<Department>): Promise<Department> {
    const { data, error } = await supabase
      .from("departments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Department;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  }
};

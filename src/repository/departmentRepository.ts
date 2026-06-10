import { supabase } from "@/integrations/supabase/client";
import { Department } from "@/types/ged";

export const departmentRepository = {
  async getAll(organizationId: string): Promise<Department[]> {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("dept_nm_departamento");
    
    if (error) throw error;
    return data as unknown as Department[];
  },

  async getById(id: string): Promise<Department | null> {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("dept_id", id)
      .single();
    
    if (error) throw error;
    return data as unknown as Department;
  },

  async create(department: Omit<Department, "dept_id" | "dept_dt_cadastro" | "created_at" | "updated_at">): Promise<Department> {
    const { data, error } = await supabase
      .from("departments")
      .insert(department)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as Department;
  },

  async update(id: string, updates: Partial<Department>): Promise<Department> {
    const { data, error } = await supabase
      .from("departments")
      .update(updates)
      .eq("dept_id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as Department;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("dept_id", id);
    
    if (error) throw error;
  }
};
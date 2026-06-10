import { supabase } from "@/integrations/supabase/client";
import { Department, Sector, Folder } from "@/types/ged";

export const orgStructureRepository = {
  async getDepartments(orgId: string): Promise<Department[]> {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("organization_id", orgId)
      .order("dept_nm_departamento");
    if (error) throw error;
    return data as Department[];
  },

  async createDepartment(dept: Omit<Department, "dept_id" | "dept_dt_cadastro" | "created_at" | "updated_at">): Promise<Department> {
    const { data, error } = await supabase
      .from("departments")
      .insert([dept])
      .select()
      .single();
    if (error) throw error;
    return data as Department;
  },

  async getSectors(orgId: string): Promise<Sector[]> {
    const { data, error } = await supabase
      .from("sectors")
      .select("*")
      .eq("organization_id", orgId)
      .order("set_nm_setor");
    if (error) throw error;
    return data as Sector[];
  },

  async createSector(sector: Omit<Sector, "set_id" | "set_dt_cadastro" | "created_at" | "updated_at">): Promise<Sector> {
    const { data, error } = await supabase
      .from("sectors")
      .insert([sector])
      .select()
      .single();
    if (error) throw error;
    return data as Sector;
  },

  async getFolders(orgId: string): Promise<Folder[]> {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("organization_id", orgId)
      .order("past_nm_pasta");
    if (error) throw error;
    return data as Folder[];
  },

  async createFolder(folder: Omit<Folder, "past_id" | "past_dt_cadastro" | "created_at" | "updated_at">): Promise<Folder> {
    const { data, error } = await supabase
      .from("folders")
      .insert([folder])
      .select()
      .single();
    if (error) throw error;
    return data as Folder;
  }
};

export type GedPermission = 
  | 'visualizar_documento'
  | 'inserir_documento'
  | 'editar_documento'
  | 'excluir_documento'
  | 'restaurar_documento'
  | 'assinar_documento'
  | 'administrar_sistema';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  status: string;
  plan: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  department_id?: string;
  is_active: boolean;
  must_reset_password?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  parent_id?: string | null;
  name: string;
  code?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sector {
  id: string;
  department_id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  organization_id: string;
  sector_id?: string;
  parent_id?: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  organization_id: string;
  folder_id?: string;
  title: string;
  description?: string;
  document_type?: string;
  taxonomy?: string;
  status: string;
  tags: string[];
  keywords: string[];
  is_favorite: boolean;
  deleted_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joins
  mime_type?: string; // Do primeiro arquivo da versão
  versions_count?: number;
  creator_name?: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  checksum?: string;
  created_by: string;
  created_at: string;
}

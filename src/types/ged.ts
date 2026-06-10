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
  contracted_pages: number;
  contracted_storage_gb: number;
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
  dept_id: string;
  organization_id: string;
  dept_cd_departamento?: string | null;
  dept_nm_departamento: string;
  dept_ds_departamento?: string | null;
  dept_in_ativo: boolean;
  dept_dt_cadastro: string;
  dept_usuario_responsavel?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sector {
  set_id: string;
  dept_id: string;
  organization_id: string;
  set_cd_setor?: string | null;
  set_nm_setor: string;
  set_ds_setor?: string | null;
  set_in_ativo: boolean;
  set_dt_cadastro: string;
  set_usuario_responsavel?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  past_id: string;
  organization_id: string;
  set_id?: string;
  past_id_pai?: string | null;
  past_cd_pasta?: string | null;
  past_nm_pasta: string;
  past_ds_pasta?: string | null;
  past_in_ativa: boolean;
  past_in_restrita: boolean;
  past_in_permite_subpastas: boolean;
  past_dt_cadastro: string;
  past_usuario_responsavel?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentType {
  id: string;
  organization_id: string;
  initials: string;
  name: string;
  description?: string;
  requires_expiration_date: boolean;
  requires_creation_date: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface Document {
  id: string;
  organization_id: string;
  folder_id?: string;
  title: string;
  description?: string;
  document_type?: string;
  document_type_id?: string;
  expiration_date?: string;
  document_creation_date?: string;
  taxonomy?: string;
  status: string;
  tags: string[];
  keywords: string[];
  page_count: number;
  is_favorite: boolean;
  deleted_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joins
  mime_type?: string; // Do primeiro arquivo da versão
  has_file?: boolean;
  file_name?: string;
  versions_count?: number;
  creator_name?: string;
  document_type_data?: DocumentType;
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

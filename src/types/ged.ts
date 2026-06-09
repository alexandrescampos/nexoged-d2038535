import { AppRole } from "./auth";

export type GedPermission =
  | 'visualizar_documento'
  | 'inserir_documento'
  | 'editar_documento'
  | 'excluir_documento'
  | 'restaurar_documento'
  | 'assinar_documento'
  | 'administrar_sistema';

export interface Department {
  id: string;
  organization_id: string;
  parent_id: string | null;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission: GedPermission;
  organization_id: string;
  created_at: string;
}

export interface SystemAuditLog {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      departments: {
        Row: {
          dept_cd_departamento: string | null
          dept_ds_departamento: string | null
          dept_dt_cadastro: string | null
          dept_id: string
          dept_in_ativo: boolean | null
          dept_nm_departamento: string
          dept_usuario_responsavel: string | null
          organization_id: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          dept_cd_departamento?: string | null
          dept_ds_departamento?: string | null
          dept_dt_cadastro?: string | null
          dept_id?: string
          dept_in_ativo?: boolean | null
          dept_nm_departamento: string
          dept_usuario_responsavel?: string | null
          organization_id: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          dept_cd_departamento?: string | null
          dept_ds_departamento?: string | null
          dept_dt_cadastro?: string | null
          dept_id?: string
          dept_in_ativo?: boolean | null
          dept_nm_departamento?: string
          dept_usuario_responsavel?: string | null
          organization_id?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["dept_id"]
          },
        ]
      }
      documento_usuario_autorizado: {
        Row: {
          created_at: string | null
          documento_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          documento_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          documento_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_usuario_autorizado_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "ged_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          description: string | null
          document_date: string | null
          document_type: string
          employee_id: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          organization_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_date?: string | null
          document_type?: string
          employee_id: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          organization_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_date?: string | null
          document_type?: string
          employee_id?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          organization_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "employee_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_authorized_users: {
        Row: {
          created_at: string | null
          id: string
          past_id: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          past_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          past_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folder_authorized_users_past_id_fkey"
            columns: ["past_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["past_id"]
          },
        ]
      }
      folder_document_types: {
        Row: {
          created_at: string | null
          id: string
          past_id: string | null
          tipo_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          past_id?: string | null
          tipo_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          past_id?: string | null
          tipo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folder_document_types_past_id_fkey"
            columns: ["past_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["past_id"]
          },
          {
            foreignKeyName: "folder_document_types_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "ged_document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          organization_id: string
          past_cd_pasta: string | null
          past_ds_pasta: string | null
          past_dt_cadastro: string | null
          past_id: string
          past_id_pai: string | null
          past_in_ativa: boolean | null
          past_in_permite_subpastas: boolean | null
          past_in_restrita: boolean | null
          past_nm_pasta: string
          past_usuario_responsavel: string | null
          set_id: string | null
          updated_at: string | null
        }
        Insert: {
          organization_id: string
          past_cd_pasta?: string | null
          past_ds_pasta?: string | null
          past_dt_cadastro?: string | null
          past_id?: string
          past_id_pai?: string | null
          past_in_ativa?: boolean | null
          past_in_permite_subpastas?: boolean | null
          past_in_restrita?: boolean | null
          past_nm_pasta: string
          past_usuario_responsavel?: string | null
          set_id?: string | null
          updated_at?: string | null
        }
        Update: {
          organization_id?: string
          past_cd_pasta?: string | null
          past_ds_pasta?: string | null
          past_dt_cadastro?: string | null
          past_id?: string
          past_id_pai?: string | null
          past_in_ativa?: boolean | null
          past_in_permite_subpastas?: boolean | null
          past_in_restrita?: boolean | null
          past_nm_pasta?: string
          past_usuario_responsavel?: string | null
          set_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["past_id_pai"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["past_id"]
          },
          {
            foreignKeyName: "folders_sector_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["set_id"]
          },
        ]
      }
      ged_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          document_id: string | null
          id: string
          ip_address: string | null
          organization_id: string | null
          user_id: string | null
          version_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_id?: string | null
          version_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_id?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ged_audit_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ged_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ged_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ged_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ged_audit_log_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "ged_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ged_document_types: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          initials: string
          name: string
          organization_id: string
          requires_creation_date: boolean | null
          requires_expiration_date: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          initials: string
          name: string
          organization_id: string
          requires_creation_date?: boolean | null
          requires_expiration_date?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          initials?: string
          name?: string
          organization_id?: string
          requires_creation_date?: boolean | null
          requires_expiration_date?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ged_document_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ged_document_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ged_document_versions: {
        Row: {
          checksum: string | null
          created_at: string | null
          created_by: string | null
          document_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          version_number: number
        }
        Insert: {
          checksum?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          version_number: number
        }
        Update: {
          checksum?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ged_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ged_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ged_documents: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          document_creation_date: string | null
          document_type: string | null
          document_type_id: string | null
          expiration_date: string | null
          folder_id: string | null
          id: string
          is_favorite: boolean | null
          keywords: string[] | null
          organization_id: string
          owner_id: string | null
          page_count: number | null
          past_id: string | null
          sigilo: Database["public"]["Enums"]["sigilo_nivel"] | null
          status: string | null
          tags: string[] | null
          taxonomy: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          document_creation_date?: string | null
          document_type?: string | null
          document_type_id?: string | null
          expiration_date?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          keywords?: string[] | null
          organization_id: string
          owner_id?: string | null
          page_count?: number | null
          past_id?: string | null
          sigilo?: Database["public"]["Enums"]["sigilo_nivel"] | null
          status?: string | null
          tags?: string[] | null
          taxonomy?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          document_creation_date?: string | null
          document_type?: string | null
          document_type_id?: string | null
          expiration_date?: string | null
          folder_id?: string | null
          id?: string
          is_favorite?: boolean | null
          keywords?: string[] | null
          organization_id?: string
          owner_id?: string | null
          page_count?: number | null
          past_id?: string | null
          sigilo?: Database["public"]["Enums"]["sigilo_nivel"] | null
          status?: string | null
          tags?: string[] | null
          taxonomy?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ged_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "ged_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ged_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["past_id"]
          },
          {
            foreignKeyName: "ged_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ged_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ged_documents_past_id_fkey"
            columns: ["past_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["past_id"]
          },
        ]
      }
      ged_hierarchy_audit: {
        Row: {
          acao: string
          created_at: string | null
          detalhes: Json | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          organization_id: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          detalhes?: Json | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          organization_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          detalhes?: Json | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          organization_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ged_hierarchy_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ged_hierarchy_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ged_user_favorites: {
        Row: {
          created_at: string | null
          document_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ged_user_favorites_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ged_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          organization_id: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_api_usage_log: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          organization_id: string
          status_code: number
          success: boolean
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          organization_id: string
          status_code: number
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          organization_id?: string
          status_code?: number
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      organization_cnpjs: {
        Row: {
          cnpj: string
          company_name: string
          created_at: string
          id: string
          is_active: boolean
          is_main: boolean
          logo_url: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          company_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_main?: boolean
          logo_url?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          company_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_main?: boolean
          logo_url?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_cnpjs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_cnpjs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          city: string | null
          cnpj: string | null
          contracted_pages: number | null
          contracted_storage_gb: number | null
          created_at: string
          email: string | null
          id: string
          is_plan_managed: boolean | null
          logo_url: string | null
          max_users: number | null
          name: string
          neighborhood: string | null
          phone: string | null
          plan: string | null
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["org_status"]
          terms_accepted_at: string | null
          terms_accepted_version: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          contracted_pages?: number | null
          contracted_storage_gb?: number | null
          created_at?: string
          email?: string | null
          id?: string
          is_plan_managed?: boolean | null
          logo_url?: string | null
          max_users?: number | null
          name: string
          neighborhood?: string | null
          phone?: string | null
          plan?: string | null
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          contracted_pages?: number | null
          contracted_storage_gb?: number | null
          created_at?: string
          email?: string | null
          id?: string
          is_plan_managed?: boolean | null
          logo_url?: string | null
          max_users?: number | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          plan?: string | null
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          user_id?: string | null
        }
        Relationships: []
      }
      perfil: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          organization_id: string | null
          perfil_descricao: string | null
          perfil_id: string
          perfil_nome: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          organization_id?: string | null
          perfil_descricao?: string | null
          perfil_id?: string
          perfil_nome: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          organization_id?: string | null
          perfil_descricao?: string | null
          perfil_id?: string
          perfil_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "perfil_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_permissao: {
        Row: {
          perfil_id: string
          perm_id: string
        }
        Insert: {
          perfil_id: string
          perm_id: string
        }
        Update: {
          perfil_id?: string
          perm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_permissao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["perfil_id"]
          },
          {
            foreignKeyName: "perfil_permissao_perm_id_fkey"
            columns: ["perm_id"]
            isOneToOne: false
            referencedRelation: "permissao"
            referencedColumns: ["perm_id"]
          },
        ]
      }
      permissao: {
        Row: {
          created_at: string | null
          perm_codigo: string
          perm_descricao: string | null
          perm_id: string
          perm_nome: string
        }
        Insert: {
          created_at?: string | null
          perm_codigo: string
          perm_descricao?: string | null
          perm_id?: string
          perm_nome: string
        }
        Update: {
          created_at?: string | null
          perm_codigo?: string
          perm_descricao?: string | null
          perm_id?: string
          perm_nome?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_highlighted: boolean | null
          max_pages: number | null
          max_storage_gb: number | null
          max_users: number | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          slug: string
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_highlighted?: boolean | null
          max_pages?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          slug: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_highlighted?: boolean | null
          max_pages?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          slug?: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          email: string | null
          full_name: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          must_reset_password: boolean | null
          organization_id: string | null
          password_updated_at: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id: string
          is_active?: boolean | null
          must_reset_password?: boolean | null
          organization_id?: string | null
          password_updated_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          must_reset_password?: boolean | null
          organization_id?: string | null
          password_updated_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["dept_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          dept_id: string
          organization_id: string
          set_cd_setor: string | null
          set_ds_setor: string | null
          set_dt_cadastro: string | null
          set_id: string
          set_in_ativo: boolean | null
          set_nm_setor: string
          set_usuario_responsavel: string | null
          updated_at: string | null
        }
        Insert: {
          dept_id: string
          organization_id: string
          set_cd_setor?: string | null
          set_ds_setor?: string | null
          set_dt_cadastro?: string | null
          set_id?: string
          set_in_ativo?: boolean | null
          set_nm_setor: string
          set_usuario_responsavel?: string | null
          updated_at?: string | null
        }
        Update: {
          dept_id?: string
          organization_id?: string
          set_cd_setor?: string | null
          set_ds_setor?: string | null
          set_dt_cadastro?: string | null
          set_id?: string
          set_in_ativo?: boolean | null
          set_nm_setor?: string
          set_usuario_responsavel?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sectors_department_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["dept_id"]
          },
          {
            foreignKeyName: "sectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "sectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_config: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          organization_id: string
          pause_collection_behavior: string | null
          pause_collection_resumes_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          organization_id: string
          pause_collection_behavior?: string | null
          pause_collection_resumes_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          organization_id?: string
          pause_collection_behavior?: string | null
          pause_collection_resumes_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "stripe_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_cancellations: {
        Row: {
          canceled_at: string | null
          created_at: string | null
          feedback: string | null
          id: string
          organization_id: string
          plan_name: string | null
          reason: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          organization_id: string
          plan_name?: string | null
          reason: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          organization_id?: string
          plan_name?: string | null
          reason?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cancellations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "subscription_cancellations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_logs: {
        Row: {
          assistant_response: string | null
          category: string | null
          cnpj_id: string | null
          completion_tokens: number | null
          id: string
          inserted_at: string
          model: string | null
          organization_id: string | null
          prompt_tokens: number | null
          total_tokens: number | null
          user_id: string | null
          user_name: string | null
          user_question: string
          user_role: string | null
        }
        Insert: {
          assistant_response?: string | null
          category?: string | null
          cnpj_id?: string | null
          completion_tokens?: number | null
          id?: string
          inserted_at?: string
          model?: string | null
          organization_id?: string | null
          prompt_tokens?: number | null
          total_tokens?: number | null
          user_id?: string | null
          user_name?: string | null
          user_question: string
          user_role?: string | null
        }
        Update: {
          assistant_response?: string | null
          category?: string | null
          cnpj_id?: string | null
          completion_tokens?: number | null
          id?: string
          inserted_at?: string
          model?: string | null
          organization_id?: string | null
          prompt_tokens?: number | null
          total_tokens?: number | null
          user_id?: string | null
          user_name?: string | null
          user_question?: string
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_logs_cnpj_id_fkey"
            columns: ["cnpj_id"]
            isOneToOne: false
            referencedRelation: "organization_cnpjs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_chat_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "support_chat_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          organization_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "system_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      user_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          metadata: Json | null
          method: string | null
          organization_id: string | null
          performed_by: string | null
          source: string
          target_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string | null
          organization_id?: string | null
          performed_by?: string | null
          source: string
          target_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string | null
          organization_id?: string | null
          performed_by?: string | null
          source?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "user_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          permission: Database["public"]["Enums"]["ged_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          permission: Database["public"]["Enums"]["ged_permission"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          permission?: Database["public"]["Enums"]["ged_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_scope: {
        Row: {
          created_at: string | null
          escopo_id: string
          herda_permissoes: boolean | null
          id: string
          tipo_escopo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          escopo_id: string
          herda_permissoes?: boolean | null
          id?: string
          tipo_escopo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          escopo_id?: string
          herda_permissoes?: boolean | null
          id?: string
          tipo_escopo?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      usuario_escopo: {
        Row: {
          data_cadastro: string | null
          escopo_id: string
          escopo_referencia_id: string
          herda_permissoes: boolean | null
          organization_id: string | null
          tipo_escopo: Database["public"]["Enums"]["tipo_escopo_enum"]
          usuario_id: string | null
        }
        Insert: {
          data_cadastro?: string | null
          escopo_id?: string
          escopo_referencia_id: string
          herda_permissoes?: boolean | null
          organization_id?: string | null
          tipo_escopo: Database["public"]["Enums"]["tipo_escopo_enum"]
          usuario_id?: string | null
        }
        Update: {
          data_cadastro?: string | null
          escopo_id?: string
          escopo_referencia_id?: string
          herda_permissoes?: boolean | null
          organization_id?: string | null
          tipo_escopo?: Database["public"]["Enums"]["tipo_escopo_enum"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuario_escopo_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "usuario_escopo_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_perfil: {
        Row: {
          organization_id: string | null
          perfil_id: string
          usuario_id: string
        }
        Insert: {
          organization_id?: string | null
          perfil_id: string
          usuario_id: string
        }
        Update: {
          organization_id?: string | null
          perfil_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_perfil_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_usage"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "usuario_perfil_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_perfil_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["perfil_id"]
          },
        ]
      }
    }
    Views: {
      organization_usage: {
        Row: {
          contracted_pages: number | null
          contracted_storage_gb: number | null
          organization_id: string | null
          organization_name: string | null
          used_pages: number | null
          used_storage_bytes: number | null
          used_storage_gb: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_org_add_user: { Args: { _org_id: string }; Returns: boolean }
      check_password_is_not_repeated: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: boolean
      }
      check_user_has_history: { Args: { p_user_id: string }; Returns: boolean }
      check_user_is_admin: { Args: { user_id: string }; Returns: boolean }
      cleanup_api_usage_log: { Args: never; Returns: undefined }
      get_org_max_users: { Args: { _org_id: string }; Returns: number }
      get_org_user_count: { Args: { _org_id: string }; Returns: number }
      get_super_admin_ids: { Args: never; Returns: string[] }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["ged_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_org: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_password_in_history: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: boolean
      }
      normalize_name: { Args: { input: string }; Returns: string }
      record_password_change: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: undefined
      }
      sum_org_document_size: { Args: { p_org_id: string }; Returns: number }
    }
    Enums: {
      app_role: "super_admin" | "org_admin" | "manager" | "user"
      ged_permission:
        | "visualizar_documento"
        | "inserir_documento"
        | "editar_documento"
        | "excluir_documento"
        | "restaurar_documento"
        | "assinar_documento"
        | "administrar_sistema"
      org_status: "active" | "suspended" | "trial"
      sigilo_nivel:
        | "PUBLICO"
        | "INTERNO"
        | "RESTRITO"
        | "CONFIDENCIAL"
        | "SIGILOSO"
      tipo_escopo_enum: "DEPARTAMENTO" | "SETOR" | "PASTA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "org_admin", "manager", "user"],
      ged_permission: [
        "visualizar_documento",
        "inserir_documento",
        "editar_documento",
        "excluir_documento",
        "restaurar_documento",
        "assinar_documento",
        "administrar_sistema",
      ],
      org_status: ["active", "suspended", "trial"],
      sigilo_nivel: [
        "PUBLICO",
        "INTERNO",
        "RESTRITO",
        "CONFIDENCIAL",
        "SIGILOSO",
      ],
      tipo_escopo_enum: ["DEPARTAMENTO", "SETOR", "PASTA"],
    },
  },
} as const

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
      caepi_certificates: {
        Row: {
          ca_number: string
          equipment_description: string | null
          equipment_name: string | null
          expiration_date: string | null
          last_synced_at: string
          manufacturer_cnpj: string | null
          manufacturer_name: string | null
          process_number: string | null
          protection_nature: string | null
          status: string | null
        }
        Insert: {
          ca_number: string
          equipment_description?: string | null
          equipment_name?: string | null
          expiration_date?: string | null
          last_synced_at?: string
          manufacturer_cnpj?: string | null
          manufacturer_name?: string | null
          process_number?: string | null
          protection_nature?: string | null
          status?: string | null
        }
        Update: {
          ca_number?: string
          equipment_description?: string | null
          equipment_name?: string | null
          expiration_date?: string | null
          last_synced_at?: string
          manufacturer_cnpj?: string | null
          manufacturer_name?: string | null
          process_number?: string | null
          protection_nature?: string | null
          status?: string | null
        }
        Relationships: []
      }
      caepi_sync_log: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          total_records: number | null
          triggered_by: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          total_records?: number | null
          triggered_by?: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          total_records?: number | null
          triggered_by?: string
        }
        Relationships: []
      }
      cnpj_stock_sources: {
        Row: {
          consumer_cnpj_id: string
          created_at: string
          id: string
          organization_id: string
          priority: number
          source_cnpj_id: string
          updated_at: string
        }
        Insert: {
          consumer_cnpj_id: string
          created_at?: string
          id?: string
          organization_id: string
          priority?: number
          source_cnpj_id: string
          updated_at?: string
        }
        Update: {
          consumer_cnpj_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          priority?: number
          source_cnpj_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string
          description: string | null
          document_date: string | null
          document_type: string
          employee_id: string
          file_name: string
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
          file_url?: string
          id?: string
          organization_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
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
      employees: {
        Row: {
          admission_date: string | null
          cpf: string | null
          created_at: string
          ctps_number: string | null
          id: string
          is_active: boolean
          job_function_id: string | null
          name: string
          organization_cnpj_id: string | null
          organization_id: string
          pants_size: string | null
          registration_number: string | null
          sector_id: string | null
          shirt_size: string | null
          shoe_size: string | null
          termination_date: string | null
          updated_at: string
        }
        Insert: {
          admission_date?: string | null
          cpf?: string | null
          created_at?: string
          ctps_number?: string | null
          id?: string
          is_active?: boolean
          job_function_id?: string | null
          name: string
          organization_cnpj_id?: string | null
          organization_id: string
          pants_size?: string | null
          registration_number?: string | null
          sector_id?: string | null
          shirt_size?: string | null
          shoe_size?: string | null
          termination_date?: string | null
          updated_at?: string
        }
        Update: {
          admission_date?: string | null
          cpf?: string | null
          created_at?: string
          ctps_number?: string | null
          id?: string
          is_active?: boolean
          job_function_id?: string | null
          name?: string
          organization_cnpj_id?: string | null
          organization_id?: string
          pants_size?: string | null
          registration_number?: string | null
          sector_id?: string | null
          shirt_size?: string | null
          shoe_size?: string | null
          termination_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_cnpj_id_fkey"
            columns: ["organization_cnpj_id"]
            isOneToOne: false
            referencedRelation: "organization_cnpjs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_cnpj_stock: {
        Row: {
          created_at: string
          epi_id: string
          id: string
          min_stock: number
          organization_cnpj_id: string
          organization_id: string
          stock_quantity: number
          updated_at: string
          used_stock_quantity: number
        }
        Insert: {
          created_at?: string
          epi_id: string
          id?: string
          min_stock?: number
          organization_cnpj_id: string
          organization_id: string
          stock_quantity?: number
          updated_at?: string
          used_stock_quantity?: number
        }
        Update: {
          created_at?: string
          epi_id?: string
          id?: string
          min_stock?: number
          organization_cnpj_id?: string
          organization_id?: string
          stock_quantity?: number
          updated_at?: string
          used_stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "epi_cnpj_stock_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_cnpj_stock_organization_cnpj_id_fkey"
            columns: ["organization_cnpj_id"]
            isOneToOne: false
            referencedRelation: "organization_cnpjs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_cnpj_stock_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_deliveries: {
        Row: {
          created_at: string
          delivered_by: string
          delivery_date: string
          employee_id: string
          employee_record_id: string | null
          epi_id: string
          expiration_date: string | null
          id: string
          notes: string | null
          organization_id: string
          quantity: number
          reason: string | null
          return_date: string | null
          signed_term_id: string | null
          status: Database["public"]["Enums"]["epi_delivery_status"]
          stock_source: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_by: string
          delivery_date?: string
          employee_id: string
          employee_record_id?: string | null
          epi_id: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          quantity?: number
          reason?: string | null
          return_date?: string | null
          signed_term_id?: string | null
          status?: Database["public"]["Enums"]["epi_delivery_status"]
          stock_source?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_by?: string
          delivery_date?: string
          employee_id?: string
          employee_record_id?: string | null
          epi_id?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          reason?: string | null
          return_date?: string | null
          signed_term_id?: string | null
          status?: Database["public"]["Enums"]["epi_delivery_status"]
          stock_source?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_deliveries_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_employee_record_id_fkey"
            columns: ["employee_record_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_signed_term_id_fkey"
            columns: ["signed_term_id"]
            isOneToOne: false
            referencedRelation: "epi_signed_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_request_items: {
        Row: {
          delivery_id: string | null
          epi_id: string
          expiration_date: string | null
          id: string
          quantity: number
          reason: string | null
          request_id: string
          stock_source: string
        }
        Insert: {
          delivery_id?: string | null
          epi_id: string
          expiration_date?: string | null
          id?: string
          quantity?: number
          reason?: string | null
          request_id: string
          stock_source?: string
        }
        Update: {
          delivery_id?: string | null
          epi_id?: string
          expiration_date?: string | null
          id?: string
          quantity?: number
          reason?: string | null
          request_id?: string
          stock_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_request_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "epi_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_request_items_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "epi_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_requests: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          organization_id: string
          rejection_reason: string | null
          request_type: string
          requested_by: string
          responded_at: string | null
          responded_by: string | null
          status: string
          stock_source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          organization_id: string
          rejection_reason?: string | null
          request_type: string
          requested_by: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          stock_source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          rejection_reason?: string | null
          request_type?: string
          requested_by?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          stock_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_signed_terms: {
        Row: {
          created_at: string
          delivery_date: string
          employee_record_id: string
          file_name: string
          file_url: string
          geo_accuracy: number | null
          geo_lat: number | null
          geo_lng: number | null
          geo_source: string | null
          id: string
          ip_address: string | null
          legal_basis: string | null
          operator_name: string | null
          operator_user_id: string | null
          organization_id: string
          pdf_sha256: string | null
          signed_at_client: string | null
          signed_at_server: string | null
          signer_employee_cpf: string | null
          signer_employee_name: string | null
          uploaded_by: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          delivery_date: string
          employee_record_id: string
          file_name: string
          file_url: string
          geo_accuracy?: number | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_source?: string | null
          id?: string
          ip_address?: string | null
          legal_basis?: string | null
          operator_name?: string | null
          operator_user_id?: string | null
          organization_id: string
          pdf_sha256?: string | null
          signed_at_client?: string | null
          signed_at_server?: string | null
          signer_employee_cpf?: string | null
          signer_employee_name?: string | null
          uploaded_by: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          delivery_date?: string
          employee_record_id?: string
          file_name?: string
          file_url?: string
          geo_accuracy?: number | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_source?: string | null
          id?: string
          ip_address?: string | null
          legal_basis?: string | null
          operator_name?: string | null
          operator_user_id?: string | null
          organization_id?: string
          pdf_sha256?: string | null
          signed_at_client?: string | null
          signed_at_server?: string | null
          signer_employee_cpf?: string | null
          signer_employee_name?: string | null
          uploaded_by?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_signed_terms_employee_record_id_fkey"
            columns: ["employee_record_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_signed_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      epis: {
        Row: {
          average_cost: number | null
          ca_expiration: string | null
          ca_number: string | null
          category_id: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          manufacturer: string | null
          min_stock: number
          model: string | null
          name: string
          organization_id: string
          stock_quantity: number
          updated_at: string
          used_stock_quantity: number
        }
        Insert: {
          average_cost?: number | null
          ca_expiration?: string | null
          ca_number?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          min_stock?: number
          model?: string | null
          name: string
          organization_id: string
          stock_quantity?: number
          updated_at?: string
          used_stock_quantity?: number
        }
        Update: {
          average_cost?: number | null
          ca_expiration?: string | null
          ca_number?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          min_stock?: number
          model?: string | null
          name?: string
          organization_id?: string
          stock_quantity?: number
          updated_at?: string
          used_stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "epis_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "epi_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_functions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sector_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sector_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sector_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_functions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_functions_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_cnpjs: {
        Row: {
          created_at: string
          id: string
          organization_cnpj_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_cnpj_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_cnpj_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_cnpjs_organization_cnpj_id_fkey"
            columns: ["organization_cnpj_id"]
            isOneToOne: false
            referencedRelation: "organization_cnpjs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_cnpjs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_sectors: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          sector_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          sector_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_sectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
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
          created_at: string
          email: string | null
          epi_term_text: string | null
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
          created_at?: string
          email?: string | null
          epi_term_text?: string | null
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
          created_at?: string
          email?: string | null
          epi_term_text?: string | null
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
      plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_highlighted: boolean | null
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
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_function_epis: {
        Row: {
          created_at: string
          epi_id: string
          id: string
          job_function_id: string
          organization_id: string
          quantity: number
          sector_id: string
          updated_at: string
          validity_months: number
        }
        Insert: {
          created_at?: string
          epi_id: string
          id?: string
          job_function_id: string
          organization_id: string
          quantity?: number
          sector_id: string
          updated_at?: string
          validity_months?: number
        }
        Update: {
          created_at?: string
          epi_id?: string
          id?: string
          job_function_id?: string
          organization_id?: string
          quantity?: number
          sector_id?: string
          updated_at?: string
          validity_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "sector_function_epis_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_function_epis_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_function_epis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_function_epis_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
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
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_org_add_user: { Args: { _org_id: string }; Returns: boolean }
      check_password_is_not_repeated: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: boolean
      }
      check_user_has_history: { Args: { p_user_id: string }; Returns: boolean }
      cleanup_api_usage_log: { Args: never; Returns: undefined }
      get_manager_cnpj_ids: { Args: { _user_id: string }; Returns: string[] }
      get_org_max_users: { Args: { _org_id: string }; Returns: number }
      get_org_user_count: { Args: { _org_id: string }; Returns: number }
      get_super_admin_ids: { Args: never; Returns: string[] }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
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
      merge_epis: {
        Args: { _canonical_id: string; _duplicate_ids: string[] }
        Returns: Json
      }
      merge_job_functions: {
        Args: { _canonical_id: string; _duplicate_ids: string[] }
        Returns: Json
      }
      normalize_name: { Args: { input: string }; Returns: string }
      record_password_change: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "org_admin" | "manager"
      epi_delivery_status:
        | "delivered"
        | "returned"
        | "lost"
        | "damaged"
        | "awaiting_signature"
        | "discarded"
      org_status: "active" | "suspended" | "trial"
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
      app_role: ["super_admin", "org_admin", "manager"],
      epi_delivery_status: [
        "delivered",
        "returned",
        "lost",
        "damaged",
        "awaiting_signature",
        "discarded",
      ],
      org_status: ["active", "suspended", "trial"],
    },
  },
} as const

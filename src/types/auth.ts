import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "super_admin" | "org_admin" | "manager";

export type OrgStatus = "active" | "suspended" | "trial";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  plan: string | null;
  max_users: number | null;
  logo_url: string | null;
  cnpj: string | null;
  city: string | null;
  is_plan_managed: boolean | null;
  
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
  must_reset_password: boolean | null;
  hourly_rate: number | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  organization_id: string | null;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  organization: Organization | null;
  isLoading: boolean;
  isAuthReady: boolean;
}

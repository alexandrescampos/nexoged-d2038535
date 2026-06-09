import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, AppRole, Organization, AuthState } from "@/types/auth";
import { isPasswordExpired } from "@/utils/password-validation";

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  clearMustResetPassword: () => void;
  hasRole: (role: AppRole) => boolean;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) {
        if (profileData.is_active === false) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          setRoles([]);
          setOrganization(null);
          window.location.href = "/auth?error=account_disabled";
          return;
        }
        setProfile(profileData as Profile);

        // Check password expiration
        if (profileData.password_updated_at && isPasswordExpired(profileData.password_updated_at)) {
          setProfile(prev => prev ? { ...prev, must_reset_password: true } : null);
        }

        // Fetch organization if user has one
        if (profileData.organization_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", profileData.organization_id)
            .maybeSingle();

          if (orgData) {
            setOrganization(orgData as Organization);
          }
        }
      }

      // Fetch roles - filter by current organization (super_admin is global)
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role, organization_id")
        .eq("user_id", userId);

      const currentOrgId = profileData?.organization_id ?? null;
      const scopedRoles = (rolesData ?? []).filter((r: any) =>
        r.role === "super_admin" || r.organization_id === currentOrgId
      );

      if (scopedRoles.length > 0) {
        setRoles(scopedRoles.map((r: any) => r.role as AppRole));
      } else {
        // If user has no roles, they shouldn't be able to access the system
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        setRoles([]);
        setOrganization(null);
        window.location.href = "/auth?error=no_roles";
        return;
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // onAuthStateChange dispara INITIAL_SESSION automaticamente, então
    // ele cobre tanto o boot quanto mudanças subsequentes. Não chamamos
    // getSession() em paralelo para evitar duplicar fetchUserData e
    // condições de corrida que liberam isLoading=false antes dos roles.
    let currentUserId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // TOKEN_REFRESHED e SIGNED_IN são re-emitidos pelo Supabase quando a
          // aba volta ao foco (multi-aba/visibilitychange). Se é o mesmo
          // usuário já carregado, apenas atualizamos a session/user sem
          // remontar a árvore (que mostraria spinner em tela cheia, fecharia
          // diálogos e perderia scroll/estado local).
          const isSameUser = currentUserId === session.user.id;
          if (isSameUser && event !== "INITIAL_SESSION" && event !== "USER_UPDATED") {
            return;
          }
          currentUserId = session.user.id;
          // Marca como não-pronto enquanto carrega profile/roles do novo usuário
          setIsAuthReady(false);
          // Defer com setTimeout para evitar deadlock no callback do Supabase
          setTimeout(async () => {
            await fetchUserData(session.user.id);
            if (isMounted) {
              setIsAuthReady(true);
              setIsLoading(false);
            }
          }, 0);
        } else {
          currentUserId = null;
          setProfile(null);
          setRoles([]);
          setOrganization(null);
          setIsAuthReady(true);
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Log de auditoria para login
    if (error) {
      await supabase.from("user_audit_log").insert({
        action: "login_failed",
        source: "auth-login",
        method: "form",
        details: { email, error: error.message }
      });
    } else if (data.user) {
      await supabase.from("user_audit_log").insert({
        performed_by: data.user.id,
        target_user_id: data.user.id,
        action: "login",
        source: "auth-login",
        method: "form",
        details: { email }
      });
    }

    return { error };
  };



  const signOut = async () => {
    try {
      // Clear tabs from sessionStorage before logout
      sessionStorage.removeItem("dashboard_tabs");
      sessionStorage.removeItem("super_admin_tabs");
      
      // Clear query cache to prevent stale data from previous user
      queryClient.clear();
      
      await supabase.auth.signOut();
    } finally {
      // Always reset local state to prevent "auto login" UI flicker
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
      setOrganization(null);
      setIsAuthReady(true);
      setIsLoading(false);
    }
  };

  const clearMustResetPassword = () => {
    setProfile((prev) => (prev ? { ...prev, must_reset_password: false } : prev));
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const value: AuthContextType = {
    user,
    session,
    profile,
    roles,
    organization,
    isLoading,
    isAuthReady,
    signIn,
    signOut,
    clearMustResetPassword,
    hasRole,
    isSuperAdmin: hasRole("super_admin"),
    isOrgAdmin: hasRole("org_admin"),
    isManager: hasRole("manager"),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

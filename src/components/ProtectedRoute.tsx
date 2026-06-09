import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import type { AppRole } from "@/types/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
  requireAnyRole?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles = [], 
  requireAnyRole = false 
}: ProtectedRouteProps) {
  const { user, roles, isLoading, isAuthReady } = useAuth();

  // Aguarda o gate auth-ready: profile + roles carregados (ou ausência de sessão confirmada).
  // Sem isso, ProtectedRoute pode redirecionar prematuramente com roles=[] entre o
  // SIGNED_IN e a conclusão do fetchUserData, criando loop com /auth.
  if (isLoading || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If specific roles are required, check if user has any of them
  if (allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some((role) => roles.includes(role));
    if (!hasAllowedRole) {
      // Redirect to appropriate dashboard based on user's actual role
      if (roles.includes("super_admin")) {
        return <Navigate to="/super-admin" replace />;
      } else if (roles.includes("org_admin") || roles.includes("manager")) {
        return <Navigate to="/dashboard" replace />;
      } else {
        return <Navigate to="/" replace />;
      }
    }
  }

  // If requireAnyRole is true, user must have at least one role
  if (requireAnyRole && roles.length === 0) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { GedPermission } from "@/types/ged";
import { Loader2 } from "lucide-react";

interface PermissionGateProps {
  permission: GedPermission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Componente para proteger partes da UI baseada em permissões RBAC.
 */
export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { user, isSuperAdmin, isOrgAdmin, isUser } = useAuth();
  const { userPermissions, isLoading } = useUserPermissions(user?.id);

  if (isLoading) return null;

  // Super Admins e Org Admins têm todas as permissões.
  // Usuários comuns podem ter permissões padrão.
  const defaultUserPermissions: GedPermission[] = ["visualizar_documento"];

  const hasAccess =
    isSuperAdmin ||
    isOrgAdmin ||
    userPermissions.includes(permission) ||
    (isUser && defaultUserPermissions.includes(permission));

  if (!hasAccess) return <>{fallback}</>;

  return <>{children}</>;
}

interface PermissionProtectedRouteProps {
  permission: GedPermission;
  children: React.ReactNode;
}

/**
 * Componente para proteger rotas inteiras baseada em permissões RBAC.
 */
export function PermissionProtectedRoute({ permission, children }: PermissionProtectedRouteProps) {
  const { user, isSuperAdmin, isOrgAdmin, isUser, isAuthReady } = useAuth();
  const { userPermissions, isLoading } = useUserPermissions(user?.id);
  const location = useLocation();

  if (!isAuthReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Usuários comuns podem ter permissões padrão.
  const defaultUserPermissions: GedPermission[] = ["visualizar_documento"];

  const hasAccess =
    isSuperAdmin ||
    isOrgAdmin ||
    userPermissions.includes(permission) ||
    (isUser && defaultUserPermissions.includes(permission));

  if (!hasAccess) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

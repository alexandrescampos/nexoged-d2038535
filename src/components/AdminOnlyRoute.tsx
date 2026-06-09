import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AdminOnlyRouteProps {
  children: React.ReactNode;
  allowUser?: boolean;
}

export function AdminOnlyRoute({ children, allowUser = false }: AdminOnlyRouteProps) {
  const { isOrgAdmin, isUser, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  const hasAccess = isOrgAdmin || (allowUser && isUser);
  
  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AdminOnlyRouteProps {
  children: React.ReactNode;
  allowManager?: boolean;
}

export function AdminOnlyRoute({ children, allowManager = false }: AdminOnlyRouteProps) {
  const { isOrgAdmin, isManager, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  const hasAccess = isOrgAdmin || (allowManager && isManager);
  
  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Search, Loader2 } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";

const ACTION_LABELS: Record<string, string> = {
  created: "Criado",
  deactivated: "Desativado",
  reactivated: "Reativado",
  role_changed: "Role alterada",
  password_reset: "Senha redefinida",
  login: "Login",
  logout: "Logout",
  login_failed: "Falha de Login",
};

const SOURCE_LABELS: Record<string, string> = {
  "create-org-user": "Admin da Org",
  "create-user": "Super Admin",
  "register-organization": "Auto-registro",
  "employee-import": "Importação",
  "self-signup": "Cadastro próprio",
};

function getActionBadgeVariant(action: string) {
  switch (action) {
    case "created": return "default";
    case "deactivated": return "destructive";
    case "reactivated": return "secondary";
    case "login": return "outline";
    case "login_failed": return "destructive";
    default: return "outline";
  }
}

export default function UserAuditLog() {
  const { organization, isSuperAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["user-audit-log", organization?.id, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("user_audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!isSuperAdmin && organization?.id) {
        query = query.eq("organization_id", organization.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id || isSuperAdmin,
  });

  // Fetch profiles for display names
  const userIds = [...new Set(logs.flatMap((l: any) => [l.target_user_id, l.performed_by].filter(Boolean)))];
  
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["audit-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      const map: Record<string, { email: string; full_name: string }> = {};
      (data || []).forEach((p) => {
        map[p.id] = { email: p.email || "—", full_name: p.full_name || "—" };
      });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const filteredLogs = logs.filter((log: any) => {
    const target = profilesMap[log.target_user_id];
    const performer = profilesMap[log.performed_by];
    const matchesSearch = !searchTerm || 
      target?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      target?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      performer?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesSource = sourceFilter === "all" || log.source === sourceFilter;
    return matchesSearch && matchesAction && matchesSource;
  });

  const {
    paginatedItems,
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,
    setPageSize,
    totalItems,
  } = usePagination(filteredLogs, { pageSize: 15 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          Log de Auditoria
        </CardTitle>
        <CardDescription>
          Histórico de criação e alteração de usuários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ações</SelectItem>
              <SelectItem value="created">Criado</SelectItem>
              <SelectItem value="deactivated">Desativado</SelectItem>
               <SelectItem value="reactivated">Reativado</SelectItem>
               <SelectItem value="role_changed">Role alterada</SelectItem>
               <SelectItem value="password_reset">Senha redefinida</SelectItem>
               <SelectItem value="login">Login</SelectItem>
               <SelectItem value="logout">Logout</SelectItem>
               <SelectItem value="login_failed">Falha de Login</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="create-org-user">Admin da Org</SelectItem>
              <SelectItem value="create-user">Super Admin</SelectItem>
              <SelectItem value="register-organization">Auto-registro</SelectItem>
              <SelectItem value="self-signup">Cadastro próprio</SelectItem>
              <SelectItem value="employee-import">Importação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum registro encontrado.
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Usuário Alvo</TableHead>
                    <TableHead>Executado Por</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((log: any) => {
                    const target = profilesMap[log.target_user_id];
                    const performer = profilesMap[log.performed_by];
                    const details = log.details || {};
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(log.created_at).toLocaleDateString("pt-BR")}{" "}
                          <span className="text-muted-foreground">
                            {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action) as any}>
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{target?.full_name || "—"}</p>
                            <p className="text-muted-foreground text-xs">{target?.email || details.email || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{performer?.full_name || "—"}</p>
                            <p className="text-muted-foreground text-xs">{performer?.email || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {SOURCE_LABELS[log.source] || log.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {details.role && `Role: ${details.role}`}
                          {details.organization_name && ` | Org: ${details.organization_name}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              totalItems={totalItems}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

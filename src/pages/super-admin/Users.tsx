import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordRequirementsHint } from "@/components/PasswordRequirementsHint";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Users, Search, Loader2, Shield, UserPlus, Pencil, KeyRound, Trash2 } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { Checkbox } from "@/components/ui/checkbox";
import type { Profile, AppRole, Organization } from "@/types/auth";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  org_admin: "Admin Org",
  user: "Usuário",
};

const roleColors: Record<AppRole, string> = {
  super_admin: "bg-primary/10 text-primary border-primary/20",
  org_admin: "bg-info/10 text-info border-info/20",
  user: "bg-green-500/10 text-green-600 border-green-500/20",
};

interface UserWithRoles extends Profile {
  roles: AppRole[];
  organization_name?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [filterOrgId, setFilterOrgId] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("user");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);

  // Domain bulk cleanup
  const [isDomainCleanupOpen, setIsDomainCleanupOpen] = useState(false);
  const [cleanupDomain, setCleanupDomain] = useState("tuamaeaquelaursa.com");
  const [cleanupPreview, setCleanupPreview] = useState<Array<{ id: string; email: string | null; full_name: string | null }>>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Edit user form state
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editOrgId, setEditOrgId] = useState<string>("");
  
  
  // Reset password form state
  const [resetPassword, setResetPassword] = useState("");
  const [mustResetOnLogin, setMustResetOnLogin] = useState(true);
  
  const { toast } = useToast();

  // Create user form state
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserRole, setNewUserRole] = useState<AppRole>("user");
  const [newUserOrgId, setNewUserOrgId] = useState<string>("");
  

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchOrganizations = async () => {
    const { data, error } = await supabase.from("organizations").select("*");
    if (!error && data) {
      setOrganizations(data as Organization[]);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);

    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    // If filtering by role, first get matching user IDs
    let roleFilteredUserIds: string[] | null = null;
    if (filterRole) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", filterRole as "super_admin" | "org_admin" | "manager");
      roleFilteredUserIds = (roleData || []).map((r: any) => r.user_id);
      if (roleFilteredUserIds.length === 0) {
        setUsers([]);
        setTotalCount(0);
        setIsLoading(false);
        return;
      }
    }

    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (debouncedSearch) {
      query = query.or(`full_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
    }

    if (filterOrgId) {
      query = query.eq("organization_id", filterOrgId);
    }

    if (roleFilteredUserIds) {
      query = query.in("id", roleFilteredUserIds);
    }

    const { data: profilesData, error: profilesError, count } = await query.range(from, to);

    if (profilesError) {
      toast({ variant: "destructive", title: "Erro ao carregar usuários", description: profilesError.message });
      setIsLoading(false);
      return;
    }

    setTotalCount(count || 0);

    // Fetch roles only for users on current page
    const userIds = (profilesData || []).map((p: any) => p.id);
    let rolesMap = new Map<string, AppRole[]>();

    if (userIds.length > 0) {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("*")
        .in("user_id", userIds);

      (rolesData || []).forEach((r: any) => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role as AppRole);
        rolesMap.set(r.user_id, existing);
      });
    }

    const usersWithRoles: UserWithRoles[] = (profilesData || []).map((p: any) => ({
      ...p,
      roles: rolesMap.get(p.id) || [],
      organization_name: organizations.find((o) => o.id === p.organization_id)?.name,
    }));

    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (organizations.length > 0 || debouncedSearch !== "" || currentPage > 1) {
      fetchData();
    }
  }, [currentPage, debouncedSearch, organizations, itemsPerPage, filterOrgId, filterRole]);

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Initial fetch
  useEffect(() => {
    if (organizations.length > 0) {
      fetchData();
    }
  }, [organizations]);

  const openRoleDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRole("user");
    setSelectedOrgId(user.organization_id || "");
    setIsRoleDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);
    try {
      const { error } = await invokeEdgeFunction("delete-user", {
        user_id: userToDelete.id,
      });

      if (error) {
        if (error.message?.includes("HISTORY_EXISTS")) {
          toast({
            title: "Não é possível excluir",
            description: "Este usuário possui histórico no sistema e não pode ser removido.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Usuário excluído",
        description: "O usuário foi removido com sucesso.",
      });

      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o usuário.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const sanitizeDomain = (raw: string) =>
    raw.trim().toLowerCase().replace(/^@+/, "").replace(/\/+$/, "");

  const loadDomainPreview = async (domain: string) => {
    const clean = sanitizeDomain(domain);
    if (!clean || !clean.includes(".")) {
      setCleanupPreview([]);
      return;
    }
    setIsLoadingPreview(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .ilike("email", `%@${clean}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCleanupPreview(data || []);
    } catch (err: any) {
      toast({
        title: "Erro ao buscar usuários",
        description: err.message || "Falha ao carregar pré-visualização.",
        variant: "destructive",
      });
      setCleanupPreview([]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const openDomainCleanup = () => {
    setIsDomainCleanupOpen(true);
    loadDomainPreview(cleanupDomain);
  };

  const handleDomainCleanup = async () => {
    if (cleanupPreview.length === 0) return;
    setIsCleaningUp(true);
    let deleted = 0;
    const failures: Array<{ email: string; reason: string }> = [];
    for (const u of cleanupPreview) {
      try {
        const { error } = await invokeEdgeFunction("delete-user", { user_id: u.id });
        if (error) {
          const msg = error.message?.includes("HISTORY_EXISTS")
            ? "Possui histórico no sistema"
            : error.message || "Erro desconhecido";
          failures.push({ email: u.email || u.id, reason: msg });
        } else {
          deleted++;
        }
      } catch (err: any) {
        failures.push({ email: u.email || u.id, reason: err.message || "Erro" });
      }
    }
    setIsCleaningUp(false);
    toast({
      title: `${deleted} usuário(s) excluído(s)`,
      description:
        failures.length > 0
          ? `${failures.length} falharam: ${failures.slice(0, 3).map((f) => f.email).join(", ")}${failures.length > 3 ? "…" : ""}`
          : "Limpeza concluída com sucesso.",
      variant: failures.length > 0 ? "destructive" : "default",
    });
    setIsDomainCleanupOpen(false);
    setCleanupPreview([]);
    fetchData();
  };


  const openEditDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setEditFullName(user.full_name || "");
    setEditEmail(user.email || "");
    setEditOrgId(user.organization_id || "__none__");
    
    setIsEditDialogOpen(true);
  };

  const openResetPasswordDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setResetPassword("");
    setMustResetOnLogin(true);
    setIsResetPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(resetPassword)) {
      toast({
        variant: "destructive",
        title: "Senha inválida",
        description: "A senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-org-user-password', {
        body: {
          userId: selectedUser.id,
          newPassword: resetPassword,
          mustResetOnLogin: mustResetOnLogin,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({ 
        title: "Senha redefinida com sucesso",
        description: data?.message || (mustResetOnLogin 
          ? "O usuário precisará criar uma nova senha no próximo login." 
          : "A nova senha já está ativa.")
      });
      setIsResetPasswordDialogOpen(false);
      setResetPassword("");
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast({ 
        variant: "destructive", 
        title: "Erro ao redefinir senha", 
        description: error.message 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    if (!editFullName.trim()) {
      toast({ variant: "destructive", title: "Nome é obrigatório" });
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editFullName.trim(),
        organization_id: editOrgId === "__none__" ? null : editOrgId,
        
      })
      .eq("id", selectedUser.id);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar usuário", description: error.message });
    } else {
      toast({ title: "Usuário atualizado com sucesso" });
      setIsEditDialogOpen(false);
      fetchData();
    }
    setIsSaving(false);
  };

  const handleAddRole = async () => {
    if (!selectedUser) return;

    // super_admin doesn't need org
    if (selectedRole !== "super_admin" && !selectedOrgId) {
      toast({ variant: "destructive", title: "Selecione uma organização" });
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.from("user_roles").insert({
      user_id: selectedUser.id,
      role: selectedRole,
      organization_id: selectedRole === "super_admin" ? null : selectedOrgId,
    });

    if (error) {
      if (error.message.includes("duplicate")) {
        toast({ variant: "destructive", title: "Usuário já possui esta role" });
      } else {
        toast({ variant: "destructive", title: "Erro ao adicionar role", description: error.message });
      }
    } else {
      // Update organization_id on profile if needed
      if (selectedOrgId && !selectedUser.organization_id) {
        await supabase.from("profiles").update({ organization_id: selectedOrgId }).eq("id", selectedUser.id);
      }
      toast({ title: "Role adicionada com sucesso" });
      setIsRoleDialogOpen(false);
      fetchData();
    }
    setIsSaving(false);
  };

  const handleRemoveRole = async (user: UserWithRoles, role: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .eq("role", role);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao remover role", description: error.message });
    } else {
      toast({ title: "Role removida" });
      fetchData();
    }
  };

  const handleToggleActive = async (user: UserWithRoles) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !user.is_active })
      .eq("id", user.id);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao alterar status", description: error.message });
    } else {
      toast({ title: user.is_active ? "Usuário desativado" : "Usuário ativado" });
      fetchData();
    }
  };

  const resetCreateForm = () => {
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserFullName("");
    setNewUserRole("user");
    setNewUserOrgId("");
    
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim() || !newUserFullName.trim()) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }

    if (newUserRole !== "super_admin" && !newUserOrgId) {
      toast({ variant: "destructive", title: "Selecione uma organização" });
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newUserPassword)) {
      toast({
        variant: "destructive",
        title: "Senha inválida",
        description: "A senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { data, error } = await invokeEdgeFunction<any>('create-user', {
        email: newUserEmail.trim(),
        password: newUserPassword,
        fullName: newUserFullName.trim(),
        role: newUserRole,
        organizationId: newUserRole === 'super_admin' ? null : newUserOrgId,
      });

      if (error) throw error;

      toast({ title: "Usuário criado com sucesso" });
      setIsCreateDialogOpen(false);
      resetCreateForm();
      fetchData();
    } catch (error: any) {
      console.error("Create user error:", error);
      toast({ 
        variant: "destructive", 
        title: "Erro ao criar usuário", 
        description: error.message 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string | null) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const saUserSort = useTableSort(users);
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const getVisiblePages = () => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (Math.abs(i - currentPage) <= 2 || i === 1 || i === totalPages) {
        pages.push(i);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
        <p className="text-muted-foreground">Gerencie todos os usuários do sistema</p>
      </div>

      <Card>
        <CardHeader>
           <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterOrgId} onValueChange={(v) => { setFilterOrgId(v === "__all__" ? "" : v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas organizações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas organizações</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={(v) => { setFilterRole(v === "__all__" ? "" : v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os tipos</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="org_admin">Admin Org</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{totalCount} usuário(s)</p>
              <Button variant="outline" onClick={openDomainCleanup}>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar por Domínio
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum usuário encontrado</h3>
              <p className="text-sm text-muted-foreground">Usuários aparecerão aqui após cadastro</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead field="full_name" sortField={saUserSort.sortField} sortDirection={saUserSort.sortDirection} onSort={saUserSort.handleSort}>Usuário</SortableTableHead>
                    <SortableTableHead field="organization_name" sortField={saUserSort.sortField} sortDirection={saUserSort.sortDirection} onSort={saUserSort.handleSort}>Organização</SortableTableHead>
                    
                    <TableHead>Roles</TableHead>
                    <SortableTableHead field="is_active" sortField={saUserSort.sortField} sortDirection={saUserSort.sortDirection} onSort={saUserSort.handleSort}>Status</SortableTableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saUserSort.sortedItems.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name || "Sem nome"}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.organization_name || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length === 0 ? (
                            <span className="text-sm text-muted-foreground">Sem roles</span>
                          ) : (
                            user.roles.map((role) => (
                              <Badge key={role} variant="outline" className={roleColors[role]}>
                                {roleLabels[role]}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={user.is_active ? "bg-success/10 text-success" : "bg-muted"}>
                          {user.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar Dados
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetPasswordDialog(user)}>
                              <KeyRound className="mr-2 h-4 w-4" />
                              Redefinir Senha
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRoleDialog(user)}>
                              <Shield className="mr-2 h-4 w-4" />
                              Adicionar Role
                            </DropdownMenuItem>
                            {user.roles.map((role) => (
                              <DropdownMenuItem
                                key={role}
                                onClick={() => handleRemoveRole(user, role)}
                                className="text-destructive"
                              >
                                Remover {roleLabels[role]}
                              </DropdownMenuItem>
                            ))}
                             <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                               {user.is_active ? "Desativar" : "Ativar"} Usuário
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                               onClick={() => {
                                 setUserToDelete(user);
                                 setIsDeleteDialogOpen(true);
                               }}
                               className="text-destructive"
                             >
                               Excluir Usuário
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalCount > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Itens por página:</span>
                      <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {getVisiblePages().map((page, idx, arr) => (
                          <PaginationItem key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="px-2">...</span>
                            )}
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Role</DialogTitle>
            <DialogDescription>
              Adicione uma nova role para {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="org_admin">Admin Org</SelectItem>
                  <SelectItem value="manager">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedRole !== "super_admin" && (
              <div className="grid gap-2">
                <Label htmlFor="org">Organização</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma organização" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddRole} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie um novo usuário no sistema</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newFullName">Nome Completo *</Label>
              <Input
                id="newFullName"
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newEmail">E-mail *</Label>
              <Input
                id="newEmail"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Senha *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Crie uma senha forte"
              />
              <PasswordRequirementsHint password={newUserPassword} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newRole">Role</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="org_admin">Admin Org</SelectItem>
                  <SelectItem value="manager">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newUserRole !== "super_admin" && (
              <div className="grid gap-2">
                <Label htmlFor="newOrg">Organização *</Label>
                <Select value={newUserOrgId} onValueChange={setNewUserOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma organização" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize os dados do usuário</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editFullName">Nome Completo *</Label>
              <Input
                id="editFullName"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editEmail">E-mail</Label>
              <Input id="editEmail" value={editEmail} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editOrg">Organização</Label>
              <Select value={editOrgId} onValueChange={setEditOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma organização" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditUser} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="resetPassword">Nova Senha *</Label>
              <Input
                id="resetPassword"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Crie uma senha forte"
              />
              <PasswordRequirementsHint password={resetPassword} />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mustReset"
                checked={mustResetOnLogin}
                onCheckedChange={(checked) => setMustResetOnLogin(checked === true)}
              />
              <Label htmlFor="mustReset" className="text-sm font-normal">
                Exigir que o usuário altere a senha no próximo login
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redefinir Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente o usuário <strong>{userToDelete?.full_name || userToDelete?.email}</strong>.
              <br /><br />
              <em>Nota: Somente usuários sem histórico de ações (entregas, solicitações, etc.) podem ser excluídos.</em>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteUser();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingUser}
            >
              {isDeletingUser ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Confirmar Exclusão"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDomainCleanupOpen} onOpenChange={(o) => !isCleaningUp && setIsDomainCleanupOpen(o)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpeza em lote por domínio</AlertDialogTitle>
            <AlertDialogDescription>
              Exclua todos os usuários cujo e-mail termina com o domínio informado. Usuários com histórico (entregas, solicitações, termos) serão ignorados.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="cleanup-domain">Domínio</Label>
              <div className="flex gap-2">
                <Input
                  id="cleanup-domain"
                  value={cleanupDomain}
                  onChange={(e) => setCleanupDomain(e.target.value)}
                  placeholder="exemplo.com"
                  disabled={isCleaningUp}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => loadDomainPreview(cleanupDomain)}
                  disabled={isLoadingPreview || isCleaningUp}
                >
                  {isLoadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>
            </div>

            <div className="border rounded-md max-h-64 overflow-y-auto">
              {isLoadingPreview ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
              ) : cleanupPreview.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado para este domínio.
                </div>
              ) : (
                <ul className="divide-y">
                  {cleanupPreview.map((u) => (
                    <li key={u.id} className="px-3 py-2 text-sm">
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-muted-foreground text-xs">{u.email}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cleanupPreview.length > 0 && (
              <p className="text-sm text-destructive font-medium">
                {cleanupPreview.length} usuário(s) serão excluídos. Esta ação é irreversível.
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleaningUp}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDomainCleanup();
              }}
              disabled={isCleaningUp || cleanupPreview.length === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCleaningUp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                `Excluir ${cleanupPreview.length} usuário(s)`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
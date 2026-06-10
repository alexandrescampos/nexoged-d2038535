import { useState, useEffect, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { invokeEdgeFunction } from "@/lib/invokeEdge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordRequirementsHint } from "@/components/PasswordRequirementsHint";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, UserPlus, Shield, ShieldCheck, Pencil, Loader2, KeyRound, AlertCircle, Building2, Trash2, FileText } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCNPJ } from "@/lib/cnpj";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Link } from "react-router-dom";
import type { Profile, AppRole } from "@/types/auth";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

export default function OrgUsersPage() {
  const { organization, isOrgAdmin, session } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "org_admin" | "user" | "none">("all");
  
  // Add user dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = usePersistedState("users:isAddDialogOpen", false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = usePersistedState("users:newUserEmail", "");
  const [newUserName, setNewUserName] = usePersistedState("users:newUserName", "");
  const [newUserPassword, setNewUserPassword] = usePersistedState("users:newUserPassword", "");
  const [newUserRole, setNewUserRole] = usePersistedState<AppRole>("users:newUserRole", "user");
  
  // Role removal confirmation state
  const [roleRemovalConfirm, setRoleRemovalConfirm] = useState<{ userId: string; role: AppRole } | null>(null);


  // Edit user dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = usePersistedState("users:isEditDialogOpen", false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUser, setEditingUser] = usePersistedState<UserWithRoles | null>("users:editingUser", null);
  const [editUserName, setEditUserName] = usePersistedState("users:editUserName", "");
  const [editUserDeptId, setEditUserDeptId] = useState<string | null>(null);
  const [editUserPermissions, setEditUserPermissions] = useState<string[]>([]);

  // Role dialog state
  const [isRoleDialogOpen, setIsRoleDialogOpen] = usePersistedState("users:isRoleDialogOpen", false);
  const [roleDialogUser, setRoleDialogUser] = usePersistedState<UserWithRoles | null>("users:roleDialogUser", null);

  // Reset password dialog state
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = usePersistedState("users:isResetPasswordDialogOpen", false);
  const [resetPasswordUser, setResetPasswordUser] = usePersistedState<UserWithRoles | null>("users:resetPasswordUser", null);
  const [tempPassword, setTempPassword] = usePersistedState("users:tempPassword", "");
  const [mustResetOnLogin, setMustResetOnLogin] = usePersistedState("users:mustResetOnLogin", true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [selectedRole, setSelectedRole] = usePersistedState<AppRole>("users:selectedRole", "user");
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [userToDelete, setUserToDelete] = usePersistedState<UserWithRoles | null>("users:userToDelete", null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = usePersistedState("users:isDeleteDialogOpen", false);

  // Manager CNPJ association state
  const [editUserCnpjIds, setEditUserCnpjIds] = useState<string[]>([]);
  const [newUserCnpjIds, setNewUserCnpjIds] = useState<string[]>([]);
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>(["visualizar_documento"]);
  const [newUserDeptId, setNewUserDeptId] = useState<string | null>(null);



  // Fetch org CNPJs
  const { data: orgCnpjs = [] } = useQuery({
    queryKey: ["organization-cnpjs-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_cnpjs")
        .select("id, cnpj, company_name")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("is_main", { ascending: false })
        .order("company_name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Fetch org Departments
  const { data: orgDepartments = [] } = useQuery({
    queryKey: ["departments-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("dept_id, dept_nm_departamento")
        .eq("organization_id", organization!.id)
        .eq("dept_in_ativo", true)
        .order("dept_nm_departamento");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Calcular se atingiu o limite de usuários
  const activeUsersCount = users.filter(u => u.is_active !== false).length;
  const maxUsers = organization?.max_users || 0;
  const isUserLimitReached = maxUsers > 0 && activeUsersCount >= maxUsers;

  useEffect(() => {
    if (organization?.id) {
      fetchUsers();
    }
  }, [organization?.id]);

  const fetchUsers = async () => {
    if (!organization?.id) return;
    
    try {
      setLoading(true);
      
      // Fetch profiles from the organization
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", organization.id);

      if (profilesError) throw profilesError;

      // Fetch super_admin user IDs to exclude them from the list
      const { data: superAdminIdsList } = await supabase.rpc('get_super_admin_ids');

      const superAdminIds = new Set((superAdminIdsList || []) as string[]);

      // Filter out super_admins from profiles
      const filteredProfiles = (profiles || []).filter(p => !superAdminIds.has(p.id));

      // Fetch roles for each user
      const usersWithRoles: UserWithRoles[] = await Promise.all(
        filteredProfiles.map(async (profile) => {
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .eq("organization_id", organization.id);

          return {
            ...profile,
            roles: (rolesData || []).map((r) => r.role as AppRole),
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserName || !newUserPassword) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para criar o usuário.",
        variant: "destructive",
      });
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newUserPassword)) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingUser(true);
    try {
      const { data, error } = await invokeEdgeFunction<any>("create-org-user", {
        email: newUserEmail,
        password: newUserPassword,
        fullName: newUserName,
        role: newUserRole,
        cnpjIds: newUserCnpjIds,
        departmentId: newUserDeptId,
        permissions: newUserPermissions,
      });

      if (error) throw error;

      toast({
        title: "Usuário criado",
        description: `${newUserName} foi adicionado à organização.`,
      });

      // Reset form and close dialog
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setNewUserRole("user");
      
      setNewUserCnpjIds([]);
      setNewUserPermissions(["visualizar_documento"]);
      setNewUserDeptId(null);
      setIsAddDialogOpen(false);

      // Refresh user list
      fetchUsers();

    } catch (error: any) {
      console.error("Error creating user:", error);
      const msg = error.message || "";
      let description = "Não foi possível criar o usuário.";
      if (msg.includes("already been registered") || msg.includes("email_exists")) {
        description = "Já existe um usuário cadastrado com este email.";
      } else if (msg) {
        description = msg;
      }
      toast({
        title: "Erro ao criar usuário",
        description,
        variant: "destructive",
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser || !editUserName.trim()) return;

    setIsEditingUser(true);
    try {
      // 1. Update Profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          full_name: editUserName.trim(),
          department_id: editUserDeptId,
        })
        .eq("id", editingUser.id);

      if (profileError) throw profileError;

      // 2. Update Permissions
      if (organization?.id) {
        // Remove existing
        const { error: delPermError } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", editingUser.id)
          .eq("organization_id", organization.id);
        
        if (delPermError) throw delPermError;

        // Add new
        if (editUserPermissions.length > 0) {
          const permInserts = editUserPermissions.map(p => ({
            user_id: editingUser.id,
            permission: p as any,
            organization_id: organization.id
          }));
          const { error: insPermError } = await supabase
            .from("user_permissions")
            .insert(permInserts);
          
          if (insPermError) throw insPermError;
        }
      }

      // 3. Save CNPJ scope
      const isUserRole = editingUser.roles.includes("user");
      const isAdminUser = editingUser.roles.includes("org_admin");
      if ((isUserRole || isAdminUser) && organization?.id) {
        const { error: delErr } = await supabase
          .from("manager_cnpjs" as any)
          .delete()
          .eq("user_id", editingUser.id)
          .eq("organization_id", organization.id);
        if (delErr) throw delErr;

        if (editUserCnpjIds.length > 0) {
          const cnpjInserts = editUserCnpjIds.map(cnpjId => ({
            user_id: editingUser.id,
            organization_cnpj_id: cnpjId,
            organization_id: organization.id,
          }));
          const { error: insErr } = await supabase.from("manager_cnpjs" as any).insert(cnpjInserts);
          if (insErr) throw insErr;
        }
      }

      toast({
        title: "Usuário atualizado",
        description: "Dados do usuário atualizados com sucesso.",
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o usuário.",
        variant: "destructive",
      });
    } finally {
      setIsEditingUser(false);
    }
  };

  const openEditDialog = async (user: UserWithRoles) => {
    setEditingUser(user);
    setEditUserName(user.full_name || "");
    setEditUserDeptId(user.department_id || null);
    setEditUserCnpjIds([]);
    setEditUserPermissions([]);
    
    setIsEditDialogOpen(true);

    if (organization?.id) {
      // Fetch CNPJ scope
      const isUserRole = user.roles.includes("user");
      const isAdminUser = user.roles.includes("org_admin");
      if (isUserRole || isAdminUser) {
        const cnpjRes = await supabase
          .from("manager_cnpjs" as any)
          .select("organization_cnpj_id")
          .eq("user_id", user.id)
          .eq("organization_id", organization.id);
        if (cnpjRes.data) {
          setEditUserCnpjIds((cnpjRes.data as any[]).map((r: any) => r.organization_cnpj_id));
        }
      }

      // Fetch permissions
      const { data: permsData } = await supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", user.id)
        .eq("organization_id", organization.id);
      
      if (permsData) {
        setEditUserPermissions(permsData.map(p => p.permission as string));
      }
    }
  };


  const openRoleDialog = (user: UserWithRoles) => {
    setRoleDialogUser(user);
    setSelectedRole("user");
    setIsRoleDialogOpen(true);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean | null) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_active: !currentStatus })
        .eq("id", userId)
        .select("id");

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "Erro",
          description: "Sem permissão para alterar o status deste usuário.",
          variant: "destructive",
        });
        return;
      }

      setUsers(users.map((u) => 
        u.id === userId ? { ...u, is_active: !currentStatus } : u
      ));

      toast({
        title: "Sucesso",
        description: `Usuário ${!currentStatus ? "ativado" : "desativado"} com sucesso.`,
      });
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do usuário.",
        variant: "destructive",
      });
    }
  };

  const addRoleToUser = async (userId: string, role: AppRole) => {
    if (!organization?.id) return;

    try {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: role,
        organization_id: organization.id,
      });

      if (error) throw error;

      await fetchUsers();
      setIsRoleDialogOpen(false);
      toast({
        title: "Sucesso",
        description: `Role ${role} adicionada com sucesso.`,
      });
    } catch (error: any) {
      console.error("Error adding role:", error);
      toast({
        title: "Erro",
        description: error.message?.includes("duplicate") 
          ? "O usuário já possui essa role." 
          : "Não foi possível adicionar a role.",
        variant: "destructive",
      });
    }
  };

  const removeRoleFromUser = async (userId: string, role: AppRole) => {
    if (!organization?.id) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role)
        .eq("organization_id", organization.id);

      if (error) throw error;

      await fetchUsers();
      toast({
        title: "Sucesso",
        description: `Role ${role} removida com sucesso.`,
      });
    } catch (error) {
      console.error("Error removing role:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a role.",
        variant: "destructive",
      });
    }
  };

  const openResetPasswordDialog = (user: UserWithRoles) => {
    setResetPasswordUser(user);
    setTempPassword("");
    setMustResetOnLogin(true);
    setIsResetPasswordDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !session?.user?.id) return;
    
    if (userToDelete.id === session.user.id) {
      toast({
        title: "Operação não permitida",
        description: "Você não pode excluir seu próprio usuário.",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingUser(true);
    try {
      const { error } = await invokeEdgeFunction("delete-user", {
        user_id: userToDelete.id
      });

      if (error) {
        // Se o erro for de histórico, mostrar mensagem amigável
        if (error.message?.includes("HISTORY_EXISTS") || (error as any).error === "HISTORY_EXISTS") {
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
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Ocorreu um erro inesperado ao excluir o usuário.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !tempPassword) {
      toast({
        title: "Campo obrigatório",
        description: "Digite a nova senha temporária.",
        variant: "destructive",
      });
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(tempPassword)) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-org-user-password", {
        body: {
          userId: resetPasswordUser.id,
          newPassword: tempPassword,
          mustResetOnLogin: mustResetOnLogin,
        },
      });

      if (error) {
        let errorMessage = "Não foi possível redefinir a senha.";
        
        if (error instanceof FunctionsHttpError) {
          try {
            const errorContext = await error.context.json();
            errorMessage = errorContext.error || errorMessage;
          } catch (e) {
            errorMessage = error.message || errorMessage;
          }
        } else {
          errorMessage = error.message || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      if (data.error) throw new Error(data.error);

      toast({
        title: "Senha redefinida",
        description: data.message || "A senha foi redefinida com sucesso.",
      });

      setIsResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      setTempPassword("");
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        title: "Erro ao redefinir senha",
        description: error.message || "Não foi possível redefinir a senha.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const { sortedItems: sortedUsers, sortField, sortDirection, handleSort } = useTableSort(users);

  const filteredUsers = sortedUsers.filter((user) => {
    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole =
      roleFilter === "all"
        ? true
        : roleFilter === "none"
        ? !user.roles || user.roles.length === 0
        : user.roles?.includes(roleFilter as AppRole);
    return matchesSearch && matchesRole;
  });

  const userPag = usePagination(filteredUsers);


  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case "org_admin":
        return (
          <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        );
      case "user":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <Shield className="h-3 w-3 mr-1" />
            Usuário
          </Badge>
        );
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários da Organização</h1>
        <p className="text-muted-foreground">
          Gerencie os usuários e permissões da sua organização
        </p>
      </div>

      {isUserLimitReached && isOrgAdmin && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
           <AlertTitle>Limite de funcionários atingido</AlertTitle>
           <AlertDescription>
             Sua organização atingiu o limite de {maxUsers} funcionário(s) do plano atual.{" "}
            <Link 
              to="/dashboard/billing" 
              className="underline font-medium hover:opacity-80"
            >
              Atualize seu plano
            </Link>{" "}
            para adicionar mais usuários.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle>Equipe</CardTitle>
              <CardDescription>
                {filteredUsers.length} usuário(s) encontrado(s)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  className="pl-10 w-full sm:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo de usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                   <SelectItem value="org_admin">Administrador</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>

                  <SelectItem value="none">Sem role</SelectItem>
                </SelectContent>
              </Select>
              {isOrgAdmin && (
                <div className="flex items-center gap-3">
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={isUserLimitReached ? 0 : -1}>
                            <Button
                              onClick={() => setIsAddDialogOpen(true)}
                              disabled={isUserLimitReached}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Novo Usuário
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {isUserLimitReached && (
                          <TooltipContent>
                            <p>
                              Limite de funcionários atingido.{" "}
                              <Link 
                                to="/dashboard/billing" 
                                className="underline font-medium"
                              >
                                Atualize seu plano
                              </Link>{" "}
                              para adicionar mais.
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Adicionar Usuário</DialogTitle>
                      <DialogDescription>
                        Crie um novo usuário para sua organização
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-user-name">Nome Completo</Label>
                        <Input
                          id="new-user-name"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="João da Silva"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-user-email">Email</Label>
                        <Input
                          id="new-user-email"
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="joao@empresa.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-user-password">Senha Temporária</Label>
                        <Input
                          id="new-user-password"
                          type="password"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          placeholder="Crie uma senha forte"
                        />
                        <PasswordRequirementsHint password={newUserPassword} />
                      </div>
                      <div className="space-y-2">
                        <Label>Função</Label>
                        <Select
                          value={newUserRole}
                          onValueChange={(v) => setNewUserRole(v as AppRole)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="org_admin">Administrador</SelectItem>
                            <SelectItem value="user">Usuário</SelectItem>
                          </SelectContent>
                        </Select>
                    </div>

                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateUser} disabled={isCreatingUser}>
                        {isCreatingUser ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          "Criar Usuário"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando usuários...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead field="full_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Usuário</SortableTableHead>
                  <SortableTableHead field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Email</SortableTableHead>
                  <TableHead>Roles</TableHead>
                  <SortableTableHead field="is_active" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                  {isOrgAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {userPag.paginatedItems.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.full_name || "Sem nome"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <div key={role} className="flex items-center gap-1">
                              {getRoleBadge(role)}
                              {isOrgAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    if (role === "org_admin") {
                                      setRoleRemovalConfirm({ userId: user.id, role });
                                    } else {
                                      removeRoleFromUser(user.id, role);
                                    }
                                  }}
                                >
                                  ×
                                </Button>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">Sem role</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {isOrgAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            title="Editar usuário"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openResetPasswordDialog(user)}
                            title="Redefinir senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUserToDelete(user);
                              setIsDeleteDialogOpen(true);
                            }}
                            title="Excluir usuário"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRoleDialog(user)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Role
                          </Button>
                          <Switch
                            checked={user.is_active ?? true}
                            onCheckedChange={() => toggleUserStatus(user.id, user.is_active)}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination currentPage={userPag.currentPage} totalPages={userPag.totalPages} totalItems={userPag.totalItems} pageSize={userPag.pageSize} onPageChange={userPag.setCurrentPage} onPageSizeChange={userPag.setPageSize} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações de {editingUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-user-name">Nome Completo</Label>
              <Input
                id="edit-user-name"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editingUser?.email || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={editUserDeptId || "none"}
                onValueChange={(v) => setEditUserDeptId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {orgDepartments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissões Granulares</Label>
              <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                {[
                  { id: "visualizar_documento", label: "Visualizar" },
                  { id: "inserir_documento", label: "Inserir" },
                  { id: "editar_documento", label: "Editar" },
                  { id: "excluir_documento", label: "Excluir" },
                  { id: "assinar_documento", label: "Assinar" },
                  { id: "administrar_sistema", label: "Administrar" },
                ].map((perm) => (
                  <div key={perm.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`edit-perm-${perm.id}`} 
                      checked={editUserPermissions.includes(perm.id)}
                      onCheckedChange={(checked) => {
                        setEditUserPermissions(prev => 
                          checked 
                            ? [...prev, perm.id] 
                            : prev.filter(p => p !== perm.id)
                        );
                      }}
                    />
                    <Label htmlFor={`edit-perm-${perm.id}`} className="text-xs font-normal">{perm.label}</Label>
                  </div>
                ))}
              </div>
            </div>
            {(editingUser?.roles.includes("user") || editingUser?.roles.includes("org_admin")) && orgCnpjs.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {editingUser?.roles.includes("user") ? "CNPJs do Usuário" : "CNPJs do Administrador"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {editingUser?.roles.includes("user")
                    ? "Selecione quais empresas/filiais este usuário poderá acessar"
                    : "Selecione os CNPJs deste administrador. Deixe vazio para acesso a todos os CNPJs."}
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {orgCnpjs.map((cnpj) => (
                    <div key={cnpj.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-cnpj-${cnpj.id}`}
                        checked={editUserCnpjIds.includes(cnpj.id)}
                        onCheckedChange={(checked) => {
                          setEditUserCnpjIds(prev =>
                            checked
                              ? [...prev, cnpj.id]
                              : prev.filter(id => id !== cnpj.id)
                          );
                        }}
                      />
                      <Label htmlFor={`edit-cnpj-${cnpj.id}`} className="text-sm font-normal cursor-pointer">
                        {cnpj.company_name} ({formatCNPJ(cnpj.cnpj)})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditUser} disabled={isEditingUser}>
              {isEditingUser ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Role</DialogTitle>
            <DialogDescription>
              Adicione uma nova role para {roleDialogUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selecione a Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as AppRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org_admin">Administrador</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                </SelectContent>

              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (roleDialogUser) {
                  addRoleToUser(roleDialogUser.id, selectedRole);
                }
              }}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha temporária para {resetPasswordUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input value={resetPasswordUser?.full_name || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={resetPasswordUser?.email || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temp-password">Nova Senha Temporária</Label>
              <Input
                id="temp-password"
                type="password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Crie uma senha forte"
              />
              <PasswordRequirementsHint password={tempPassword} />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="must-reset"
                checked={mustResetOnLogin}
                onCheckedChange={(checked) => setMustResetOnLogin(checked === true)}
              />
              <Label htmlFor="must-reset" className="text-sm font-normal cursor-pointer">
                Exigir nova senha no próximo login
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={isResettingPassword}>
              {isResettingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                "Redefinir Senha"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!roleRemovalConfirm} onOpenChange={(open) => !open && setRoleRemovalConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover role de Administrador</AlertDialogTitle>
            <AlertDialogDescription>
              {roleRemovalConfirm?.userId === session?.user?.id
                ? "Você está removendo sua própria role de Administrador. Após confirmar, você perderá acesso às funcionalidades de administração."
                : "Tem certeza que deseja remover a role de Administrador deste usuário? Ele perderá acesso às funcionalidades de administração."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (roleRemovalConfirm) {
                  removeRoleFromUser(roleRemovalConfirm.userId, roleRemovalConfirm.role);
                  setRoleRemovalConfirm(null);
                }
              }}
            >
              Confirmar Remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O usuário <strong>{userToDelete?.full_name}</strong> será permanentemente removido do sistema.
              <br /><br />
              <em>Nota: Somente usuários sem histórico relevante podem ser excluídos.</em>
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
    </div>
  );
}

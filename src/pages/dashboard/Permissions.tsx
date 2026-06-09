import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  HardHat,
  PackageCheck,
  Tags,
  BarChart3,
  CreditCard,
  Settings,
  Check,
  X,
  Shield,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Role = "super_admin" | "org_admin" | "manager";

interface Permission {
  action: string;
  description: string;
  super_admin: boolean;
  org_admin: boolean;
  manager: boolean;
}

interface Module {
  name: string;
  icon: React.ElementType;
  permissions: Permission[];
}

const permissionsMatrix: Record<string, Module> = {
  dashboard: {
    name: "Dashboard",
    icon: LayoutDashboard,
    permissions: [
      { action: "Visualizar estatísticas", description: "Ver métricas e indicadores do dashboard", super_admin: true, org_admin: true, manager: true },
      { action: "Ver gráficos de desempenho", description: "Acessar visualizações de performance", super_admin: true, org_admin: true, manager: true },
      { action: "Exportar dados", description: "Baixar relatórios do dashboard", super_admin: true, org_admin: true, manager: false },
    ],
  },
  users: {
    name: "Usuários",
    icon: Users,
    permissions: [
      { action: "Visualizar usuários", description: "Ver lista de usuários da organização", super_admin: true, org_admin: true, manager: false },
      { action: "Criar usuários", description: "Adicionar novos usuários", super_admin: true, org_admin: true, manager: false },
      { action: "Editar usuários", description: "Modificar dados de usuários existentes", super_admin: true, org_admin: true, manager: false },
      { action: "Excluir usuários", description: "Remover usuários do sistema", super_admin: true, org_admin: true, manager: false },
      { action: "Resetar senha", description: "Enviar email de redefinição de senha", super_admin: true, org_admin: true, manager: false },
      { action: "Alterar função", description: "Modificar a role de um usuário", super_admin: true, org_admin: true, manager: false },
    ],
  },
  documents: {
    name: "Documentos",
    icon: FileText,
    permissions: [
      { action: "Visualizar documentos", description: "Ver lista de documentos da organização", super_admin: true, org_admin: true, manager: true },
      { action: "Fazer upload", description: "Adicionar novos documentos ao sistema", super_admin: true, org_admin: true, manager: true },
      { action: "Editar documentos", description: "Modificar metadados de documentos", super_admin: true, org_admin: true, manager: false },
      { action: "Excluir documentos", description: "Remover documentos do sistema", super_admin: true, org_admin: true, manager: false },
    ],
  },
  billing: {
    name: "Faturamento",
    icon: CreditCard,
    permissions: [
      { action: "Acessar módulo", description: "Visualizar página de planos", super_admin: true, org_admin: true, manager: false },
      { action: "Ver plano atual", description: "Visualizar detalhes da assinatura", super_admin: true, org_admin: true, manager: false },
      { action: "Alterar plano", description: "Fazer upgrade/downgrade do plano", super_admin: true, org_admin: true, manager: false },
      { action: "Cancelar assinatura", description: "Cancelar a assinatura", super_admin: true, org_admin: true, manager: false },
    ],
  },
  settings: {
    name: "Configurações",
    icon: Settings,
    permissions: [
      { action: "Visualizar configurações", description: "Acessar página de configurações", super_admin: true, org_admin: true, manager: false },
      { action: "Editar organização", description: "Modificar dados da organização", super_admin: true, org_admin: true, manager: false },
      { action: "Alterar logo", description: "Fazer upload do logo da empresa", super_admin: true, org_admin: true, manager: false },
    ],
  },
};

const roleInfo: Record<Role, { label: string; icon: React.ElementType; color: string; description: string }> = {
  super_admin: {
    label: "Super Admin",
    icon: ShieldCheck,
    color: "text-purple-600 bg-purple-500/10 border-purple-500/20",
    description: "Acesso total ao sistema, gerencia todas as organizações",
  },
  org_admin: {
    label: "Administrador",
    icon: Shield,
    color: "text-primary bg-primary/10 border-primary/20",
    description: "Gerencia a organização, usuários, EPIs e configurações",
  },
  manager: {
    label: "Gestor",
    icon: UserCog,
    color: "text-green-600 bg-green-500/10 border-green-500/20",
    description: "Gerencia documentos e emite relatórios",
  },
};

const roles: Role[] = ["super_admin", "org_admin", "manager"];

function PermissionIndicator({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <div className="flex items-center justify-center">
      <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center">
        <Check className="h-4 w-4 text-green-600" />
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center">
      <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center">
        <X className="h-4 w-4 text-destructive" />
      </div>
    </div>
  );
}

function RoleSummaryCard({ role }: { role: Role }) {
  const info = roleInfo[role];
  const Icon = info.icon;

  const totalPermissions = Object.values(permissionsMatrix).reduce(
    (acc, module) => acc + module.permissions.length,
    0
  );

  const grantedPermissions = Object.values(permissionsMatrix).reduce(
    (acc, module) =>
      acc + module.permissions.filter((p) => p[role]).length,
    0
  );

  const percentage = Math.round((grantedPermissions / totalPermissions) * 100);

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("font-medium", info.color)}>
            <Icon className="h-3 w-3 mr-1" />
            {info.label}
          </Badge>
        </div>
        <CardDescription className="text-xs mt-1">
          {info.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold">{grantedPermissions}</p>
            <p className="text-xs text-muted-foreground">de {totalPermissions} permissões</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-muted-foreground">{percentage}%</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              role === "super_admin" && "bg-purple-500",
              role === "org_admin" && "bg-primary",
              role === "manager" && "bg-green-500"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matriz de Permissões</h1>
        <p className="text-muted-foreground">
          Visualize as permissões de cada função no sistema
        </p>
      </div>

      {/* Role Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((role) => (
          <RoleSummaryCard key={role} role={role} />
        ))}
      </div>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permissões por Módulo</CardTitle>
          <CardDescription>
            Selecione um módulo para ver as permissões detalhadas de cada função
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
              {Object.entries(permissionsMatrix).map(([key, module]) => {
                const Icon = module.icon;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="flex items-center gap-1.5 data-[state=active]:bg-background"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{module.name}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.entries(permissionsMatrix).map(([key, module]) => (
              <TabsContent key={key} value={key} className="mt-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[300px]">Ação</TableHead>
                        {roles.map((role) => (
                          <TableHead key={role} className="text-center w-[120px]">
                            <Badge
                              variant="outline"
                              className={cn("font-medium", roleInfo[role].color)}
                            >
                              {roleInfo[role].label}
                            </Badge>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {module.permissions.map((permission, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help font-medium">
                                  {permission.action}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{permission.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          {roles.map((role) => (
                            <TableCell key={role} className="text-center">
                              <PermissionIndicator allowed={permission[role]} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-sm text-muted-foreground">Permissão concedida</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="h-4 w-4 text-destructive" />
              </div>
              <span className="text-sm text-muted-foreground">Sem permissão</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

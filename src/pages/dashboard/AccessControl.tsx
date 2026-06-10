import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Map, Activity, LayoutDashboard, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProfileList } from "@/components/access-control/ProfileList";
import { UserScopeManager } from "@/components/access-control/UserScopeManager";
import { AccessSimulator } from "@/components/access-control/AccessSimulator";
import { SecurityDashboard } from "@/components/access-control/SecurityDashboard";
import { UserProfileAssignment } from "@/components/access-control/UserProfileAssignment";

export default function AccessControlPage() {
  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Controle de Acesso</h1>
          <p className="text-muted-foreground">Gestão completa de perfis, escopos e segurança do GED</p>
        </div>
      </div>

      <Tabs defaultValue="profiles" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-muted/50">
          <TabsTrigger value="profiles" className="flex items-center gap-2 py-3">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Perfis & Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="scopes" className="flex items-center gap-2 py-3">
            <Map className="h-4 w-4" />
            <span className="hidden md:inline">Escopo de Acesso</span>
          </TabsTrigger>
          <TabsTrigger value="simulator" className="flex items-center gap-2 py-3">
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Simulador</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2 py-3">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden md:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2 py-3">
            <Activity className="h-4 w-4" />
            <span className="hidden md:inline">Auditoria</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="profiles" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProfileList />
              <UserProfileAssignment />
            </div>
          </TabsContent>

          <TabsContent value="scopes">
            <UserScopeManager />
          </TabsContent>

          <TabsContent value="simulator">
            <AccessSimulator />
          </TabsContent>

          <TabsContent value="dashboard">
            <SecurityDashboard />
          </TabsContent>

          <TabsContent value="audit">
             <Card>
              <CardHeader>
                <CardTitle>Log de Auditoria de Segurança</CardTitle>
                <CardDescription>Registro completo de alterações de permissão e acessos</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-10 italic">
                  O log de auditoria está sendo processado e estará disponível em instantes.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

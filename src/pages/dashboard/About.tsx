import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Info, Shield, CheckCircle2, FileText, LayoutDashboard, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AboutPage() {
  const { data: settings, isLoading } = useSystemSettings();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64 mx-auto" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Sobre o Nexo GED</h1>
        <p className="text-muted-foreground text-lg">
          Sistema Avançado de Gestão Eletrônica de Documentos
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Módulo GED Corporate</CardTitle>
            <CardDescription>Estrutura e Organização</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Implementamos uma hierarquia completa para sua organização: 
              Empresa, Departamentos, Setores, Pastas e Documentos.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Versionamento Automático
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Exclusão Lógica e Lixeira
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Auditoria de Acessos
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Segurança e Conformidade</CardTitle>
            <CardDescription>Proteção de Dados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Seus documentos são protegidos por criptografia e controle de acesso granular (RBAC).
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Controle de Permissões
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Logs de Visualização
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Backup Redundante
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Informações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Versão do Sistema</p>
            <p className="text-sm font-semibold">2.4.0 (Build 20260610)</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Ambiente</p>
            <p className="text-sm font-semibold">Produção - Nexo Cloud</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Suporte Técnico</p>
            <p className="text-sm font-semibold">suporte@nexoged.com.br</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Licenciado para</p>
            <p className="text-sm font-semibold">{settings?.system_name || "Nexo GED"}</p>
          </div>
        </CardContent>
      </Card>
      
      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground italic">
          Nexo GED &copy; 2026. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, ShieldAlert, FolderLock, FileWarning, Activity } from "lucide-react";

export function SecurityDashboard() {
  const stats = [
    { label: "Usuários Ativos", value: "24", icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Perfis Configuráveis", value: "5", icon: ShieldAlert, color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Pastas Restritas", value: "8", icon: FolderLock, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Documentos Sigilosos", value: "156", icon: FileWarning, color: "text-rose-500", bg: "bg-rose-50" },
    { label: "Tentativas Negadas (24h)", value: "12", icon: Activity, color: "text-green-500", bg: "bg-green-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className={`p-3 rounded-full ${stat.bg} ${stat.color} mb-2`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Sigilo</CardTitle>
            <CardDescription>Percentual de documentos por nível de confidencialidade</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
             <div className="space-y-4 w-full">
                {[
                  { label: "Público", percent: 65, color: "bg-green-500" },
                  { label: "Interno", percent: 20, color: "bg-blue-500" },
                  { label: "Restrito", percent: 10, color: "bg-amber-500" },
                  { label: "Confidencial", percent: 4, color: "bg-purple-500" },
                  { label: "Sigiloso", percent: 1, color: "bg-rose-500" },
                ].map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>{item.label}</span>
                      <span>{item.percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${item.color}`} style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atividade de Segurança Recente</CardTitle>
            <CardDescription>Últimas 5 alterações críticas no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               {[
                 { action: "Alteração de Perfil", user: "Admin", detail: "Perímetro Financeiro alterado", time: "10 min atrás" },
                 { action: "Acesso Negado", user: "joao.silva", detail: "Pasta RH > Salários", time: "45 min atrás" },
                 { action: "Novo Escopo", user: "Admin", detail: "Setor Fiscal para Maria S.", time: "2h atrás" },
                 { action: "Documento Sigiloso", user: "carlos.m", detail: "Upload de contrato confidencial", time: "5h atrás" },
                 { action: "Pasta Restrita", user: "Admin", detail: "Pasta 'Diretoria' marcada como restrita", time: "1 dia atrás" },
               ].map((log, i) => (
                 <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{log.action}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{log.detail} por {log.user}</p>
                      <p className="text-[9px] text-primary mt-0.5">{log.time}</p>
                    </div>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

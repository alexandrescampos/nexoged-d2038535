import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  FileText,
  Shield,
  Clock,
  LayoutDashboard,
  HardDrive,
  Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes } from "@/lib/utils";

interface OrgStats {
  totalDocuments: number;
  vigenteDocuments: number;
  expiredDocuments: number;
  totalUsers: number;
  pendingDocuments: number;
  totalPages: number;
  usedSpace: number; // in bytes
}

export default function Dashboard() {
  const { organization, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.must_reset_password) {
      navigate("/reset-password");
    }
  }, [profile, navigate]);

  const [stats, setStats] = useState<OrgStats>({
    totalDocuments: 0,
    vigenteDocuments: 0,
    expiredDocuments: 0,
    totalUsers: 0,
    pendingDocuments: 0,
    totalPages: 0,
    usedSpace: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!organization?.id) return;
      setIsLoadingStats(true);

      try {
        const [docsCount, activeUsers, spaceUsage, pendingDocs] = await Promise.all([
          supabase.from("ged_documents").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).neq("status", "deleted"),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("is_active", true),
          supabase.rpc('sum_org_document_size', { p_org_id: organization.id }),
          supabase.from("ged_documents").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("status", "pending"),
        ]);

        const totalDocs = docsCount.count || 0;
        const pagesCount = await supabase.from("ged_documents")
          .select("page_count")
          .eq("organization_id", organization.id);
        
        const totalPages = pagesCount.data?.reduce((acc, curr) => acc + (curr.page_count || 0), 0) || 0;

        setStats({
          totalDocuments: totalDocs,
          vigenteDocuments: totalDocs - (pendingDocs.count || 0), // Simplificação para o protótipo
          expiredDocuments: 0,
          totalUsers: activeUsers.count || 0,
          pendingDocuments: pendingDocs.count || 0,
          totalPages: totalPages,
          usedSpace: (spaceUsage.data as number) || 0,
        });
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      } finally {
        setIsLoadingStats(false);
      }
    };
    fetchStats();
  }, [organization?.id]);

  const cards = [
    { title: "Espaço Utilizado", value: formatBytes(stats.usedSpace), icon: HardDrive, color: "text-amber-500", description: "Armazenamento atual" },
    { title: "Total de Documentos", value: stats.totalDocuments, icon: FileText, color: "text-blue-500", description: "Arquivos gerenciados", onClick: () => navigate("/dashboard/documents") },
    { title: "Documentos Vigentes", value: stats.vigenteDocuments, icon: Shield, color: "text-green-500", description: "Dentro do prazo" },
    { title: "Documentos Expirados", value: stats.expiredDocuments, icon: Clock, color: "text-destructive", description: "Ação necessária" },
    { title: "Usuários Ativos", value: stats.totalUsers, icon: Users, color: "text-purple-500", description: "Acessos liberados" },
    { 
      title: "Documentos Pendentes", 
      value: stats.pendingDocuments, 
      icon: FileText, 
      color: "text-orange-500", 
      description: "Aguardando ação",
      tooltip: "Documentos cadastrados na organização cujo status é 'pending' (pendente). São arquivos que foram criados/enviados mas ainda requerem alguma ação para serem considerados ativos — por exemplo: aprovação, classificação, revisão, assinatura ou conclusão do upload. O cálculo é feito contando todos os registros em ged_documents da sua organização com status = 'pending'."
    },
    { title: "Total de Páginas", value: stats.totalPages, icon: LayoutDashboard, color: "text-indigo-500", description: "Volume total" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao Nexo GED de {organization?.name || "sua organização"}
        </p>
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {cards.map((card: any) => (
            <Card key={card.title} className={card.onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={card.onClick}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  {card.title}
                  {card.tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground/60 hover:text-foreground transition-colors"
                          aria-label="Saiba mais"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                        {card.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingStats ? "..." : card.value}
                </div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </TooltipProvider>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-orange-500" />
            O que são "Documentos Pendentes"?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            São documentos da sua organização que ainda <strong>não foram concluídos</strong> e estão aguardando alguma ação do usuário antes de serem considerados ativos.
          </p>
          <p>
            <strong>Como o sistema calcula:</strong> contamos todos os registros em <code className="bg-muted px-1 py-0.5 rounded text-xs">ged_documents</code> pertencentes à sua organização (<code className="bg-muted px-1 py-0.5 rounded text-xs">organization_id</code>) cujo campo <code className="bg-muted px-1 py-0.5 rounded text-xs">status</code> está definido como <code className="bg-muted px-1 py-0.5 rounded text-xs">'pending'</code>.
          </p>
          <p>
            Situações típicas que geram pendência: documento enviado mas ainda não classificado, aguardando aprovação/revisão, upload incompleto, ou aguardando assinatura digital. Se nenhum documento estiver nessa situação, o contador exibirá <strong>0</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Visão Geral do Nexo GED
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            O sistema de Gestão Eletrônica de Documentos está sendo configurado. 
            Utilize os menus laterais para gerenciar seus arquivos e usuários.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  FileText,
  Shield,
  Clock,
  LayoutDashboard
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OrgStats {
  totalDocuments: number;
  vigenteDocuments: number;
  expiredDocuments: number;
  totalUsers: number;
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
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!organization?.id) return;
      setIsLoadingStats(true);

      try {
        // Mocking stats for now as we transition to documents
        setStats({
          totalDocuments: 12,
          vigenteDocuments: 10,
          expiredDocuments: 2,
          totalUsers: 5,
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
    { title: "Total de Documentos", value: stats.totalDocuments, icon: FileText, color: "text-blue-500", description: "Arquivos gerenciados", onClick: () => navigate("/dashboard/documents") },
    { title: "Documentos Vigentes", value: stats.vigenteDocuments, icon: Shield, color: "text-green-500", description: "Dentro do prazo" },
    { title: "Documentos Expirados", value: stats.expiredDocuments, icon: Clock, color: "text-destructive", description: "Ação necessária" },
    { title: "Usuários", value: stats.totalUsers, icon: Users, color: "text-purple-500", description: "Acessos liberados" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao Nexo GED de {organization?.name || "sua organização"}
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className={card.onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={card.onClick}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
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

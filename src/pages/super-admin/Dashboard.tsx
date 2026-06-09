import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CreditCard, TrendingUp, FileText, HardDrive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalOrgs: number;
  totalUsers: number;
  activeOrgs: number;
  activeSubscriptions: number;
  totalUsedPages: number;
  totalUsedStorageGB: number;
}

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ 
    totalOrgs: 0, 
    totalUsers: 0, 
    activeOrgs: 0, 
    activeSubscriptions: 0,
    totalUsedPages: 0,
    totalUsedStorageGB: 0
  });

  useEffect(() => {
    if (profile?.must_reset_password) {
      navigate("/reset-password");
    }
  }, [profile, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      const [orgsRes, usersRes, subscriptionsRes, usageRes] = await Promise.all([
        supabase.from("organizations").select("id, status"),
        supabase.from("profiles").select("id"),
        supabase.from("stripe_config").select("id").eq("subscription_status", "active"),
        supabase.from("organization_usage").select("used_pages, used_storage_gb"),
      ]);

      const totalUsedPages = usageRes.data?.reduce((acc, curr) => acc + (Number(curr.used_pages) || 0), 0) || 0;
      const totalUsedStorageGB = usageRes.data?.reduce((acc, curr) => acc + (Number(curr.used_storage_gb) || 0), 0) || 0;

      setStats({
        totalOrgs: orgsRes.data?.length || 0,
        activeOrgs: orgsRes.data?.filter((o) => o.status === "active").length || 0,
        totalUsers: usersRes.data?.length || 0,
        activeSubscriptions: subscriptionsRes.data?.length || 0,
        totalUsedPages,
        totalUsedStorageGB,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "Organizações", value: stats.totalOrgs, icon: Building2, description: "Total cadastradas" },
    { title: "Organizações Ativas", value: stats.activeOrgs, icon: TrendingUp, description: "Em operação" },
    { title: "Usuários", value: stats.totalUsers, icon: Users, description: "Total no sistema" },
    { title: "Assinaturas Ativas", value: stats.activeSubscriptions, icon: CreditCard, description: "Pagamentos recorrentes" },
    { title: "Total de Páginas", value: stats.totalUsedPages.toLocaleString(), icon: FileText, description: "Volume processado" },
    { title: "Espaço Utilizado", value: `${stats.totalUsedStorageGB.toFixed(2)} GB`, icon: HardDrive, description: "Armazenamento total" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema Nexo GED</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

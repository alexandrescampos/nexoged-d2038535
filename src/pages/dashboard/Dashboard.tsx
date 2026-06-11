import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

interface MonthlyPoint {
  label: string;
  total: number;
}
interface NameTotal {
  name: string;
  total: number;
}
interface FolderBytes {
  name: string;
  bytes: number;
}

interface Indicators {
  total_docs: number;
  total_folders: number;
  total_users: number;
  max_users: number;
  used_pages: number;
  contracted_pages: number;
  used_storage_bytes: number;
  used_storage_gb: number;
  contracted_storage_gb: number;
  monthly_uploads: MonthlyPoint[];
  storage_by_folder: FolderBytes[];
  top_users: NameTotal[];
  pages_by_user: NameTotal[];
  expired_docs_count: number;
  expiring_soon_docs_count: number;
}

const PIE_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

function StatCard({
  title,
  value,
  className,
}: {
  title: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-none shadow-sm ${className ?? ""}`}>
      <CardContent className="p-4">
        <p className="text-xs uppercase font-semibold opacity-90">{title}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function OrgDashboard() {
  const { organization, profile } = useAuth();
  const [data, setData] = useState<Indicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    toast.info("Gerando PDF dos indicadores...");

    try {
      // Small delay to ensure all charts are rendered
      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: dashboardRef.current.scrollWidth,
        windowHeight: dashboardRef.current.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`dashboard-indicadores-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao gerar o PDF.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!organization?.id) return;
      setLoading(true);
      const { data, error } = await supabase.rpc("dashboard_indicators", {
        p_org_id: organization.id,
      });
      if (error) {
        console.error("dashboard_indicators error", error);
      } else {
        setData(data as unknown as Indicators);
      }
      setLoading(false);
    };
    load();
  }, [organization?.id]);

  const usedGb = Number(data?.used_storage_gb ?? 0);
  const contractedGb = Number(data?.contracted_storage_gb ?? 0);
  const remainingGb = Math.max(contractedGb - usedGb, 0);

  const storagePie = [
    { name: "Utilizado", value: Number(usedGb.toFixed(2)) },
    { name: "Disponível", value: Number(remainingGb.toFixed(2)) },
  ];

  const folderData = (data?.storage_by_folder ?? []).map((f) => ({
    name: f.name,
    gb: Number((Number(f.bytes) / 1024 ** 3).toFixed(3)),
  }));

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-0">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Olá, {profile?.full_name?.split(" ")[0] || "Usuário"}
        </h1>
        <p className="text-muted-foreground">Indicadores do Nexo GED</p>
      </div>

      {/* Monthly uploads */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Documentos enviados por mês</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthly_uploads ?? []}>
                <defs>
                  <linearGradient id="docs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a3d977" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#a3d977" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} label={{ value: "Nº de documentos", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke="#7cb342" fill="url(#docs)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Alertas e Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Documentos vencidos"
          value={loading ? "..." : (data?.expired_docs_count ?? 0).toLocaleString("pt-BR")}
          className="bg-red-600 text-white"
        />
        <StatCard
          title="Vencendo em 30 dias"
          value={loading ? "..." : (data?.expiring_soon_docs_count ?? 0).toLocaleString("pt-BR")}
          className="bg-amber-500 text-white"
        />
        <StatCard
          title="Documentos"
          value={loading ? "..." : (data?.total_docs ?? 0).toLocaleString("pt-BR")}
          className="bg-sky-500 text-white"
        />
        <StatCard
          title="Repositórios"
          value={loading ? "..." : (data?.total_folders ?? 0).toLocaleString("pt-BR")}
          className="bg-slate-600 text-white"
        />
        <StatCard
          title="Usuários"
          value={
            loading
              ? "..."
              : `${data?.total_users ?? 0}/${
                  (data?.max_users ?? 0) >= 999999 ? "∞" : data?.max_users ?? 0
                }`
          }
          className="bg-emerald-500 text-white"
        />
        <StatCard
          title="Páginas"
          value={loading ? "..." : Number(data?.used_pages ?? 0).toLocaleString("pt-BR")}
          className="bg-orange-500 text-white"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GBs utilizados */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-bold">GBs utilizados</CardTitle>
            <p className="text-xs text-muted-foreground">GBs utilizados segundo o contrato</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={storagePie} dataKey="value" nameKey="name" outerRadius="80%" label>
                    <Cell fill="#ef4444" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} GB`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* GBs por repositório */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-bold">GBs por repositório</CardTitle>
            <p className="text-xs text-muted-foreground">Consumo agrupado por repositório</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : folderData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center pt-16">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={folderData}
                    dataKey="gb"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                  >
                    {folderData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} GB`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Usuários mais ativos */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-bold">Usuários mais ativos</CardTitle>
            <p className="text-xs text-muted-foreground">Usuários com mais acessos nos últimos 30 dias</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.top_users?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground text-center pt-16">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.top_users ?? []} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#ec4899" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Páginas indexadas */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-bold">Páginas indexadas</CardTitle>
            <p className="text-xs text-muted-foreground">Páginas indexadas por usuário (30 dias)</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.pages_by_user?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground text-center pt-16">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.pages_by_user ?? []}
                    dataKey="total"
                    nameKey="name"
                    outerRadius="80%"
                    label
                  >
                    {(data?.pages_by_user ?? []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Armazenamento: {formatBytes(Number(data?.used_storage_bytes ?? 0))} de{" "}
        {contractedGb} GB contratados.
      </p>
    </div>
  );
}

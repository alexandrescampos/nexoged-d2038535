import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, Calendar as CalendarIcon, Filter } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  org_logo?: string;
  org_name?: string;
  start_date: string;
  end_date: string;
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
      <CardContent className="p-4 flex flex-col justify-center min-h-[100px]">
        <p className="text-xs uppercase font-semibold opacity-90">{title}</p>
        <p className="text-2xl font-bold mt-2">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function OrgDashboard() {
  const { organization, profile } = useAuth();
  const [data, setData] = useState<Indicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    toast.info("Gerando relatório profissional...");

    try {
      // Small delay to ensure all charts are rendered
      await new Promise((resolve) => setTimeout(resolve, 800));

      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        ignoreElements: (element) => {
          return element.classList.contains("no-export");
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const contentWidth = pdfWidth - 20; // Margin
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

      // Add simple professional header
      pdf.setFillColor(245, 245, 245);
      pdf.rect(0, 0, pdfWidth, 15, "F");
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`Relatório Nexo GED - ${data?.org_name || ""} - Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 10, 10);

      pdf.addImage(imgData, "PNG", 10, 20, contentWidth, contentHeight);
      
      pdf.save(`relatorio-indicadores-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao gerar o PDF.");
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("dashboard_indicators", {
      p_org_id: organization.id,
      p_start_date: format(startDate, "yyyy-MM-dd"),
      p_end_date: format(endDate, "yyyy-MM-dd"),
    });
    
    if (error) {
      console.error("dashboard_indicators error", error);
      toast.error("Erro ao carregar indicadores.");
    } else {
      setData(data as unknown as Indicators);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
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
    <div className="space-y-6 animate-fade-in p-4 bg-slate-50 min-h-screen">
      {/* Header & Filters (Screen Only) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-export">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Painel de Indicadores
          </h1>
          <p className="text-slate-500">Acompanhe a performance e uso do Nexo GED</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white p-1 rounded-md border shadow-sm">
            <div className="flex items-center gap-2 px-2 border-r">
              <CalendarIcon className="h-4 w-4 text-slate-400" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-xs font-normal">
                    {format(startDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-slate-300">|</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-xs font-normal">
                    {format(endDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button size="sm" variant="ghost" className="h-8" onClick={loadData} disabled={loading}>
              <Filter className="h-3.5 w-3.5 mr-2" />
              Filtrar
            </Button>
          </div>

          <Button 
            onClick={handleExportPDF} 
            disabled={exporting || loading}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FileDown className="h-4 w-4" />
            {exporting ? "Gerando..." : "Exportar Report"}
          </Button>
        </div>
      </div>

      {/* Main Report Container */}
      <div 
        ref={dashboardRef} 
        className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200"
        style={{ minWidth: "800px" }} // Ensure minimum width for PDF consistency
      >
        {/* Report Header (Visible in PDF) */}
        <div className="flex justify-between items-center pb-6 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-4">
            {data?.org_logo ? (
              <img src={data.org_logo} alt="Logo" className="h-12 object-contain" />
            ) : (
              <div className="h-12 w-12 bg-blue-600 flex items-center justify-center rounded text-white font-bold text-xl">
                N
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-900 uppercase">Relatório de Indicadores</h2>
              <p className="text-sm text-slate-500 font-medium">{data?.org_name || "Organização"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase font-semibold">Período Selecionado</p>
            <p className="text-sm font-bold text-slate-700">
              {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
            </p>
          </div>
        </div>

        {/* Alertas e Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="Docs Vencidos"
            value={loading ? <Skeleton className="h-8 w-16" /> : (data?.expired_docs_count ?? 0).toLocaleString("pt-BR")}
            className="bg-red-50 text-red-700 border border-red-100"
          />
          <StatCard
            title="Vencendo 30d"
            value={loading ? <Skeleton className="h-8 w-16" /> : (data?.expiring_soon_docs_count ?? 0).toLocaleString("pt-BR")}
            className="bg-amber-50 text-amber-700 border border-amber-100"
          />
          <StatCard
            title="Docs no Período"
            value={loading ? <Skeleton className="h-8 w-16" /> : (data?.total_docs ?? 0).toLocaleString("pt-BR")}
            className="bg-blue-50 text-blue-700 border border-blue-100"
          />
          <StatCard
            title="Repositórios"
            value={loading ? <Skeleton className="h-8 w-16" /> : (data?.total_folders ?? 0).toLocaleString("pt-BR")}
            className="bg-slate-50 text-slate-700 border border-slate-100"
          />
          <StatCard
            title="Usuários Ativos"
            value={
              loading
                ? <Skeleton className="h-8 w-16" />
                : `${data?.total_users ?? 0}/${
                    (data?.max_users ?? 0) >= 999999 ? "∞" : data?.max_users ?? 0
                  }`
            }
            className="bg-emerald-50 text-emerald-700 border border-emerald-100"
          />
          <StatCard
            title="Páginas (Período)"
            value={loading ? <Skeleton className="h-8 w-16" /> : Number(data?.used_pages ?? 0).toLocaleString("pt-BR")}
            className="bg-orange-50 text-orange-700 border border-orange-100"
          />
        </div>

        {/* Monthly uploads - Full Width */}
        <Card className="border border-slate-100 shadow-none mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-600">Documentos enviados por mês no período</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.monthly_uploads ?? []}>
                  <defs>
                    <linearGradient id="docs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#docs)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Charts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GBs utilizados */}
          <Card className="border border-slate-100 shadow-none">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-bold text-slate-600">Capacidade de Armazenamento</CardTitle>
              <p className="text-xs text-slate-400">Total contratado: {contractedGb} GB</p>
            </CardHeader>
            <CardContent className="h-[260px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={storagePie} 
                      dataKey="value" 
                      nameKey="name" 
                      outerRadius="70%" 
                      label={({ name, value }) => `${name}: ${value}GB`}
                    >
                      <Cell fill="#ef4444" />
                      <Cell fill="#3b82f6" />
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v} GB`} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* GBs por repositório */}
          <Card className="border border-slate-100 shadow-none">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-bold text-slate-600">Ocupação por Repositório</CardTitle>
              <p className="text-xs text-slate-400">Distribuição do volume de arquivos</p>
            </CardHeader>
            <CardContent className="h-[260px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : folderData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">Sem dados registrados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={folderData}
                      dataKey="gb"
                      nameKey="name"
                      innerRadius="50%"
                      outerRadius="70%"
                      paddingAngle={5}
                    >
                      {folderData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v} GB`} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Usuários mais ativos */}
          <Card className="border border-slate-100 shadow-none">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-bold text-slate-600">Ranking de Atividade</CardTitle>
              <p className="text-xs text-slate-400">Acessos e ações no período</p>
            </CardHeader>
            <CardContent className="h-[260px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (data?.top_users?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">Sem dados registrados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.top_users ?? []} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} fontSize={11} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Páginas indexadas */}
          <Card className="border border-slate-100 shadow-none">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-bold text-slate-600">Produtividade de Digitalização</CardTitle>
              <p className="text-xs text-slate-400">Páginas indexadas por colaborador</p>
            </CardHeader>
            <CardContent className="h-[260px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (data?.pages_by_user?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">Sem dados registrados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.pages_by_user ?? []}
                      dataKey="total"
                      nameKey="name"
                      outerRadius="70%"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {(data?.pages_by_user ?? []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-slate-100 flex justify-between items-center mt-8">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Nexo GED - Gestão Inteligente de Documentos</p>
          <div className="text-right">
            <p className="text-xs text-slate-500">
              Total Armazenado: <span className="font-bold">{formatBytes(Number(data?.used_storage_bytes ?? 0))}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


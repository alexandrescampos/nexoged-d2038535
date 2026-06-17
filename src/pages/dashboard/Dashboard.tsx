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
import { MyWorkflowTasksWidget } from "@/components/dashboard/ged/MyWorkflowTasksWidget";

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
  total_versions?: number;
  versions_signed?: number;
  versions_pending?: number;
  versions_cancelled?: number;
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
      // Wait for the header (rendered conditionally on `exporting`) and charts to be in the DOM
      await new Promise((resolve) => setTimeout(resolve, 1000));


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

      // Simple professional watermark or header if needed, but since we have a dedicated header in the capture, we don't need much here.
      // Removing the rect to keep it clean as requested.


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
      {/* Header & Filters (Always visible on screen, some parts hidden on export) */}
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
            {exporting ? "Gerando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {/* Main Container for PDF capture */}
      <div ref={dashboardRef} className="space-y-6 bg-transparent">
        {/* Report Header (Visible only during PDF export) */}
        {exporting && (
          <div className="flex justify-between items-center pb-6 border-b border-slate-200 mb-6 bg-white p-6 rounded-t-xl">
            <div className="flex items-center gap-6">
              {data?.org_logo ? (
                <img src={data.org_logo} alt="Logo" className="h-14 object-contain" />
              ) : (
                <div className="h-14 w-14 bg-blue-600 flex items-center justify-center rounded text-white font-bold text-2xl">
                  N
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-[#1e293b] leading-tight">RELATÓRIO DE INDICADORES</h2>
                <p className="text-base text-slate-500 font-medium">{data?.org_name || "Nexo GED"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">PERÍODO SELECIONADO</p>
              <p className="text-base font-bold text-slate-700">
                {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
              </p>
            </div>
          </div>
        )}



        {/* Minhas pendências de workflow (Fase 4) */}
        <MyWorkflowTasksWidget />

        {/* Monthly uploads - Full Width (Matches the screenshot layout) */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-50 pb-2">
            <CardTitle className="text-sm font-bold text-slate-800">Documentos enviados por mês</CardTitle>
          </CardHeader>
          <CardContent className="bg-white h-[300px] pt-4">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.monthly_uploads ?? []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} axisLine={false} tickLine={false} label={{ value: 'Nº de documentos', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" stroke="#82ca9d" strokeWidth={2} fillOpacity={1} fill="url(#colorDocs)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Stat cards (Grid layout from screenshot) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="bg-[#d32f2f] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Documentos Vencidos</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : (data?.expired_docs_count ?? 0)}
            </p>
          </div>
          <div className="bg-[#f59e0b] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Vencendo em 30 dias</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : (data?.expiring_soon_docs_count ?? 0)}
            </p>
          </div>
          <div className="bg-[#0ea5e9] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Documentos</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : (data?.total_docs ?? 0)}
            </p>
          </div>
          <div className="bg-[#334155] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Repositórios</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : (data?.total_folders ?? 0)}
            </p>
          </div>
          <div className="bg-[#059669] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Usuários</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : `${data?.total_users ?? 0}/${(data?.max_users ?? 0) >= 999999 ? "∞" : data?.max_users ?? 0}`}
            </p>
          </div>
          <div className="bg-[#f97316] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Páginas</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : (data?.used_pages ?? 0)}
            </p>
          </div>
        </div>

        {/* Versões de Documentos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-[#1565C0] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Total de Versões</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : (data?.total_versions ?? 0)}
            </p>
          </div>
          <div className="bg-[#0f766e] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Versões Assinadas</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : (data?.versions_signed ?? 0)}
            </p>
          </div>
          <div className="bg-[#ca8a04] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Versões Pendentes</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : (data?.versions_pending ?? 0)}
            </p>
          </div>
          <div className="bg-[#6b7280] text-white p-4 rounded-md shadow-sm">
            <p className="text-[10px] uppercase font-bold opacity-90 leading-tight">Versões Canceladas</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-12 bg-white/20" /> : (data?.versions_cancelled ?? 0)}
            </p>
          </div>
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GBs utilizados */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-bold text-slate-800">GBs utilizados</CardTitle>
              <p className="text-[10px] text-slate-400">GBs utilizados segundo o contrato</p>
            </CardHeader>
            <CardContent className="h-[220px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={storagePie} 
                      dataKey="value" 
                      nameKey="name" 
                      outerRadius="80%" 
                      label={({ name, value }) => `${value}`}
                      labelLine={false}
                    >
                      <Cell fill="#ef4444" />
                      <Cell fill="#3b82f6" />
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="square" fontSize={10}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* GBs por repositório */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-bold text-slate-800">GBs por repositório</CardTitle>
              <p className="text-[10px] text-slate-400">Consumo agrupado por repositório</p>
            </CardHeader>
            <CardContent className="h-[220px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={folderData}
                      dataKey="gb"
                      nameKey="name"
                      innerRadius="40%"
                      outerRadius="70%"
                      paddingAngle={2}
                    >
                      {folderData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" layout="horizontal" align="center" iconType="square" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Usuários mais ativos */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-bold text-slate-800">Usuários mais ativos</CardTitle>
              <p className="text-[10px] text-slate-400">Usuários com mais acessos nos últimos 30 dias</p>
            </CardHeader>
            <CardContent className="h-[220px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.top_users ?? []} layout="vertical" margin={{ left: -20, right: 10 }}>
                    <XAxis type="number" fontSize={9} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Páginas indexadas */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-bold text-slate-800">Páginas indexadas</CardTitle>
              <p className="text-[10px] text-slate-400">Páginas indexadas por usuário (30 dias)</p>
            </CardHeader>
            <CardContent className="h-[220px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.pages_by_user ?? []}
                      dataKey="total"
                      nameKey="name"
                      outerRadius="80%"
                      label={({ value }) => `${value}`}
                      labelLine={false}
                    >
                      {(data?.pages_by_user ?? []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="square" fontSize={10}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer (Visible only in PDF/Export) */}
        <div className="hidden pdf-only pt-8 border-t border-slate-100 flex justify-between items-center bg-white p-6 rounded-b-xl">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Nexo GED - Gestão Inteligente de Documentos</p>
          <div className="text-right">
            <p className="text-xs text-slate-500">
              Total Armazenado: <span className="font-bold">{formatBytes(Number(data?.used_storage_bytes ?? 0))}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Global CSS for PDF specific visibility */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .pdf-only { display: none !important; }
        }
        .jspdf-canvas .pdf-only { display: flex !important; }
      `}} />
    </div>
  );
}



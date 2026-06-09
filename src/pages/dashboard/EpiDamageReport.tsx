import { useState, useMemo } from "react";
import { format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBrasiliaDateTime } from "@/lib/timezone";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useManagerCnpjs } from "@/hooks/useManagerCnpjs";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, TrendingDown, DollarSign, User, Package, FileDown, FileText, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--destructive))", "hsl(210, 70%, 50%)",
  "hsl(150, 60%, 40%)", "hsl(40, 80%, 50%)", "hsl(280, 60%, 50%)",
  "hsl(0, 70%, 60%)", "hsl(180, 50%, 45%)",
];

const currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pctFmt = (v: number) => `${v.toFixed(1)}%`;

function getProblemBadge(pct: number) {
  if (pct < 5) return <Badge className="bg-green-600 text-white">Bom ({pctFmt(pct)})</Badge>;
  if (pct < 10) return <Badge className="bg-yellow-500 text-black">Atenção ({pctFmt(pct)})</Badge>;
  return <Badge variant="destructive">Crítico ({pctFmt(pct)})</Badge>;
}

export default function EpiDamageReport() {
  const { organization, isOrgAdmin } = useAuth();
  const { managerCnpjIds, managerSectorIds } = useManagerCnpjs();
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 6), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterSector, setFilterSector] = useState("all");
  const [filterFunction, setFilterFunction] = useState("all");
  const [filterManufacturer, setFilterManufacturer] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCnpj, setFilterCnpj] = useState("all");

  // Fetch reference data
  const { data: cnpjs } = useQuery({
    queryKey: ["org-cnpjs", organization?.id],
    queryFn: async () => {
      const { data } = await supabase.from("organization_cnpjs").select("id, cnpj, company_name")
        .eq("organization_id", organization!.id).eq("is_active", true).order("company_name");
      return data || [];
    },
    enabled: !!organization?.id,
  });
  const { data: sectors } = useQuery({
    queryKey: ["sectors", organization?.id],
    queryFn: async () => {
      const { data } = await supabase.from("sectors").select("id, name").eq("organization_id", organization!.id).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const { data: jobFunctions } = useQuery({
    queryKey: ["job-functions", organization?.id],
    queryFn: async () => {
      const { data } = await supabase.from("job_functions").select("id, name, sector_id").eq("organization_id", organization!.id).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const { data: categories } = useQuery({
    queryKey: ["epi-categories", organization?.id],
    queryFn: async () => {
      const { data } = await supabase.from("epi_categories").select("id, name").eq("organization_id", organization!.id).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!organization?.id,
  });

  // All deliveries in period
  const { data: allDeliveries = [], isLoading } = useQuery({
    queryKey: ["epi-damage-deliveries", organization?.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_deliveries")
        .select(`
          id, quantity, status, delivery_date, epi_id, employee_record_id, unit_cost,
          epis:epi_id (id, name, manufacturer, average_cost, ca_number, category_id),
          employees:employee_record_id (id, name, sector_id, job_function_id, organization_cnpj_id)
        `)
        .eq("organization_id", organization!.id)
        .gte("delivery_date", startDate)
        .lte("delivery_date", endDate + "T23:59:59");
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  // Apply filters
  const deliveries = useMemo(() => {
    return allDeliveries.filter((d: any) => {
      const emp = d.employees as any;
      const epi = d.epis as any;
      // Manager visibility filter
      if (managerCnpjIds !== null) {
        if (!emp?.organization_cnpj_id || !managerCnpjIds.includes(emp.organization_cnpj_id)) return false;
      }
      if (managerSectorIds !== null) {
        if (!emp?.sector_id || !managerSectorIds.includes(emp.sector_id)) return false;
      }
      if (filterSector !== "all" && emp?.sector_id !== filterSector) return false;
      if (filterFunction !== "all" && emp?.job_function_id !== filterFunction) return false;
      if (filterManufacturer !== "all" && epi?.manufacturer !== filterManufacturer) return false;
      if (filterCategory !== "all" && epi?.category_id !== filterCategory) return false;
      if (filterCnpj !== "all" && emp?.organization_cnpj_id !== filterCnpj) return false;
      return true;
    });
  }, [allDeliveries, filterSector, filterFunction, filterManufacturer, filterCategory, filterCnpj, managerCnpjIds, managerSectorIds]);

  // Unique manufacturers for filter
  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    allDeliveries.forEach((d: any) => {
      const m = (d.epis as any)?.manufacturer;
      if (m) set.add(m);
    });
    return Array.from(set).sort();
  }, [allDeliveries]);

  // Computed data
  const stats = useMemo(() => {
    const total = deliveries.length;
    const damaged = deliveries.filter((d: any) => d.status === "damaged");
    const lost = deliveries.filter((d: any) => d.status === "lost");
    const delivered = deliveries.filter((d: any) => d.status === "delivered");
    const problems = [...damaged, ...lost];

    const damagedPct = total ? (damaged.length / total) * 100 : 0;
    const lostPct = total ? (lost.length / total) * 100 : 0;

    const costReducer = (items: any[]) =>
      items.reduce((sum: number, d: any) => {
        const cost = d.unit_cost ?? (d.epis as any)?.average_cost ?? 0;
        return sum + cost * d.quantity;
      }, 0);

    const deliveredCost = costReducer(delivered);
    const lostCost = costReducer(lost);
    const damagedCost = costReducer(damaged);

    // EPI with most problems
    const epiProblems: Record<string, { name: string; count: number }> = {};
    problems.forEach((d: any) => {
      const epi = d.epis as any;
      if (!epi) return;
      if (!epiProblems[epi.id]) epiProblems[epi.id] = { name: epi.name, count: 0 };
      epiProblems[epi.id].count += d.quantity;
    });
    const topEpi = Object.values(epiProblems).sort((a, b) => b.count - a.count)[0];

    // Employee with most incidents
    const empProblems: Record<string, { name: string; count: number }> = {};
    problems.forEach((d: any) => {
      const emp = d.employees as any;
      if (!emp) return;
      if (!empProblems[emp.id]) empProblems[emp.id] = { name: emp.name, count: 0 };
      empProblems[emp.id].count += d.quantity;
    });
    const topEmployee = Object.values(empProblems).sort((a, b) => b.count - a.count)[0];

    return { total, damagedCount: damaged.length, lostCount: lost.length, damagedPct, lostPct, deliveredCost, lostCost, damagedCost, topEpi, topEmployee };
  }, [deliveries]);

  // Chart data: EPI ranking
  const epiRankingData = useMemo(() => {
    const map: Record<string, { name: string; damaged: number; lost: number }> = {};
    deliveries.filter((d: any) => d.status === "damaged" || d.status === "lost").forEach((d: any) => {
      const epi = d.epis as any;
      if (!epi) return;
      if (!map[epi.id]) map[epi.id] = { name: epi.name, damaged: 0, lost: 0 };
      if (d.status === "damaged") map[epi.id].damaged += d.quantity;
      else map[epi.id].lost += d.quantity;
    });
    return Object.values(map).sort((a, b) => (b.damaged + b.lost) - (a.damaged + a.lost)).slice(0, 10);
  }, [deliveries]);

  // Chart data: by manufacturer
  const manufacturerData = useMemo(() => {
    const map: Record<string, number> = {};
    deliveries.filter((d: any) => d.status === "damaged" || d.status === "lost").forEach((d: any) => {
      const m = (d.epis as any)?.manufacturer || "Sem marca";
      map[m] = (map[m] || 0) + d.quantity;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [deliveries]);

  // Chart data: trend over time
  const trendData = useMemo(() => {
    const map: Record<string, { month: string; damaged: number; lost: number }> = {};
    deliveries.filter((d: any) => d.status === "damaged" || d.status === "lost").forEach((d: any) => {
      const d_date = new Date(d.delivery_date);
      const monthKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(d_date);
      const monthLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "short", year: "2-digit" }).format(d_date);
      if (!map[monthKey]) map[monthKey] = { month: monthLabel, damaged: 0, lost: 0 };
      if (d.status === "damaged") map[monthKey].damaged += d.quantity;
      else map[monthKey].lost += d.quantity;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [deliveries]);

  // Chart data: employee ranking
  const employeeRankingData = useMemo(() => {
    const map: Record<string, { name: string; damaged: number; lost: number }> = {};
    deliveries.filter((d: any) => d.status === "damaged" || d.status === "lost").forEach((d: any) => {
      const emp = d.employees as any;
      if (!emp) return;
      if (!map[emp.id]) map[emp.id] = { name: emp.name, damaged: 0, lost: 0 };
      if (d.status === "damaged") map[emp.id].damaged += d.quantity;
      else map[emp.id].lost += d.quantity;
    });
    return Object.values(map).sort((a, b) => (b.damaged + b.lost) - (a.damaged + a.lost)).slice(0, 10);
  }, [deliveries]);

  // Report: by EPI
  const reportByEpi = useMemo(() => {
    const map: Record<string, { name: string; manufacturer: string; delivered: number; damaged: number; lost: number }> = {};
    deliveries.forEach((d: any) => {
      const epi = d.epis as any;
      if (!epi) return;
      if (!map[epi.id]) map[epi.id] = { name: epi.name, manufacturer: epi.manufacturer || "—", delivered: 0, damaged: 0, lost: 0 };
      map[epi.id].delivered += d.quantity;
      if (d.status === "damaged") map[epi.id].damaged += d.quantity;
      if (d.status === "lost") map[epi.id].lost += d.quantity;
    });
    return Object.values(map).map(r => ({
      ...r,
      failPct: r.delivered > 0 ? ((r.damaged + r.lost) / r.delivered) * 100 : 0,
    }));
  }, [deliveries]);

  // Report: by employee
  const reportByEmployee = useMemo(() => {
    const map: Record<string, { name: string; sectorId: string | null; functionId: string | null; received: number; damaged: number; lost: number }> = {};
    deliveries.forEach((d: any) => {
      const emp = d.employees as any;
      if (!emp) return;
      if (!map[emp.id]) map[emp.id] = { name: emp.name, sectorId: emp.sector_id, functionId: emp.job_function_id, received: 0, damaged: 0, lost: 0 };
      map[emp.id].received += d.quantity;
      if (d.status === "damaged") map[emp.id].damaged += d.quantity;
      if (d.status === "lost") map[emp.id].lost += d.quantity;
    });
    return Object.values(map).map(r => ({
      ...r,
      sectorName: sectors?.find(s => s.id === r.sectorId)?.name || "—",
      functionName: jobFunctions?.find(f => f.id === r.functionId)?.name || "—",
      incidencePct: r.received > 0 ? ((r.damaged + r.lost) / r.received) * 100 : 0,
    }));
  }, [deliveries, sectors, jobFunctions]);

  // Report: by manufacturer
  const reportByManufacturer = useMemo(() => {
    const map: Record<string, { manufacturer: string; supplied: number; defective: number }> = {};
    deliveries.forEach((d: any) => {
      const m = (d.epis as any)?.manufacturer || "Sem marca";
      if (!map[m]) map[m] = { manufacturer: m, supplied: 0, defective: 0 };
      map[m].supplied += d.quantity;
      if (d.status === "damaged" || d.status === "lost") map[m].defective += d.quantity;
    });
    return Object.values(map).map(r => ({
      ...r,
      failPct: r.supplied > 0 ? (r.defective / r.supplied) * 100 : 0,
    })).sort((a, b) => b.failPct - a.failPct);
  }, [deliveries]);

  // Cross-analysis matrix
  const matrixData = useMemo(() => {
    const map: Record<string, { epi: string; manufacturer: string; sector: string; func: string; count: number }> = {};
    deliveries.filter((d: any) => d.status === "damaged" || d.status === "lost").forEach((d: any) => {
      const epi = d.epis as any;
      const emp = d.employees as any;
      const key = `${epi?.id}-${emp?.sector_id}-${emp?.job_function_id}`;
      if (!map[key]) {
        map[key] = {
          epi: epi?.name || "—",
          manufacturer: epi?.manufacturer || "—",
          sector: sectors?.find(s => s.id === emp?.sector_id)?.name || "—",
          func: jobFunctions?.find(f => f.id === emp?.job_function_id)?.name || "—",
          count: 0,
        };
      }
      map[key].count += d.quantity;
    });
    return Object.values(map);
  }, [deliveries, sectors, jobFunctions]);

  const { sortedItems: sortedMatrix, sortField: mSortField, sortDirection: mSortDir, handleSort: mHandleSort } = useTableSort(matrixData);
  const matrixPag = usePagination(sortedMatrix);

  const { sortedItems: sortedEpiReport, sortField: eSortField, sortDirection: eSortDir, handleSort: eHandleSort } = useTableSort(reportByEpi);
  const epiReportPag = usePagination(sortedEpiReport);

  const { sortedItems: sortedEmpReport, sortField: empSortField, sortDirection: empSortDir, handleSort: empHandleSort } = useTableSort(reportByEmployee);
  const empReportPag = usePagination(sortedEmpReport);

  const { sortedItems: sortedMfgReport, sortField: mfgSortField, sortDirection: mfgSortDir, handleSort: mfgHandleSort } = useTableSort(reportByManufacturer);
  const mfgReportPag = usePagination(sortedMfgReport);

  // Export helpers
  const addPdfHeader = async (doc: jsPDF, title: string) => {
    let startY = 15;
    if (organization?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); img.src = organization.logo_url!; });
        doc.addImage(img, "PNG", 14, 10, 30, 30);
      } catch { /* continue */ }
    }
    const xText = organization?.logo_url ? 50 : 14;
    doc.setFontSize(16);
    doc.text(organization?.name || "Relatório", xText, startY);
    doc.setFontSize(11);
    doc.text(title, xText, startY + 7);
    doc.setFontSize(9);
    doc.text(`Período: ${format(parseISO(startDate), "dd/MM/yyyy")} a ${format(parseISO(endDate), "dd/MM/yyyy")}`, xText, startY + 13);
    doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, xText, startY + 18);
    return startY + 28;
  };

  const exportEpiReportExcel = () => {
    const rows = reportByEpi.map(r => ({ EPI: r.name, Marca: r.manufacturer, "Total Entregue": r.delivered, Danificados: r.damaged, Perdidos: r.lost, "% Falha": Number(r.failPct.toFixed(1)) }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danos por EPI");
    XLSX.writeFile(wb, "relatorio-danos-epi.xlsx");
  };

  const exportEpiReportPdf = async () => {
    const doc = new jsPDF();
    const y = await addPdfHeader(doc, "Relatório de Danos por EPI");
    autoTable(doc, {
      startY: y,
      head: [["EPI", "Marca", "Entregues", "Danificados", "Perdidos", "% Falha"]],
      body: reportByEpi.map(r => [r.name, r.manufacturer, r.delivered, r.damaged, r.lost, pctFmt(r.failPct)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save("relatorio-danos-epi.pdf");
  };

  const exportEmpReportExcel = () => {
    const rows = reportByEmployee.map(r => ({ Funcionário: r.name, Setor: r.sectorName, Função: r.functionName, Recebidos: r.received, Danificados: r.damaged, Perdidos: r.lost, "% Incidência": Number(r.incidencePct.toFixed(1)) }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danos por Funcionário");
    XLSX.writeFile(wb, "relatorio-danos-funcionario.xlsx");
  };

  const exportEmpReportPdf = async () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const y = await addPdfHeader(doc, "Relatório por Funcionário");
    autoTable(doc, {
      startY: y,
      head: [["Funcionário", "Setor", "Função", "Recebidos", "Danificados", "Perdidos", "% Incidência"]],
      body: reportByEmployee.sort((a, b) => b.incidencePct - a.incidencePct).map(r => [r.name, r.sectorName, r.functionName, r.received, r.damaged, r.lost, pctFmt(r.incidencePct)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save("relatorio-funcionario.pdf");
  };

  const exportMfgReportExcel = () => {
    const rows = reportByManufacturer.map(r => ({ Marca: r.manufacturer, Fornecidos: r.supplied, "Com Defeito": r.defective, "% Falha": Number(r.failPct.toFixed(1)) }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Qualidade por Marca");
    XLSX.writeFile(wb, "relatorio-qualidade-marca.xlsx");
  };

  const exportMfgReportPdf = async () => {
    const doc = new jsPDF();
    const y = await addPdfHeader(doc, "Relatório de Qualidade por Marca");
    autoTable(doc, {
      startY: y,
      head: [["Marca", "Fornecidos", "Com Defeito", "% Falha"]],
      body: reportByManufacturer.map(r => [r.manufacturer, r.supplied, r.defective, pctFmt(r.failPct)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save("relatorio-qualidade-marca.pdf");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Análise de Danos e Perdas de EPIs
        </h1>
        <p className="text-muted-foreground">Dashboard estratégico para redução de custos e identificação de problemas</p>
      </div>

      {/* Global Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>Data Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label>Data Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[160px]" />
            </div>
            {cnpjs && cnpjs.length > 1 && (
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Select value={filterCnpj} onValueChange={setFilterCnpj}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {cnpjs.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
             <div className="space-y-1">
              <Label>Setor</Label>
              <Select value={filterSector} onValueChange={setFilterSector}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {sectors?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Função</Label>
              <Select value={filterFunction} onValueChange={setFilterFunction}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {jobFunctions?.filter(f => filterSector === "all" || f.sector_id === filterSector).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Marca</Label>
              <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {manufacturers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando dados...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{pctFmt(stats.damagedPct)}</p>
                    <p className="text-xs text-muted-foreground">EPIs Danificados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold">{pctFmt(stats.lostPct)}</p>
                    <p className="text-xs text-muted-foreground">EPIs Perdidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm font-bold truncate">{stats.topEpi?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">EPI com mais problemas ({stats.topEpi?.count || 0})</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <User className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-sm font-bold truncate">{stats.topEmployee?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">Maior incidência ({stats.topEmployee?.count || 0})</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{currencyFmt.format(stats.deliveredCost)}</p>
                    <p className="text-xs text-muted-foreground">Custo de EPI</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold">{currencyFmt.format(stats.lostCost)}</p>
                    <p className="text-xs text-muted-foreground">Custo de EPI Perdido</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{currencyFmt.format(stats.damagedCost)}</p>
                    <p className="text-xs text-muted-foreground">Custo de EPI Danificado</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* EPI Ranking */}
            <Card>
              <CardHeader><CardTitle className="text-base">Ranking de EPIs com mais ocorrências</CardTitle></CardHeader>
              <CardContent>
                {epiRankingData.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados</p> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={epiRankingData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="damaged" name="Danificado" fill="hsl(var(--destructive))" stackId="a" />
                      <Bar dataKey="lost" name="Perdido" fill="hsl(40, 80%, 50%)" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* By manufacturer */}
            <Card>
              <CardHeader><CardTitle className="text-base">Análise de danos por marca</CardTitle></CardHeader>
              <CardContent>
                {manufacturerData.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados</p> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={manufacturerData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {manufacturerData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Trend */}
            <Card>
              <CardHeader><CardTitle className="text-base">Histórico de Danos e Perdas</CardTitle></CardHeader>
              <CardContent>
                {trendData.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados</p> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="damaged" name="Danificado" stroke="hsl(var(--destructive))" strokeWidth={2} />
                      <Line type="monotone" dataKey="lost" name="Perdido" stroke="hsl(40, 80%, 50%)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Employee ranking */}
            <Card>
              <CardHeader><CardTitle className="text-base">Ranking de funcionários com maior incidência</CardTitle></CardHeader>
              <CardContent>
                {employeeRankingData.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados</p> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={employeeRankingData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="damaged" name="Danificado" fill="hsl(var(--destructive))" stackId="a" />
                      <Bar dataKey="lost" name="Perdido" fill="hsl(40, 80%, 50%)" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cross-analysis matrix */}
          <Card>
            <CardHeader><CardTitle className="text-base">Matriz Analítica Cruzada</CardTitle></CardHeader>
            <CardContent>
              {matrixData.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados de ocorrências</p> : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead field="epi" sortField={mSortField} sortDirection={mSortDir} onSort={mHandleSort}>EPI</SortableTableHead>
                        <SortableTableHead field="manufacturer" sortField={mSortField} sortDirection={mSortDir} onSort={mHandleSort}>Marca</SortableTableHead>
                        <SortableTableHead field="sector" sortField={mSortField} sortDirection={mSortDir} onSort={mHandleSort}>Setor</SortableTableHead>
                        <SortableTableHead field="func" sortField={mSortField} sortDirection={mSortDir} onSort={mHandleSort}>Função</SortableTableHead>
                        <SortableTableHead field="count" sortField={mSortField} sortDirection={mSortDir} onSort={mHandleSort} className="text-center">Ocorrências</SortableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matrixPag.paginatedItems.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.epi}</TableCell>
                          <TableCell>{row.manufacturer}</TableCell>
                          <TableCell>{row.sector}</TableCell>
                          <TableCell>{row.func}</TableCell>
                          <TableCell className="text-center font-bold">{row.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination currentPage={matrixPag.currentPage} totalPages={matrixPag.totalPages} totalItems={matrixPag.totalItems} pageSize={matrixPag.pageSize} onPageChange={matrixPag.setCurrentPage} onPageSizeChange={matrixPag.setPageSize} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Detailed Reports Tabs */}
          <Tabs defaultValue="by-epi">
            <TabsList>
              <TabsTrigger value="by-epi">Por EPI</TabsTrigger>
              <TabsTrigger value="by-employee">Por Funcionário</TabsTrigger>
              <TabsTrigger value="by-manufacturer">Por Marca</TabsTrigger>
            </TabsList>

            <TabsContent value="by-epi">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Relatório de Danos por EPI</CardTitle>
                    <CardDescription>Índice de problema: Verde &lt;5% | Amarelo 5-10% | Vermelho &gt;10%</CardDescription>
                  </div>
                  {reportByEpi.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportEpiReportExcel}><FileDown className="mr-1 h-4 w-4" />Excel</Button>
                      <Button variant="outline" size="sm" onClick={exportEpiReportPdf}><FileText className="mr-1 h-4 w-4" />PDF</Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {reportByEpi.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados</p> : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <SortableTableHead field="name" sortField={eSortField} sortDirection={eSortDir} onSort={eHandleSort}>EPI</SortableTableHead>
                            <SortableTableHead field="manufacturer" sortField={eSortField} sortDirection={eSortDir} onSort={eHandleSort}>Marca</SortableTableHead>
                            <SortableTableHead field="delivered" sortField={eSortField} sortDirection={eSortDir} onSort={eHandleSort} className="text-center">Entregues</SortableTableHead>
                            <SortableTableHead field="damaged" sortField={eSortField} sortDirection={eSortDir} onSort={eHandleSort} className="text-center">Danificados</SortableTableHead>
                            <SortableTableHead field="lost" sortField={eSortField} sortDirection={eSortDir} onSort={eHandleSort} className="text-center">Perdidos</SortableTableHead>
                            <SortableTableHead field="failPct" sortField={eSortField} sortDirection={eSortDir} onSort={eHandleSort} className="text-center">% Falha</SortableTableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {epiReportPag.paginatedItems.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{r.name}</TableCell>
                              <TableCell>{r.manufacturer}</TableCell>
                              <TableCell className="text-center">{r.delivered}</TableCell>
                              <TableCell className="text-center">{r.damaged}</TableCell>
                              <TableCell className="text-center">{r.lost}</TableCell>
                              <TableCell className="text-center">{getProblemBadge(r.failPct)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <TablePagination currentPage={epiReportPag.currentPage} totalPages={epiReportPag.totalPages} totalItems={epiReportPag.totalItems} pageSize={epiReportPag.pageSize} onPageChange={epiReportPag.setCurrentPage} onPageSizeChange={epiReportPag.setPageSize} />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="by-employee">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Relatório por Funcionário</CardTitle>
                    <CardDescription>Ordenado por maior taxa de incidência</CardDescription>
                  </div>
                  {reportByEmployee.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportEmpReportExcel}><FileDown className="mr-1 h-4 w-4" />Excel</Button>
                      <Button variant="outline" size="sm" onClick={exportEmpReportPdf}><FileText className="mr-1 h-4 w-4" />PDF</Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {reportByEmployee.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados</p> : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <SortableTableHead field="name" sortField={empSortField} sortDirection={empSortDir} onSort={empHandleSort}>Funcionário</SortableTableHead>
                            <SortableTableHead field="sectorName" sortField={empSortField} sortDirection={empSortDir} onSort={empHandleSort}>Setor</SortableTableHead>
                            <SortableTableHead field="functionName" sortField={empSortField} sortDirection={empSortDir} onSort={empHandleSort}>Função</SortableTableHead>
                            <SortableTableHead field="received" sortField={empSortField} sortDirection={empSortDir} onSort={empHandleSort} className="text-center">Recebidos</SortableTableHead>
                            <SortableTableHead field="damaged" sortField={empSortField} sortDirection={empSortDir} onSort={empHandleSort} className="text-center">Danificados</SortableTableHead>
                            <SortableTableHead field="lost" sortField={empSortField} sortDirection={empSortDir} onSort={empHandleSort} className="text-center">Perdidos</SortableTableHead>
                            <SortableTableHead field="incidencePct" sortField={empSortField} sortDirection={empSortDir} onSort={empHandleSort} className="text-center">% Incidência</SortableTableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {empReportPag.paginatedItems.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{r.name}</TableCell>
                              <TableCell>{r.sectorName}</TableCell>
                              <TableCell>{r.functionName}</TableCell>
                              <TableCell className="text-center">{r.received}</TableCell>
                              <TableCell className="text-center">{r.damaged}</TableCell>
                              <TableCell className="text-center">{r.lost}</TableCell>
                              <TableCell className="text-center">{getProblemBadge(r.incidencePct)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <TablePagination currentPage={empReportPag.currentPage} totalPages={empReportPag.totalPages} totalItems={empReportPag.totalItems} pageSize={empReportPag.pageSize} onPageChange={empReportPag.setCurrentPage} onPageSizeChange={empReportPag.setPageSize} />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="by-manufacturer">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Relatório de Qualidade por Marca</CardTitle>
                    <CardDescription>Ranking da pior para a melhor marca</CardDescription>
                  </div>
                  {reportByManufacturer.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportMfgReportExcel}><FileDown className="mr-1 h-4 w-4" />Excel</Button>
                      <Button variant="outline" size="sm" onClick={exportMfgReportPdf}><FileText className="mr-1 h-4 w-4" />PDF</Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {reportByManufacturer.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados</p> : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <SortableTableHead field="manufacturer" sortField={mfgSortField} sortDirection={mfgSortDir} onSort={mfgHandleSort}>Marca</SortableTableHead>
                            <SortableTableHead field="supplied" sortField={mfgSortField} sortDirection={mfgSortDir} onSort={mfgHandleSort} className="text-center">Fornecidos</SortableTableHead>
                            <SortableTableHead field="defective" sortField={mfgSortField} sortDirection={mfgSortDir} onSort={mfgHandleSort} className="text-center">Com Defeito</SortableTableHead>
                            <SortableTableHead field="failPct" sortField={mfgSortField} sortDirection={mfgSortDir} onSort={mfgHandleSort} className="text-center">% Falha</SortableTableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mfgReportPag.paginatedItems.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{r.manufacturer}</TableCell>
                              <TableCell className="text-center">{r.supplied}</TableCell>
                              <TableCell className="text-center">{r.defective}</TableCell>
                              <TableCell className="text-center">{getProblemBadge(r.failPct)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <TablePagination currentPage={mfgReportPag.currentPage} totalPages={mfgReportPag.totalPages} totalItems={mfgReportPag.totalItems} pageSize={mfgReportPag.pageSize} onPageChange={mfgReportPag.setCurrentPage} onPageSizeChange={mfgReportPag.setPageSize} />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

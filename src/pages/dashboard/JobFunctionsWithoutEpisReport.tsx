import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { AlertTriangle, Briefcase, FileDown, Settings2, CheckCircle2, Search } from "lucide-react";
import * as XLSX from "xlsx";

interface JobFunctionRow {
  id: string;
  name: string;
  is_active: boolean;
  sector_id: string | null;
  sectors?: { name: string } | null;
}

export default function JobFunctionsWithoutEpisReport() {
  const { organization } = useAuth();
  const navigate = useNavigate();

  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");

  // Job functions
  const { data: jobFunctions = [], isLoading: loadingFns } = useQuery({
    queryKey: ["job-functions-report", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_functions")
        .select("id, name, is_active, sector_id, sectors(name)")
        .eq("organization_id", organization!.id)
        .order("name");
      if (error) throw error;
      return (data || []) as JobFunctionRow[];
    },
    enabled: !!organization?.id,
  });

  // Sector_function_epis (only need distinct job_function_id) — paginated to bypass 1000-row limit
  const { data: sfEpis = [], isLoading: loadingEpis } = useQuery({
    queryKey: ["sector-function-epis-ids", organization?.id],
    queryFn: async () => {
      const ids = new Set<string>();
      const PAGE = 1000;
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("sector_function_epis")
          .select("job_function_id")
          .eq("organization_id", organization!.id)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        for (const r of rows) {
          if ((r as any).job_function_id) ids.add((r as any).job_function_id);
        }
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return Array.from(ids).map((id) => ({ job_function_id: id }));
    },
    enabled: !!organization?.id,
  });

  // Active employees count by function — paginated to bypass 1000-row limit
  const { data: employeeCounts = {}, isLoading: loadingEmps } = useQuery({
    queryKey: ["employees-by-function", organization?.id],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const PAGE = 1000;
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("employees")
          .select("job_function_id")
          .eq("organization_id", organization!.id)
          .eq("is_active", true)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        for (const e of rows) {
          if ((e as any).job_function_id) {
            counts[(e as any).job_function_id] = (counts[(e as any).job_function_id] || 0) + 1;
          }
        }
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return counts;
    },
    enabled: !!organization?.id,
  });

  // Sectors for filter
  const sectorsList = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of jobFunctions) {
      if (f.sector_id && f.sectors?.name) map.set(f.sector_id, f.sectors.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [jobFunctions]);

  const funcsWithEpiSet = useMemo(() => {
    return new Set(sfEpis.map((s: any) => s.job_function_id));
  }, [sfEpis]);

  // Functions without EPIs (after active filter)
  const baseList = useMemo(() => {
    return jobFunctions
      .filter((f) => includeInactive || f.is_active)
      .filter((f) => !funcsWithEpiSet.has(f.id));
  }, [jobFunctions, funcsWithEpiSet, includeInactive]);

  const filteredList = useMemo(() => {
    let list = baseList;
    if (sectorFilter !== "all") {
      list = list.filter((f) => f.sector_id === sectorFilter);
    }
    if (search.trim()) {
      const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      const q = norm(search.trim());
      list = list.filter(
        (f) => norm(f.name).includes(q) || norm(f.sectors?.name || "").includes(q),
      );
    }
    return list.map((f) => ({
      ...f,
      sector_name: f.sectors?.name || "—",
      employees_count: employeeCounts[f.id] || 0,
    }));
  }, [baseList, sectorFilter, search, employeeCounts]);

  const { sortedItems, sortField, sortDirection, handleSort } = useTableSort(filteredList);
  const { paginatedItems, ...pag } = usePagination(sortedItems);

  // Summary
  const totalActive = jobFunctions.filter((f) => f.is_active).length;
  const withoutEpisActive = jobFunctions.filter((f) => f.is_active && !funcsWithEpiSet.has(f.id)).length;
  const withEpisActive = totalActive - withoutEpisActive;
  const coverage = totalActive > 0 ? Math.round((withEpisActive / totalActive) * 100) : 0;
  const employeesAffected = filteredList.reduce((sum, f) => sum + f.employees_count, 0);

  const isLoading = loadingFns || loadingEpis || loadingEmps;

  const handleExport = () => {
    const rows = sortedItems.map((f) => ({
      "Função": f.name,
      "Setor": f.sector_name,
      "Status": f.is_active ? "Ativa" : "Inativa",
      "Funcionários Ativos": f.employees_count,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funções sem EPIs");
    XLSX.writeFile(wb, "funcoes-sem-epis.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Funções sem EPIs</h1>
        <p className="text-muted-foreground">
          Identifique funções que ainda não possuem EPIs configurados na matriz Setor/Função × EPI.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Funções Ativas</p>
                <p className="text-2xl font-bold">{totalActive}</p>
              </div>
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sem EPIs</p>
                <p className="text-2xl font-bold text-destructive">{withoutEpisActive}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com EPIs</p>
                <p className="text-2xl font-bold text-primary">{withEpisActive}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cobertura</p>
                <p className="text-2xl font-bold">{coverage}%</p>
              </div>
              <Badge variant={coverage === 100 ? "default" : coverage >= 70 ? "secondary" : "destructive"}>
                {coverage === 100 ? "Completa" : coverage >= 70 ? "Parcial" : "Crítica"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 flex-1 min-w-[220px]">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Função ou setor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {sectorsList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} id="include-inactive" />
              <Label htmlFor="include-inactive" className="cursor-pointer">Incluir inativas</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Funções sem EPIs configurados
            </CardTitle>
            <CardDescription>
              {filteredList.length} função(ões){" "}
              {employeesAffected > 0 && (
                <>
                  · <span className="text-destructive font-medium">{employeesAffected} funcionário(s) ativo(s) afetado(s)</span>
                </>
              )}
            </CardDescription>
          </div>
          {sortedItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" /> Excel
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="mx-auto h-12 w-12 mb-4 text-primary opacity-70" />
              <p className="font-medium">Nenhuma função sem EPIs encontrada.</p>
              <p className="text-sm">Todas as funções{includeInactive ? "" : " ativas"} possuem EPIs configurados.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                      Função
                    </SortableTableHead>
                    <SortableTableHead field="sector_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                      Setor
                    </SortableTableHead>
                    <SortableTableHead field="is_active" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                      Status
                    </SortableTableHead>
                    <SortableTableHead field="employees_count" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-center">
                      Funcionários
                    </SortableTableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell>{f.sector_name}</TableCell>
                      <TableCell>
                        <Badge variant={f.is_active ? "default" : "secondary"}>
                          {f.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {f.employees_count > 0 ? (
                          <Badge variant="destructive">{f.employees_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/dashboard/sector-function-epis")}
                        >
                          <Settings2 className="mr-1 h-3 w-3" /> Configurar EPIs
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pag.currentPage}
                totalPages={pag.totalPages}
                totalItems={pag.totalItems}
                pageSize={pag.pageSize}
                onPageChange={pag.setCurrentPage}
                onPageSizeChange={pag.setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

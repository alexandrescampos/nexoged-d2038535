import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTableHead } from "@/components/SortableTableHead";
import { 
  RefreshCw, Database, CheckCircle2, AlertCircle, Loader2, Upload, 
  XCircle, Ban, Search, FileText, ChevronLeft, ChevronRight, Info, Filter, X
} from "lucide-react";
import { toast } from "sonner";
import { formatBrasiliaDateTime, formatBrasiliaDate } from "@/lib/timezone";

export default function CaepiSyncPage() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [autoSyncSaving, setAutoSyncSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Explorador states
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortField, setSortField] = useState<string>("ca_number");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedCA, setSelectedCA] = useState<any>(null);
  const pageSize = 15;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const { data: autoSyncSetting } = useQuery({
    queryKey: ["system-setting", "caepi_auto_sync_enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "caepi_auto_sync_enabled")
        .maybeSingle();
      return data?.value ?? "true";
    },
  });

  useEffect(() => {
    if (autoSyncSetting !== undefined) setAutoSync(autoSyncSetting !== "false");
  }, [autoSyncSetting]);

  const { data: stats } = useQuery({
    queryKey: ["caepi-stats"],
    queryFn: async () => {
      const { count } = await supabase
        .from("caepi_certificates" as any)
        .select("*", { count: "exact", head: true });
      const { data: latest } = await supabase
        .from("caepi_certificates" as any)
        .select("last_synced_at")
        .order("last_synced_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { total: count ?? 0, lastSynced: (latest as any)?.last_synced_at as string | null };
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["caepi-sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caepi_sync_log" as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as any[]) || [];
    },
    refetchInterval: 5000,
  });

  const { data: explorerData, isLoading: isLoadingExplorer } = useQuery({
    queryKey: ["caepi-explorer", search, page, statusFilter, startDate, endDate, sortField, sortDirection],
    queryFn: async () => {
      let query = supabase
        .from("caepi_certificates" as any)
        .select("*", { count: "exact" });

      if (search) {
        if (/^\d+$/.test(search)) {
          query = query.ilike("ca_number", `%${search}%`);
        } else {
          query = query.ilike("equipment_name", `%${search}%`);
        }
      }

      if (statusFilter !== "all") {
        if (statusFilter === "VÁLIDO" || statusFilter === "VENCIDO") {
          query = query.eq("status", statusFilter);
        } else {
          // "Outros" - everything that is not VALID or EXPIRED
          query = query.not("status", "in", '("VÁLIDO","VENCIDO")');
        }
      }

      if (startDate) {
        query = query.gte("expiration_date", startDate);
      }

      if (endDate) {
        query = query.lte("expiration_date", endDate);
      }

      const { data, count, error } = await query
        .order(sortField, { ascending: sortDirection === "asc" })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;
      return { data: (data as any[]) || [], total: count ?? 0 };
    },
    enabled: true,
  });

  const hasRunning = logs.some((l: any) => l.status === "running");

  const handleSync = async () => {
    setRunning(true);
    toast.info("Sincronização iniciada. Pode levar alguns minutos.");
    const { error } = await invokeEdgeFunction("sync-caepi-database");
    setRunning(false);
    qc.invalidateQueries({ queryKey: ["caepi-sync-log"] });
    if (error) toast.error(error.message);
    else toast.success("Sincronização disparada. Acompanhe pelo histórico.");
  };

  const handleCancel = async () => {
    setCancelling(true);
    const { data, error } = await invokeEdgeFunction("sync-caepi-database", { phase: "cancel" });
    setCancelling(false);
    qc.invalidateQueries({ queryKey: ["caepi-sync-log"] });
    if (error) toast.error(error.message);
    else toast.success(`Cancelamento enviado (${(data as any)?.cancelled ?? 0} execuções).`);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".gz")) {
      toast.error("Envie um arquivo .csv.gz (gzip).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/sync-caepi-database?phase=upload`;
      const buf = await file.arrayBuffer();

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/gzip",
        },
        body: buf,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Falha (${res.status})`);

      toast.success("Arquivo enviado. Processamento iniciado em segundo plano.");
      qc.invalidateQueries({ queryKey: ["caepi-sync-log"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAutoSyncToggle = async (checked: boolean) => {
    setAutoSyncSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .upsert(
        { key: "caepi_auto_sync_enabled", value: checked ? "true" : "false", updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setAutoSyncSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAutoSync(checked);
    qc.invalidateQueries({ queryKey: ["system-setting", "caepi_auto_sync_enabled"] });
    toast.success(checked ? "Sincronização automática ativada." : "Sincronização automática desativada.");
  };

  const totalPages = Math.ceil((explorerData?.total ?? 0) / pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Base CAEPI (MTE)</h1>
          <p className="text-muted-foreground">
            Espelho da base oficial do Ministério do Trabalho para validação dos CAs cadastrados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasRunning && (
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
              Cancelar
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".gz,application/gzip"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" size="sm" onClick={handleUploadClick} disabled={uploading || hasRunning}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload
          </Button>
          <Button size="sm" onClick={handleSync} disabled={running || hasRunning}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de CAs</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              {(stats?.total ?? 0).toLocaleString("pt-BR")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última sincronização</CardDescription>
            <CardTitle className="text-base">
              {stats?.lastSynced ? formatBrasiliaDateTime(stats.lastSynced) : "Nunca"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Agenda automática</CardDescription>
            <CardTitle className="text-base">
              {autoSync ? "Domingo · 03:00 (BRT)" : "Desativada"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="explorer" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="explorer" className="gap-2">
            <Search className="h-4 w-4" /> Explorador
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Database className="h-4 w-4" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="explorer">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Explorador da Base</CardTitle>
              <CardDescription>
                Consulte a base de dados oficial do MTE.
                {typeof explorerData?.total === "number" && (
                  <> · {explorerData.total.toLocaleString("pt-BR")} {explorerData.total === 1 ? "CA encontrado" : "CAs encontrados"}</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap items-end gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Buscar</Label>
                  <div className="relative w-[280px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="CA ou Equipamento..."
                      className="pl-10"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="VÁLIDO">Somente Válidos</SelectItem>
                      <SelectItem value="VENCIDO">Somente Vencidos</SelectItem>
                      <SelectItem value="OUTROS">Outros Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vencimento de</Label>
                  <Input
                    type="date"
                    className="w-[170px]"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento até</Label>
                  <Input
                    type="date"
                    className="w-[170px]"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  />
                </div>
                {(search || statusFilter !== "all" || startDate || endDate) && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" /> Limpar filtros
                  </Button>
                )}
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead field="ca_number" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="w-24">CA</SortableTableHead>
                      <SortableTableHead field="equipment_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Equipamento</SortableTableHead>
                      <SortableTableHead field="manufacturer_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Fabricante</SortableTableHead>
                      <SortableTableHead field="expiration_date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Validade</SortableTableHead>
                      <SortableTableHead field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingExplorer ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
                          <p className="text-muted-foreground">Carregando base...</p>
                        </TableCell>
                      </TableRow>
                    ) : explorerData?.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          Nenhum certificado encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      explorerData?.data.map((ca: any) => (
                        <TableRow key={ca.ca_number} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCA(ca)}>
                          <TableCell className="font-medium">{ca.ca_number}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={ca.equipment_name}>{ca.equipment_name}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={ca.manufacturer_name}>{ca.manufacturer_name}</TableCell>
                          <TableCell>{ca.expiration_date ? formatBrasiliaDate(ca.expiration_date) : "—"}</TableCell>
                          <TableCell>
                            {ca.status === "VÁLIDO" ? (
                              <Badge variant="default" className="bg-green-600 hover:bg-green-700">Válido</Badge>
                            ) : ca.status === "VENCIDO" ? (
                              <Badge variant="destructive">Vencido</Badge>
                            ) : (
                              <Badge variant="secondary">{ca.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon">
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {page} de {totalPages} ({(explorerData?.total ?? 0).toLocaleString("pt-BR")} registros)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Próximo <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Sincronizações</CardTitle>
              <CardDescription>Últimas 20 execuções (manuais, upload e agendadas).</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma execução registrada ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell>{formatBrasiliaDateTime(l.started_at)}</TableCell>
                        <TableCell>
                          {l.status === "success" ? (
                            <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Sucesso</Badge>
                          ) : l.status === "running" ? (
                            <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Em execução</Badge>
                          ) : l.status === "cancelled" ? (
                            <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Cancelado</Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Falhou</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{l.total_records?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {l.duration_ms ? `${(l.duration_ms / 1000).toFixed(1)}s` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.triggered_by}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{l.error_message || ""}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Sincronização</CardTitle>
              <CardDescription>
                Controle como a base oficial é atualizada no sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-base">Sincronização Automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Executa o download oficial todo domingo às 03:00 (Horário de Brasília).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {autoSyncSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={autoSync}
                    disabled={autoSyncSaving}
                    onCheckedChange={handleAutoSyncToggle}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Sobre a Base CAEPI</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A base de Certificados de Aprovação (CA) é fornecida pelo Ministério do Trabalho e Emprego. 
                  Ela contém informações sobre a validade, fabricante e natureza de proteção de todos os EPIs homologados no Brasil.
                </p>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-400">
                      <strong>Aviso sobre Upload Manual:</strong> O sistema espera um arquivo <code>.csv.gz</code> (Gzip). 
                      Se você baixou o ZIP oficial do MTE, deve extrair o arquivo de texto interno e compactá-lo como Gzip antes de enviar.
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedCA} onOpenChange={(open) => !open && setSelectedCA(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={selectedCA?.status === "VÁLIDO" ? "default" : "destructive"}>
                CA {selectedCA?.ca_number}
              </Badge>
              <Badge variant="outline">{selectedCA?.status}</Badge>
            </div>
            <DialogTitle className="text-xl">{selectedCA?.equipment_name}</DialogTitle>
            <DialogDescription>Detalhes do certificado importado do Ministério do Trabalho.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase">Data de Validade</Label>
                <p className="font-medium">{selectedCA?.expiration_date ? formatBrasiliaDate(selectedCA.expiration_date) : "Não informada"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase">Número do Processo</Label>
                <p className="font-medium">{selectedCA?.process_number || "—"}</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase">Fabricante / Razão Social</Label>
              <p className="font-medium">{selectedCA?.manufacturer_name}</p>
              <p className="text-sm text-muted-foreground">CNPJ: {selectedCA?.manufacturer_cnpj || "Não informado"}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase">Descrição do Equipamento</Label>
              <p className="text-sm bg-muted p-3 rounded-md italic">
                {selectedCA?.equipment_description || "Sem descrição disponível."}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase">Natureza da Proteção</Label>
              <p className="text-sm">{selectedCA?.protection_nature || "—"}</p>
            </div>

            <div className="flex justify-between items-center pt-4 border-t text-[10px] text-muted-foreground uppercase tracking-widest">
              <span>Sincronizado em: {selectedCA?.last_synced_at ? formatBrasiliaDateTime(selectedCA.last_synced_at) : "—"}</span>
              <FileText className="h-3 w-3" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

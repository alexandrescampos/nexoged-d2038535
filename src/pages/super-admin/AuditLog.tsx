import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Search, FileDown, UserPlus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AuditLogPage() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchTerm, setSearchTerm] = useState("");

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["admin-audit-logs", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_audit_log")
        .select(`
          *,
          target:profiles!user_audit_log_target_user_id_fkey(full_name, email),
          performer:profiles!user_audit_log_performed_by_fkey(full_name, email),
          organization:organizations(name)
        `)
        .eq("action", "created")
        .gte("created_at", startOfDay(new Date(dateFrom)).toISOString())
        .lte("created_at", endOfDay(new Date(dateTo)).toISOString())
        .order("created_at", { ascending: false }) as any;

      if (error) {
        toast.error("Erro ao carregar logs: " + error.message);
        throw error;
      }
      return data;
    },
  });

  const filteredLogs = auditLogs?.filter(log => {
    const searchStr = `${log.target?.full_name} ${log.target?.email} ${log.organization?.name} ${log.ip_address} ${log.method}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const handleExport = () => {
    if (!filteredLogs || filteredLogs.length === 0) return;
    
    const headers = ["Data/Hora", "Login (Email)", "Nome", "Organização", "Meio", "IP", "Realizado por"];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
      log.target?.email || log.details?.email || "N/A",
      log.target?.full_name || log.details?.full_name || "N/A",
      log.organization?.name || "Global / Super Admin",
      log.method || log.source || "N/A",
      log.ip_address || "N/A",
      log.performer?.full_name || "Sistema"
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `auditoria_usuarios_${dateFrom}_a_${dateTo}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório exportado com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Auditoria de Criação de Usuários
          </h1>
          <p className="text-muted-foreground">
            Relatório detalhado de novos registros nos últimos 30 dias.
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" className="flex items-center gap-2">
          <FileDown className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">De</Label>
              <Input 
                id="dateFrom" 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Até</Label>
              <Input 
                id="dateTo" 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)} 
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="search">Busca Rápida (Email, Nome, Org, IP)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Filtrar resultados..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Total no Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Usuários criados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Meio Mais Comum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {auditLogs && auditLogs.length > 0 ? (
                Object.entries(auditLogs.reduce((acc, log) => {
                  const m = log.method || log.source || 'N/A';
                  acc[m] = (acc[m] || 0) + 1;
                  return acc;
                }, {} as any)).sort((a: any, b: any) => b[1] - a[1])[0][0]
              ) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Canal de entrada</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Pico de Criação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              {auditLogs && auditLogs.length > 0 ? (
                format(new Date(Object.entries(auditLogs.reduce((acc, log) => {
                  const d = format(new Date(log.created_at), "yyyy-MM-dd");
                  acc[d] = (acc[d] || 0) + 1;
                  return acc;
                }, {} as any)).sort((a: any, b: any) => b[1] - a[1])[0][0]), "dd/MM")
              ) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Dia com mais registros</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Organização</TableHead>
              <TableHead>Meio / IP</TableHead>
              <TableHead>Data e Hora</TableHead>
              <TableHead>Realizado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
              ))
            ) : filteredLogs && filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{log.target?.full_name || log.details?.full_name || "N/A"}</span>
                      <span className="text-xs text-muted-foreground">{log.target?.email || log.details?.email || "N/A"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.organization ? "outline" : "secondary"}>
                      {log.organization?.name || "Global"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <UserPlus className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium uppercase">{log.method || log.source || "N/A"}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">{log.ip_address || "IP não registrado"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.performer?.full_name || "Sistema / Auto"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Nenhum registro encontrado para este período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
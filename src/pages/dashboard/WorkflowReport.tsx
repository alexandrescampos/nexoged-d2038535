import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Download, ExternalLink, Workflow, CheckCircle2, PenLine } from "lucide-react";
import { policyExecutionRepository } from "@/repository/policyExecutionRepository";
import { formatBrasiliaDate } from "@/lib/timezone";

type Mode = "approvals" | "signatures" | "all";

const APPR_STATUS = ["TODOS", "PENDENTE", "APROVADA", "REPROVADA"];
const SIGN_STATUS = ["TODOS", "PENDENTE", "ASSINADA", "RECUSADA"];

function toCsv(rows: any[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WorkflowReport({ mode = "all" }: { mode?: Mode } = {}) {
  const navigate = useNavigate();
  const { organization } = useAuth();
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [apprStatus, setApprStatus] = useState("TODOS");
  const [signStatus, setSignStatus] = useState("TODOS");
  const [search, setSearch] = useState("");

  const orgId = organization?.id;
  const fromIso = startDate.toISOString();
  const toIso = endDate.toISOString();

  const approvalsQ = useQuery({
    queryKey: ["wf-report-approvals", orgId, fromIso, toIso],
    queryFn: () => policyExecutionRepository.listAllWorkflowApprovals(orgId!, fromIso, toIso),
    enabled: !!orgId,
  });

  const signaturesQ = useQuery({
    queryKey: ["wf-report-signatures", orgId, fromIso, toIso],
    queryFn: () => policyExecutionRepository.listAllWorkflowSignatures(orgId!, fromIso, toIso),
    enabled: !!orgId,
  });

  const filteredApprovals = useMemo(() => {
    const list = (approvalsQ.data || []) as any[];
    const s = search.trim().toLowerCase();
    return list.filter((a) => {
      if (apprStatus !== "TODOS" && a.status !== apprStatus) return false;
      if (s && !(a.documento?.nome || "").toLowerCase().includes(s) && !(a.documento?.codigo || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [approvalsQ.data, apprStatus, search]);

  const filteredSignatures = useMemo(() => {
    const list = (signaturesQ.data || []) as any[];
    const s = search.trim().toLowerCase();
    return list.filter((a) => {
      if (signStatus !== "TODOS" && a.status !== signStatus) return false;
      if (s && !(a.documento?.nome || "").toLowerCase().includes(s) && !(a.documento?.codigo || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [signaturesQ.data, signStatus, search]);

  const kpis = useMemo(() => {
    const a = (approvalsQ.data || []) as any[];
    const s = (signaturesQ.data || []) as any[];
    return {
      apprPend: a.filter((x) => x.status === "PENDENTE").length,
      apprOk: a.filter((x) => x.status === "APROVADA").length,
      apprRej: a.filter((x) => x.status === "REPROVADA").length,
      signPend: s.filter((x) => x.status === "PENDENTE").length,
      signOk: s.filter((x) => x.status === "ASSINADA").length,
      signRej: s.filter((x) => x.status === "RECUSADA").length,
    };
  }, [approvalsQ.data, signaturesQ.data]);

  const exportApprovals = () => {
    const rows = [
      ["Documento", "Código", "Etapa", "Ordem", "Perfil", "Status", "Aprovador", "Decidido em", "Comentário"],
      ...filteredApprovals.map((a: any) => [
        a.documento?.nome,
        a.documento?.codigo,
        a.nome_etapa,
        a.ordem,
        a.perfil?.perfil_nome,
        a.status,
        a.aprovador?.full_name,
        a.decidido_em ? formatBrasiliaDate(a.decidido_em) : "",
        a.comentario,
      ]),
    ];
    downloadCsv(`aprovacoes-${format(new Date(), "yyyy-MM-dd")}.csv`, toCsv(rows));
  };

  const exportSignatures = () => {
    const rows = [
      ["Documento", "Código", "Ordem", "Tipo", "Perfil", "Status", "Assinante", "Assinado em"],
      ...filteredSignatures.map((s: any) => [
        s.documento?.nome,
        s.documento?.codigo,
        s.ordem,
        s.tipo_assinatura,
        s.perfil?.perfil_nome,
        s.status,
        s.assinante?.full_name,
        s.assinado_em ? formatBrasiliaDate(s.assinado_em) : "",
      ]),
    ];
    downloadCsv(`assinaturas-${format(new Date(), "yyyy-MM-dd")}.csv`, toCsv(rows));
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDENTE: "bg-amber-500",
      APROVADA: "bg-emerald-600",
      ASSINADA: "bg-emerald-600",
      REPROVADA: "bg-red-600",
      RECUSADA: "bg-red-600",
    };
    return <Badge className={`${map[status] || "bg-slate-500"} text-white`}>{status}</Badge>;
  };

  const showApprovals = mode === "approvals" || mode === "all";
  const showSignatures = mode === "signatures" || mode === "all";
  const title =
    mode === "approvals" ? "Aprovações" : mode === "signatures" ? "Assinaturas" : "Relatório de Fluxos";
  const subtitle =
    mode === "approvals"
      ? "Acompanhamento de aprovações de documentos"
      : mode === "signatures"
      ? "Acompanhamento de assinaturas de documentos"
      : "Visão consolidada de aprovações e assinaturas";
  const HeaderIcon = mode === "approvals" ? CheckCircle2 : mode === "signatures" ? PenLine : Workflow;

  const kpiCards = [
    ...(showApprovals
      ? [
          { label: "Aprov. Pendentes", v: kpis.apprPend, c: "bg-amber-500" },
          { label: "Aprovadas", v: kpis.apprOk, c: "bg-emerald-600" },
          { label: "Reprovadas", v: kpis.apprRej, c: "bg-red-600" },
        ]
      : []),
    ...(showSignatures
      ? [
          { label: "Assin. Pendentes", v: kpis.signPend, c: "bg-amber-500" },
          { label: "Assinadas", v: kpis.signOk, c: "bg-emerald-600" },
          { label: "Recusadas", v: kpis.signRej, c: "bg-red-600" },
        ]
      : []),
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeaderIcon className="h-6 w-6" /> {title}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 border rounded-md px-2 py-1">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">{format(startDate, "dd/MM/yyyy")}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">{format(endDate, "dd/MM/yyyy")}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <Input
            placeholder="Buscar por documento ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {kpiCards.map((k) => (
          <div key={k.label} className={`${k.c} text-white p-3 rounded-md`}>
            <p className="text-[10px] uppercase font-bold opacity-90">{k.label}</p>
            <p className="text-2xl font-bold mt-1">{k.v}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue={showApprovals ? "approvals" : "signatures"}>
        {mode === "all" && (
          <TabsList>
            <TabsTrigger value="approvals">Aprovações</TabsTrigger>
            <TabsTrigger value="signatures">Assinaturas</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="approvals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Aprovações ({filteredApprovals.length})</CardTitle>
              <div className="flex gap-2">
                <Select value={apprStatus} onValueChange={setApprStatus}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {APPR_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={exportApprovals}>
                  <Download className="h-4 w-4 mr-1" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {approvalsQ.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aprovador</TableHead>
                      <TableHead>Decidido em</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApprovals.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.documento?.nome}</TableCell>
                        <TableCell>#{a.ordem} {a.nome_etapa}</TableCell>
                        <TableCell>{a.perfil?.perfil_nome || "-"}</TableCell>
                        <TableCell>{statusBadge(a.status)}</TableCell>
                        <TableCell>{a.aprovador?.full_name || "-"}</TableCell>
                        <TableCell>{a.decidido_em ? formatBrasiliaDate(a.decidido_em) : "-"}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => navigate(`/dashboard/documents?docId=${a.documento_id}`)}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredApprovals.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum resultado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signatures">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Assinaturas ({filteredSignatures.length})</CardTitle>
              <div className="flex gap-2">
                <Select value={signStatus} onValueChange={setSignStatus}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIGN_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={exportSignatures}>
                  <Download className="h-4 w-4 mr-1" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {signaturesQ.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assinante</TableHead>
                      <TableHead>Assinado em</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSignatures.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.documento?.nome}</TableCell>
                        <TableCell>#{s.ordem}</TableCell>
                        <TableCell>{s.tipo_assinatura}</TableCell>
                        <TableCell>{s.perfil?.perfil_nome || "-"}</TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell>{s.assinante?.full_name || "-"}</TableCell>
                        <TableCell>{s.assinado_em ? formatBrasiliaDate(s.assinado_em) : "-"}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => navigate(`/dashboard/documents?docId=${s.documento_id}`)}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSignatures.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum resultado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

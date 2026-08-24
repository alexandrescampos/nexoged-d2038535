import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, FileText, HardDrive, Users, Layers, Search } from "lucide-react";

interface OrgStatRow {
  organization_id: string;
  organization_name: string;
  status: string;
  plan: string | null;
  created_at: string;
  contracted_pages: number | null;
  contracted_storage_gb: number | null;
  used_pages: number;
  used_storage_bytes: number;
  used_storage_gb: number;
  total_documents: number;
  documents_last_30d: number;
  total_users: number;
  active_users: number;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function percent(used: number, total?: number | null): number {
  if (!total || total <= 0) return 0;
  return Math.min((used / total) * 100, 100);
}

export default function OrgStatisticsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["super-admin-org-stats"],
    queryFn: async (): Promise<OrgStatRow[]> => {
      const { data, error } = await supabase.rpc("super_admin_org_stats");
      if (error) throw error;
      return (data ?? []) as unknown as OrgStatRow[];
    },
    refetchInterval: 60000,
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    const term = search
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!term) return list;
    return list.filter((r) =>
      r.organization_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(term),
    );
  }, [data, search]);

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      orgs: list.length,
      documents: list.reduce((a, r) => a + Number(r.total_documents || 0), 0),
      pages: list.reduce((a, r) => a + Number(r.used_pages || 0), 0),
      bytes: list.reduce((a, r) => a + Number(r.used_storage_bytes || 0), 0),
      users: list.reduce((a, r) => a + Number(r.total_users || 0), 0),
    };
  }, [data]);

  const summaryCards = [
    { title: "Organizações", value: totals.orgs.toLocaleString("pt-BR"), icon: Building2 },
    { title: "Documentos", value: totals.documents.toLocaleString("pt-BR"), icon: FileText },
    { title: "Páginas", value: totals.pages.toLocaleString("pt-BR"), icon: Layers },
    { title: "Espaço Ocupado", value: formatBytes(totals.bytes), icon: HardDrive },
    { title: "Usuários", value: totals.users.toLocaleString("pt-BR"), icon: Users },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Estatísticas das Organizações</h1>
        <p className="text-muted-foreground">
          Documentos carregados, espaço ocupado e usuários por organização
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-lg">Detalhamento por organização</CardTitle>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar organização..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-destructive">
              Não foi possível carregar as estatísticas.
            </p>
          )}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Documentos</TableHead>
                    <TableHead className="text-right">Últimos 30d</TableHead>
                    <TableHead className="min-w-[160px]">Páginas</TableHead>
                    <TableHead className="min-w-[160px]">Espaço</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma organização encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.organization_id}>
                      <TableCell>
                        <p className="font-medium">{r.organization_name}</p>
                        <p className="text-xs text-muted-foreground">{r.plan || "Sem plano"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "active" ? "default" : "secondary"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(r.total_documents).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.documents_last_30d).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs mb-1">
                          {Number(r.used_pages).toLocaleString("pt-BR")}
                          {r.contracted_pages
                            ? ` / ${Number(r.contracted_pages).toLocaleString("pt-BR")}`
                            : ""}
                        </p>
                        <Progress value={percent(Number(r.used_pages), r.contracted_pages)} />
                      </TableCell>
                      <TableCell>
                        <p className="text-xs mb-1">
                          {formatBytes(Number(r.used_storage_bytes))}
                          {r.contracted_storage_gb ? ` / ${r.contracted_storage_gb} GB` : ""}
                        </p>
                        <Progress
                          value={percent(Number(r.used_storage_gb), r.contracted_storage_gb)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{Number(r.active_users)}</span>
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          / {Number(r.total_users)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

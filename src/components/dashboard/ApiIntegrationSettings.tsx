import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, KeyRound, Loader2, RefreshCw, ShieldOff, Activity } from "lucide-react";
import { toast } from "sonner";

interface ApiIntegrationSettingsProps {
  organizationId: string;
  organizationName?: string;
}

interface ApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface ApiKeyListResponse {
  keys: ApiKeyRecord[];
}

interface GenerateKeyResponse {
  apiKey: string;
  keyPrefix: string;
}

const formatDateTime = (value: string | null) => {
  if (!value) return "Nunca usado";

  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export default function ApiIntegrationSettings({ organizationId, organizationName }: ApiIntegrationSettingsProps) {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [logEndpointFilter, setLogEndpointFilter] = useState<string>("all");
  const [logDaysFilter, setLogDaysFilter] = useState<string>("30");

  const apiEndpoints = useMemo(
    () => {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/organization-api`;

      return [
        {
          id: "epi-movements",
          title: "Movimentações do dia",
          method: "GET",
          url: `${baseUrl}/epi-movements`,
          description: "Retorna entregas e trocas registradas na data informada, incluindo o CNPJ de cada movimentação.",
          details: [
            { label: "Header", value: "X-API-Key: sua-chave" },
            { label: "Parâmetros", value: "date=dd/mm/yyyy (obrigatório), cnpj=12345678000199 (opcional, filtra por CNPJ)" },
            { label: "Resposta", value: "type, delivery_date, epi_code, quantity, stock_source, cnpj, cnpj_company_name" },
          ],
        },
        {
          id: "stock-update",
          title: "Atualização de estoque novo",
          method: "POST",
          url: `${baseUrl}/stock-update`,
          description: "Substitui o saldo do estoque novo de um EPI pelo código informado. O campo cnpj é obrigatório para organizações com múltiplos CNPJs.",
          details: [
            { label: "Header", value: "X-API-Key: sua-chave" },
            { label: "Body", value: '{ "epi_code": "EPI-001", "stock_quantity": 25, "cnpj": "12345678000199" }' },
            { label: "Efeito", value: "Atualiza o estoque novo do EPI no CNPJ informado" },
          ],
        },
        {
          id: "employee-upsert",
          title: "Cadastro de funcionários (upsert)",
          method: "POST",
          url: `${baseUrl}/employee-upsert`,
          description: "Cria um funcionário novo ou atualiza um existente usando o CPF como chave. Setor e função são resolvidos pelo nome (case/acento insensitive). CNPJ é obrigatório.",
          details: [
            { label: "Header", value: "X-API-Key: sua-chave" },
            {
              label: "Body",
              value:
                '{ "cpf": "12345678901", "name": "Fulano da Silva", "cnpj": "12345678000199", "registration_number": "0001", "admission_date": "01/03/2024", "sector_name": "Produção", "job_function_name": "Operador", "shirt_size": "M", "pants_size": "42", "shoe_size": "41" }',
            },
            { label: "Resposta", value: 'success, action ("created" | "updated"), employee_id, cpf, cnpj' },
          ],
        },
      ];
    },
    [],
  );

  const invalidateKeys = () => {
    queryClient.invalidateQueries({ queryKey: ["organization-api-keys", organizationId] });
  };

  const callManagementAction = async <T,>(action: string) => {
    const { data, error } = await supabase.functions.invoke("organization-api", {
      body: {
        action,
        organizationId,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data as T;
  };

  const { data, isLoading } = useQuery({
    queryKey: ["organization-api-keys", organizationId],
    queryFn: () => callManagementAction<ApiKeyListResponse>("list-keys"),
    enabled: !!organizationId,
  });

  const activeKey = data?.keys?.find((key) => key.is_active) ?? null;

  const generateMutation = useMutation({
    mutationFn: () => callManagementAction<GenerateKeyResponse>("generate-key"),
    onSuccess: (response) => {
      setRevealedKey(response.apiKey);
      invalidateKeys();
      toast.success(activeKey ? "Chave regenerada com sucesso" : "Chave gerada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível gerar a chave");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => callManagementAction<{ success: boolean }>("revoke-key"),
    onSuccess: () => {
      invalidateKeys();
      toast.success("Chave revogada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível revogar a chave");
    },
  });

  const sinceIso = useMemo(() => {
    const days = parseInt(logDaysFilter, 10) || 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [logDaysFilter]);

  const { data: usageLogs, isLoading: logsLoading, refetch: refetchLogs, isFetching: logsFetching } = useQuery({
    queryKey: ["api-usage-log", organizationId, logDaysFilter, logEndpointFilter],
    enabled: isSuperAdmin && !!organizationId,
    queryFn: async () => {
      let q = supabase
        .from("organization_api_usage_log")
        .select("id, endpoint, method, status_code, success, error_message, ip_address, user_agent, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500);

      if (logEndpointFilter !== "all") {
        q = q.eq("endpoint", logEndpointFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleCopy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Não foi possível copiar para a área de transferência");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Integrações / API
          </CardTitle>
          <CardDescription>
            Gere a X-API-Key da organização{organizationName ? ` ${organizationName}` : ""} e use as rotas de movimentações e atualização de estoque.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {apiEndpoints.map((endpoint) => (
              <div key={endpoint.id} className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{endpoint.title}</p>
                      <Badge variant="outline">{endpoint.method}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Endpoint</p>
                    <Input value={endpoint.url} readOnly />
                  </div>
                  <Button variant="outline" onClick={() => handleCopy(endpoint.url, "Endpoint copiado")}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar endpoint
                  </Button>
                </div>

                <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm md:grid-cols-3">
                  {endpoint.details.map((detail) => (
                    <div key={detail.label}>
                      <p className="font-medium text-foreground">{detail.label}</p>
                      <p className="break-words text-muted-foreground">{detail.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando chave...
            </div>
          ) : activeKey ? (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">Chave ativa</p>
                    <Badge variant="outline">Ativa</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Prefixo: {activeKey.key_prefix}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending || revokeMutation.isPending}
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Regenerar chave
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => revokeMutation.mutate()}
                    disabled={generateMutation.isPending || revokeMutation.isPending}
                  >
                    {revokeMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldOff className="mr-2 h-4 w-4" />
                    )}
                    Revogar
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Criada em</p>
                  <p className="font-medium text-foreground">{formatDateTime(activeKey.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Último uso</p>
                  <p className="font-medium text-foreground">{formatDateTime(activeKey.last_used_at)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
              <div>
                <p className="font-medium text-foreground">Nenhuma chave ativa</p>
                <p className="text-sm text-muted-foreground">
                  Gere uma X-API-Key para liberar a integração externa desta organização.
                </p>
              </div>
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Gerar chave
              </Button>
            </div>
          )}
          {isSuperAdmin && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <Activity className="h-4 w-4" />
                      Histórico de uso (últimos {logDaysFilter} dias)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Visível apenas para Super Admins. Registros expiram após 30 dias.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={logDaysFilter} onValueChange={setLogDaysFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Últimas 24h</SelectItem>
                        <SelectItem value="7">Últimos 7 dias</SelectItem>
                        <SelectItem value="30">Últimos 30 dias</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={logEndpointFilter} onValueChange={setLogEndpointFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os endpoints</SelectItem>
                        <SelectItem value="doc-movements">doc-movements</SelectItem>
                        <SelectItem value="stock-update">stock-update</SelectItem>
                        <SelectItem value="employee-upsert">employee-upsert</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchLogs()}
                      disabled={logsFetching}
                    >
                      {logsFetching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border">
                  {logsLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Carregando registros...
                    </div>
                  ) : !usageLogs || usageLogs.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma requisição registrada no período.
                    </div>
                  ) : (
                    <TooltipProvider>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Endpoint</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>IP</TableHead>
                            <TableHead>User-Agent</TableHead>
                            <TableHead>Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usageLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap text-sm">
                                {formatDateTime(log.created_at)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.endpoint}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{log.method}</TableCell>
                              <TableCell>
                                <Badge variant={log.success ? "default" : "destructive"}>
                                  {log.status_code}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm font-mono">
                                {log.ip_address ?? "—"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm">
                                {log.user_agent ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{log.user_agent}</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-md break-all">
                                      {log.user_agent}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm text-destructive">
                                {log.error_message ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Exibindo até 500 registros mais recentes.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!revealedKey} onOpenChange={(open) => !open && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave gerada</DialogTitle>
            <DialogDescription>
              Copie e guarde esta chave agora. Por segurança, ela não poderá ser exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input value={revealedKey ?? ""} readOnly />
            <p className="text-xs text-muted-foreground">
              Exemplo de uso: <span className="font-mono">X-API-Key: {revealedKey ? `${revealedKey.slice(0, 10)}...` : "sua-chave"}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevealedKey(null)}>
              Fechar
            </Button>
            <Button onClick={() => revealedKey && handleCopy(revealedKey, "Chave copiada")}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
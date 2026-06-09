import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ArrowUp, ArrowDown, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Cnpj {
  id: string;
  cnpj: string;
  company_name: string;
  is_active: boolean;
}

interface StockSource {
  id: string;
  consumer_cnpj_id: string;
  source_cnpj_id: string;
  priority: number;
}

export default function CnpjStockSharing() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [consumerId, setConsumerId] = useState<string>("");
  const [newSourceId, setNewSourceId] = useState<string>("");
  const [newPriority, setNewPriority] = useState<number>(0);

  const { data: cnpjs } = useQuery({
    queryKey: ["org-cnpjs", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_cnpjs")
        .select("id, cnpj, company_name, is_active")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data as Cnpj[];
    },
    enabled: !!organization?.id,
  });

  const { data: sources, isLoading } = useQuery({
    queryKey: ["cnpj-stock-sources", consumerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cnpj_stock_sources" as any)
        .select("id, consumer_cnpj_id, source_cnpj_id, priority")
        .eq("consumer_cnpj_id", consumerId)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as unknown as StockSource[];
    },
    enabled: !!consumerId,
  });

  const cnpjLabel = (id: string) => {
    const c = cnpjs?.find((x) => x.id === id);
    return c ? `${c.company_name} (${c.cnpj})` : id;
  };

  const usedSourceIds = new Set((sources || []).map((s) => s.source_cnpj_id));
  const availableSources = (cnpjs || []).filter(
    (c) => c.id !== consumerId && !usedSourceIds.has(c.id)
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newSourceId || !consumerId) throw new Error("Selecione um CNPJ fornecedor.");
      const { error } = await supabase.from("cnpj_stock_sources" as any).insert({
        organization_id: organization!.id,
        consumer_cnpj_id: consumerId,
        source_cnpj_id: newSourceId,
        priority: newPriority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fonte de estoque adicionada.");
      setNewSourceId("");
      setNewPriority((sources?.length || 0) + 1);
      queryClient.invalidateQueries({ queryKey: ["cnpj-stock-sources", consumerId] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao adicionar fonte."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cnpj_stock_sources" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fonte removida.");
      queryClient.invalidateQueries({ queryKey: ["cnpj-stock-sources", consumerId] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover."),
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: number }) => {
      const { error } = await supabase
        .from("cnpj_stock_sources" as any)
        .update({ priority })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cnpj-stock-sources", consumerId] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao reordenar."),
  });

  const move = (index: number, delta: number) => {
    if (!sources) return;
    const target = index + delta;
    if (target < 0 || target >= sources.length) return;
    const a = sources[index];
    const b = sources[target];
    updatePriorityMutation.mutate({ id: a.id, priority: b.priority });
    updatePriorityMutation.mutate({ id: b.id, priority: a.priority });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Share2 className="h-6 w-6" />
          Compartilhamento de Estoque entre CNPJs
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure de quais outros CNPJs cada CNPJ pode puxar estoque de EPI quando o saldo
          próprio for insuficiente. A ordem de prioridade define qual CNPJ é consultado primeiro.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CNPJ Consumidor</CardTitle>
          <CardDescription>Selecione o CNPJ que poderá puxar estoque de outros.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xl">
            <Label className="mb-2 block">CNPJ</Label>
            <Select value={consumerId} onValueChange={setConsumerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um CNPJ..." />
              </SelectTrigger>
              <SelectContent>
                {cnpjs?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name} ({c.cnpj})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {consumerId && (
        <Card>
          <CardHeader>
            <CardTitle>Fontes de Estoque Configuradas</CardTitle>
            <CardDescription>
              Quando este CNPJ não tiver saldo suficiente, o sistema buscará estoque destes CNPJs na
              ordem de prioridade (do topo para baixo).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 p-4 border rounded-md bg-muted/30">
              <div className="flex-1 min-w-[240px]">
                <Label className="mb-2 block">Adicionar CNPJ fornecedor</Label>
                <Select value={newSourceId} onValueChange={setNewSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSources.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name} ({c.cnpj})
                      </SelectItem>
                    ))}
                    {availableSources.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Sem CNPJs disponíveis.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[140px]">
                <Label className="mb-2 block">Prioridade</Label>
                <Input
                  type="number"
                  min={0}
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value) || 0)}
                />
              </div>
              <Button
                onClick={() => addMutation.mutate()}
                disabled={!newSourceId || addMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Ordem</TableHead>
                  <TableHead>CNPJ Fornecedor</TableHead>
                  <TableHead className="w-[120px]">Prioridade</TableHead>
                  <TableHead className="w-[160px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && (sources?.length || 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhuma fonte configurada. Este CNPJ usará apenas seu próprio estoque.
                    </TableCell>
                  </TableRow>
                )}
                {sources?.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell>{idx + 1}º</TableCell>
                    <TableCell>{cnpjLabel(s.source_cnpj_id)}</TableCell>
                    <TableCell>{s.priority}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          title="Subir prioridade"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => move(idx, 1)}
                          disabled={idx === (sources?.length || 0) - 1}
                          title="Descer prioridade"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(s.id)}
                          className="text-destructive hover:text-destructive"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

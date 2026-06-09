import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Merge, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EpiRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  stock_quantity: number;
}

interface Group {
  key: string;
  variants: Array<EpiRow & { deliveries: number; associations: number }>;
}

const normalize = (s: string) => s.toLowerCase().trim();

export default function DuplicateEpis() {
  const { organization } = useAuth();
  const qc = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [canonicalId, setCanonicalId] = useState<string>("");
  const [merging, setMerging] = useState(false);

  const { data: epis = [], isLoading } = useQuery({
    queryKey: ["all-epis-dup", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epis")
        .select("id, code, name, is_active, stock_quantity")
        .eq("organization_id", organization!.id)
        .order("code");
      if (error) throw error;
      return (data || []) as EpiRow[];
    },
    enabled: !!organization?.id,
  });

  const { data: deliveryCounts = {} } = useQuery({
    queryKey: ["delivery-counts-by-epi", organization?.id],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("epi_deliveries")
          .select("epi_id")
          .eq("organization_id", organization!.id)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        for (const r of rows) {
          const id = (r as any).epi_id;
          if (id) counts[id] = (counts[id] || 0) + 1;
        }
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return counts;
    },
    enabled: !!organization?.id,
  });

  const { data: assocCounts = {} } = useQuery({
    queryKey: ["assoc-counts-by-epi", organization?.id],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("sector_function_epis")
          .select("epi_id")
          .eq("organization_id", organization!.id)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        for (const r of rows) {
          const id = (r as any).epi_id;
          if (id) counts[id] = (counts[id] || 0) + 1;
        }
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return counts;
    },
    enabled: !!organization?.id,
  });

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const e of epis) {
      const key = normalize(e.code || "");
      if (!key) continue;
      const variant = {
        ...e,
        deliveries: deliveryCounts[e.id] || 0,
        associations: assocCounts[e.id] || 0,
      };
      if (!map.has(key)) map.set(key, { key, variants: [variant] });
      else map.get(key)!.variants.push(variant);
    }
    return Array.from(map.values()).filter((g) => g.variants.length > 1);
  }, [epis, deliveryCounts, assocCounts]);

  const openMergeDialog = (g: Group) => {
    setSelectedGroup(g);
    const best = [...g.variants].sort(
      (a, b) => (b.deliveries + b.associations + b.stock_quantity)
              - (a.deliveries + a.associations + a.stock_quantity),
    )[0];
    setCanonicalId(best.id);
  };

  const handleMerge = async () => {
    if (!selectedGroup || !canonicalId) return;
    const duplicates = selectedGroup.variants.filter((v) => v.id !== canonicalId).map((v) => v.id);
    setMerging(true);
    try {
      const { data, error } = await supabase.rpc("merge_epis", {
        _canonical_id: canonicalId,
        _duplicate_ids: duplicates,
      });
      if (error) throw error;
      const r = data as any;
      toast.success(
        `Mesclados: ${r.moved_deliveries || 0} entrega(s), ${r.moved_associations || 0} associação(ões), ${r.moved_request_items || 0} item(ns) de solicitação.`,
      );
      setSelectedGroup(null);
      qc.invalidateQueries({ queryKey: ["all-epis-dup"] });
      qc.invalidateQueries({ queryKey: ["delivery-counts-by-epi"] });
      qc.invalidateQueries({ queryKey: ["assoc-counts-by-epi"] });
      qc.invalidateQueries({ queryKey: ["epis"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao mesclar EPIs.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">EPIs Duplicados</h1>
        <p className="text-muted-foreground">
          Encontre EPIs com o mesmo código e consolide estoque, entregas e associações em um único cadastro.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {groups.length} grupo(s) de duplicatas
          </CardTitle>
          <CardDescription>
            EPIs agrupados pelo mesmo código. Mesclar consolida estoque, entregas e associações no EPI canônico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="mx-auto h-12 w-12 mb-4 text-primary opacity-70" />
              <p className="font-medium">Nenhuma duplicata encontrada.</p>
              <p className="text-sm">Todos os EPIs têm códigos únicos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <Card key={g.key} className="border-amber-200">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div>
                      <CardDescription>Código: {g.variants[0].code}</CardDescription>
                      <CardTitle className="text-base mt-1">
                        {g.variants[0].name}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({g.variants.length} variantes)
                        </span>
                      </CardTitle>
                    </div>
                    <Button size="sm" onClick={() => openMergeDialog(g)}>
                      <Merge className="mr-1 h-4 w-4" /> Mesclar
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {g.variants.map((v) => (
                        <div key={v.id} className="flex items-center justify-between text-sm border rounded p-2">
                          <div className="flex-1">
                            <div className="font-medium">{v.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{v.id}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={v.is_active ? "default" : "secondary"}>
                              {v.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                            <Badge variant="outline">Estoque: {v.stock_quantity}</Badge>
                            <Badge variant="outline">{v.deliveries} entregas</Badge>
                            <Badge variant="outline">{v.associations} assoc.</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedGroup} onOpenChange={(o) => !o && !merging && setSelectedGroup(null)}>
        <DialogContent className="max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mesclar EPIs Duplicados</DialogTitle>
            <DialogDescription>
              Escolha qual versão será mantida. As demais terão estoque, entregas e associações movidos para
              a canônica e serão desativadas.
            </DialogDescription>
          </DialogHeader>
          {selectedGroup && (
            <RadioGroup value={canonicalId} onValueChange={setCanonicalId}>
              {selectedGroup.variants.map((v) => (
                <div key={v.id} className="flex items-start gap-3 border rounded p-3">
                  <RadioGroupItem value={v.id} id={v.id} className="mt-1" />
                  <Label htmlFor={v.id} className="flex-1 cursor-pointer space-y-1">
                    <div className="font-medium">{v.name}</div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={v.is_active ? "default" : "secondary"}>
                        {v.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline">Estoque: {v.stock_quantity}</Badge>
                      <Badge variant="outline">{v.deliveries} entregas</Badge>
                      <Badge variant="outline">{v.associations} associações</Badge>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedGroup(null)} disabled={merging}>
              Cancelar
            </Button>
            <Button onClick={handleMerge} disabled={merging || !canonicalId}>
              {merging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar mesclagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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

interface JobFunctionRow {
  id: string;
  name: string;
  is_active: boolean;
  sector_id: string | null;
  sectors?: { name: string } | null;
}

interface Group {
  key: string;
  sectorName: string;
  variants: Array<JobFunctionRow & { associations: number; employees: number }>;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export default function DuplicateJobFunctions() {
  const { organization } = useAuth();
  const qc = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [canonicalId, setCanonicalId] = useState<string>("");
  const [merging, setMerging] = useState(false);

  const { data: jobFunctions = [], isLoading } = useQuery({
    queryKey: ["all-job-functions", organization?.id],
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

  const { data: assocCounts = {} } = useQuery({
    queryKey: ["sfe-counts-by-fn", organization?.id],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("sector_function_epis")
          .select("job_function_id")
          .eq("organization_id", organization!.id)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        for (const r of rows) {
          const id = (r as any).job_function_id;
          if (id) counts[id] = (counts[id] || 0) + 1;
        }
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return counts;
    },
    enabled: !!organization?.id,
  });

  const { data: empCounts = {} } = useQuery({
    queryKey: ["emp-counts-by-fn-all", organization?.id],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("employees")
          .select("job_function_id")
          .eq("organization_id", organization!.id)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        for (const e of rows) {
          const id = (e as any).job_function_id;
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
    for (const f of jobFunctions) {
      const sectorName = f.sectors?.name || "(Sem setor)";
      const key = `${f.sector_id || "null"}|${normalize(f.name)}`;
      const variant = {
        ...f,
        associations: assocCounts[f.id] || 0,
        employees: empCounts[f.id] || 0,
      };
      if (!map.has(key)) {
        map.set(key, { key, sectorName, variants: [variant] });
      } else {
        map.get(key)!.variants.push(variant);
      }
    }
    return Array.from(map.values())
      .filter((g) => g.variants.length > 1)
      .sort((a, b) => b.variants.reduce((s, v) => s + v.associations + v.employees, 0)
                    - a.variants.reduce((s, v) => s + v.associations + v.employees, 0));
  }, [jobFunctions, assocCounts, empCounts]);

  const openMergeDialog = (g: Group) => {
    setSelectedGroup(g);
    // sugerir como canônica a variante com mais associações + funcionários
    const best = [...g.variants].sort(
      (a, b) => (b.associations + b.employees) - (a.associations + a.employees),
    )[0];
    setCanonicalId(best.id);
  };

  const handleMerge = async () => {
    if (!selectedGroup || !canonicalId) return;
    const duplicates = selectedGroup.variants.filter((v) => v.id !== canonicalId).map((v) => v.id);
    setMerging(true);
    try {
      const { data, error } = await supabase.rpc("merge_job_functions", {
        _canonical_id: canonicalId,
        _duplicate_ids: duplicates,
      });
      if (error) throw error;
      const r = data as any;
      toast.success(
        `Mescladas: ${r.moved_employees || 0} funcionário(s), ${r.moved_associations || 0} associação(ões) movida(s), ${r.deleted_associations || 0} duplicada(s) removida(s).`,
      );
      setSelectedGroup(null);
      qc.invalidateQueries({ queryKey: ["all-job-functions"] });
      qc.invalidateQueries({ queryKey: ["sfe-counts-by-fn"] });
      qc.invalidateQueries({ queryKey: ["emp-counts-by-fn-all"] });
      qc.invalidateQueries({ queryKey: ["job-functions-report"] });
      qc.invalidateQueries({ queryKey: ["sector-function-epis-ids"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao mesclar funções.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Funções Duplicadas</h1>
        <p className="text-muted-foreground">
          Encontre funções com nomes equivalentes (apenas variações de maiúsculas/acentos) e mescle-as
          para consolidar associações de EPI e funcionários em uma única função.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {groups.length} grupo(s) de duplicatas
          </CardTitle>
          <CardDescription>
            Cada grupo mostra variantes do mesmo nome dentro do mesmo setor. Mesclar move tudo para a
            função escolhida e desativa as demais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="mx-auto h-12 w-12 mb-4 text-primary opacity-70" />
              <p className="font-medium">Nenhuma duplicata encontrada.</p>
              <p className="text-sm">Todas as funções têm nomes únicos por setor.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <Card key={g.key} className="border-amber-200">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div>
                      <CardDescription>Setor: {g.sectorName}</CardDescription>
                      <CardTitle className="text-base mt-1">
                        {g.variants[0].name}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          (e {g.variants.length - 1} variante{g.variants.length > 2 ? "s" : ""})
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
                        <div
                          key={v.id}
                          className="flex items-center justify-between text-sm border rounded p-2"
                        >
                          <div className="flex-1 font-mono text-xs">{v.name}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant={v.is_active ? "default" : "secondary"}>
                              {v.is_active ? "Ativa" : "Inativa"}
                            </Badge>
                            <Badge variant="outline">{v.associations} EPIs</Badge>
                            <Badge variant="outline">{v.employees} func.</Badge>
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
            <DialogTitle>Mesclar Funções Duplicadas</DialogTitle>
            <DialogDescription>
              Escolha qual versão será mantida (canônica). As demais terão suas associações de EPI e
              funcionários movidos para a canônica e serão desativadas.
            </DialogDescription>
          </DialogHeader>
          {selectedGroup && (
            <div className="space-y-3">
              <RadioGroup value={canonicalId} onValueChange={setCanonicalId}>
                {selectedGroup.variants.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 border rounded p-3">
                    <RadioGroupItem value={v.id} id={v.id} className="mt-1" />
                    <Label htmlFor={v.id} className="flex-1 cursor-pointer space-y-1">
                      <div className="font-mono text-sm">{v.name}</div>
                      <div className="flex gap-2">
                        <Badge variant={v.is_active ? "default" : "secondary"}>
                          {v.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                        <Badge variant="outline">{v.associations} EPIs</Badge>
                        <Badge variant="outline">{v.employees} funcionários</Badge>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
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

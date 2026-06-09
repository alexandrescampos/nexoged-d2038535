import { useEffect, useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ClipboardList, X } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import SectorFunctionEpiImport from "@/components/dashboard/SectorFunctionEpiImport";
import { exportSectorFunctionEpiMatrix } from "@/lib/sectorFunctionEpiMatrix";

interface FormItem {
  epiId: string;
  quantity: number;
  validityMonths: number;
}

export default function SectorFunctionEpis() {
  const { organization, isOrgAdmin } = useAuth();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [selectedFunction, setSelectedFunction] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = usePersistedState("sf-epis:dialogOpen", false);
  const [editingId, setEditingId] = usePersistedState<string | null>("sf-epis:editingId", null);
  const [editValidity, setEditValidity] = usePersistedState<number>("sf-epis:editValidity", 12);
  const [editQuantity, setEditQuantity] = usePersistedState<number>("sf-epis:editQuantity", 1);

  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  // Form state
  const [formSector, setFormSector] = useState("");
  const [formFunction, setFormFunction] = useState("");
  const [formItems, setFormItems] = useState<FormItem[]>([
    { epiId: "", quantity: 1, validityMonths: 12 },
  ]);

  // Queries
  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("organization_id", orgId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: jobFunctions = [] } = useQuery({
    queryKey: ["job_functions", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_functions")
        .select("id, name, sector_id, code")
        .eq("organization_id", orgId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: epis = [] } = useQuery({
    queryKey: ["epis", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epis")
        .select("id, name, code, ca_number")
        .eq("organization_id", orgId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: associations = [], isLoading } = useQuery({
    queryKey: ["sector_function_epis", orgId],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let from = 0;
      let allData: any[] = [];
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("sector_function_epis")
          .select("*, sectors(name), job_functions(name, code), epis(code, name, ca_number)")
          .eq("organization_id", orgId!)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return allData;
    },
    enabled: !!orgId,
  });

  const filteredFunctions = useMemo(() => {
    if (selectedSector === "all") return jobFunctions;
    return jobFunctions.filter((f) => f.sector_id === selectedSector);
  }, [selectedSector, jobFunctions]);

  const formFilteredFunctions = useMemo(() => {
    if (!formSector) return jobFunctions;
    return jobFunctions.filter((f) => f.sector_id === formSector);
  }, [formSector, jobFunctions]);

  const filteredAssociations = useMemo(() => {
    const normalizedSearchTerm = normalize(searchTerm);

    return associations.filter((a) => {
      if (selectedSector !== "all" && a.sector_id !== selectedSector) return false;
      if (selectedFunction !== "all" && a.job_function_id !== selectedFunction) return false;

      if (!normalizedSearchTerm) return true;

      const sectorName = normalize((a.sectors as any)?.name ?? "");
      const functionName = normalize((a.job_functions as any)?.name ?? "");
      const functionCode = normalize((a.job_functions as any)?.code ?? "");
      const epiName = normalize((a.epis as any)?.name ?? "");
      const epiCode = normalize((a.epis as any)?.code ?? "");

      return [sectorName, functionName, functionCode, epiName, epiCode].some((value) => value.includes(normalizedSearchTerm));

      return true;
    });
  }, [associations, searchTerm, selectedSector, selectedFunction]);

  const { sortedItems: sortedAssociations, sortField, sortDirection, handleSort } = useTableSort(filteredAssociations);
  const assocPag = usePagination(sortedAssociations);

  useEffect(() => {
    assocPag.resetPage();
  }, [searchTerm, selectedSector, selectedFunction]);

  // Get already selected EPI ids to prevent duplicates in form
  const selectedEpiIds = useMemo(() => {
    return new Set(formItems.map((item) => item.epiId).filter(Boolean));
  }, [formItems]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const rows = formItems
        .filter((item) => item.epiId)
        .map((item) => ({
          organization_id: orgId!,
          sector_id: formSector,
          job_function_id: formFunction,
          epi_id: item.epiId,
          quantity: item.quantity,
          validity_months: item.validityMonths,
        }));
      const { error } = await supabase.from("sector_function_epis").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sector_function_epis"] });
      toast.success("Associações criadas com sucesso");
      resetForm();
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.error("Uma ou mais associações já existem");
      } else {
        toast.error("Erro ao criar associações");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, validity_months, quantity }: { id: string; validity_months: number; quantity: number }) => {
      const { error } = await supabase
        .from("sector_function_epis")
        .update({ validity_months, quantity })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sector_function_epis"] });
      toast.success("Registro atualizado");
      setEditingId(null);
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sector_function_epis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sector_function_epis"] });
      toast.success("Associação removida");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  function resetForm() {
    setDialogOpen(false);
    setFormSector("");
    setFormFunction("");
    setFormItems([{ epiId: "", quantity: 1, validityMonths: 12 }]);
  }

  const handleSectorFilterChange = (value: string) => {
    setSelectedSector(value);
    setSelectedFunction("all");
  };

  const addFormItem = () => {
    setFormItems([...formItems, { epiId: "", quantity: 1, validityMonths: 12 }]);
  };

  const removeFormItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const updateFormItem = (index: number, field: keyof FormItem, value: string | number) => {
    setFormItems(formItems.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const canSave = formSector && formFunction && formItems.some((item) => item.epiId && item.quantity >= 1 && item.validityMonths >= 1);

  const handleExportMatrix = () => {
    if (!sectors.length || !jobFunctions.length || !epis.length) {
      toast.error("É preciso ter setores, funções e EPIs ativos para exportar a matriz");
      return;
    }

    const { exportedRows, skippedFunctions } = exportSectorFunctionEpiMatrix({
      sectors,
      jobFunctions,
      epis,
    });

    if (!exportedRows) {
      toast.error("Nenhuma combinação válida foi encontrada para exportação");
      return;
    }

    if (skippedFunctions > 0) {
      toast.warning(
        `${exportedRows} linha(s) exportadas. ${skippedFunctions} função(ões) sem setor ficaram fora da matriz.`,
      );
      return;
    }

    toast.success(`${exportedRows} linha(s) exportadas na Matriz EPI x Função`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">EPIs por Função</h1>
          <p className="text-muted-foreground">
            Associe EPIs obrigatórios a cada combinação de setor e função
          </p>
        </div>
        {isOrgAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <SectorFunctionEpiImport
              organizationId={orgId!}
              sectors={sectors}
              jobFunctions={jobFunctions}
              epis={epis}
              associations={associations}
              onImportComplete={() => {
                queryClient.invalidateQueries({ queryKey: ["sector_function_epis"] });
              }}
            />
            <Button variant="outline" onClick={handleExportMatrix}>
              Exportar Matriz EPI x Função
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Associação
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[280px] flex-1">
              <Label>Busca</Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por setor, função ou códigos..."
              />
            </div>
            <div className="min-w-[200px]">
              <Label>Setor</Label>
              <Select value={selectedSector} onValueChange={handleSectorFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <Label>Função</Label>
              <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as funções" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as funções</SelectItem>
                  {filteredFunctions.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.code} - {f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
            {(searchTerm || selectedSector !== "all" || selectedFunction !== "all") && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedSector("all");
                    setSelectedFunction("all");
                  }}
                  className="h-10 px-3"
                >
                  Limpar Filtros
                  <X className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead field="sectors.name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Setor</SortableTableHead>
                <SortableTableHead field="job_functions.code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Cód. Função</SortableTableHead>
                <SortableTableHead field="job_functions.name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Função</SortableTableHead>
                <SortableTableHead field="epis.name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>EPI</SortableTableHead>
                <SortableTableHead field="epis.ca_number" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>CA</SortableTableHead>
                <SortableTableHead field="quantity" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Qtd</SortableTableHead>
                <SortableTableHead field="validity_months" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Validade (meses)</SortableTableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredAssociations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    <div className="py-8 flex flex-col items-center gap-2">
                      <ClipboardList className="h-8 w-8" />
                      <p>
                        {searchTerm || selectedSector !== "all" || selectedFunction !== "all"
                          ? "Nenhuma associação encontrada para os filtros informados"
                          : "Nenhuma associação encontrada"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                assocPag.paginatedItems.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{(a.sectors as any)?.name}</TableCell>
                    <TableCell className="font-mono text-xs">{(a.job_functions as any)?.code}</TableCell>
                    <TableCell>{(a.job_functions as any)?.name}</TableCell>
                    <TableCell>{(a.epis as any)?.name}</TableCell>
                    <TableCell>{(a.epis as any)?.ca_number || "—"}</TableCell>
                    <TableCell>
                      {editingId === a.id ? (
                        <Input
                          type="number"
                          min={1}
                          className="w-20"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(Number(e.target.value))}
                        />
                      ) : (
                        <span>{a.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === a.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            className="w-20"
                            value={editValidity}
                            onChange={(e) => setEditValidity(Number(e.target.value))}
                          />
                          <Button
                            size="sm"
                            onClick={() => updateMutation.mutate({ id: a.id, validity_months: editValidity, quantity: editQuantity })}
                          >
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <span>{a.validity_months}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingId(a.id);
                            setEditValidity(a.validity_months);
                            setEditQuantity(a.quantity);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(a.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="p-4">
            <TablePagination currentPage={assocPag.currentPage} totalPages={assocPag.totalPages} totalItems={assocPag.totalItems} pageSize={assocPag.pageSize} onPageChange={assocPag.setCurrentPage} onPageSizeChange={assocPag.setPageSize} />
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Associação EPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Setor</Label>
                <Select value={formSector} onValueChange={(v) => { setFormSector(v); setFormFunction(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Função</Label>
                <Select value={formFunction} onValueChange={setFormFunction} disabled={!formSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    {formFilteredFunctions.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>{f.code} - {f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>EPIs</Label>
                <Button type="button" variant="outline" size="sm" onClick={addFormItem}>
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar EPI
                </Button>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {formItems.map((item, index) => (
                  <div key={index} className="flex items-end gap-2 rounded-md border border-border p-3">
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs">EPI</Label>
                      <Select value={item.epiId} onValueChange={(v) => updateFormItem(index, "epiId", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {epis
                            .filter((e) => !selectedEpiIds.has(e.id) || e.id === item.epiId)
                            .map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name} {e.ca_number ? `(CA: ${e.ca_number})` : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateFormItem(index, "quantity", Number(e.target.value))}
                      />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Validade (m)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.validityMonths}
                        onChange={(e) => updateFormItem(index, "validityMonths", Number(e.target.value))}
                      />
                    </div>
                    {formItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeFormItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canSave || createMutation.isPending}
            >
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

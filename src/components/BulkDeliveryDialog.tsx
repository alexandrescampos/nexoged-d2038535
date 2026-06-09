import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useManagerCnpjs } from "@/hooks/useManagerCnpjs";
import { debitCnpjStock } from "@/lib/stockOperations";
import { toast } from "sonner";
import { format, addMonths, isAfter } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { nowBrasilia, withBrasiliaOffset, toDatetimeLocalValue } from "@/lib/timezone";
import { formatCNPJ } from "@/lib/cnpj";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Users, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BulkDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface BulkEpiItem {
  epi_id: string;
  quantity: number;
  stock_source: "new" | "used";
  expiration_date?: string;
}

interface EmployeeOption {
  id: string;
  name: string;
  sector_id: string | null;
  job_function_id: string | null;
  organization_cnpj_id: string | null;
  termination_date: string | null;
  is_active: boolean;
}

interface SectorFunctionEpi {
  sector_id: string;
  job_function_id: string;
  epi_id: string;
  quantity: number;
  validity_months: number;
}

export default function BulkDeliveryDialog({ open, onOpenChange, onSuccess }: BulkDeliveryDialogProps) {
  const { organization, profile, isOrgAdmin } = useAuth();
  const { managerCnpjIds, managerSectorIds } = useManagerCnpjs();
  const queryClient = useQueryClient();

  const [deliveryDate, setDeliveryDate] = useState(toDatetimeLocalValue(nowBrasilia()));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [epiItems, setEpiItems] = useState<BulkEpiItem[]>([]);
  const [addEpiId, setAddEpiId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addSource, setAddSource] = useState<"new" | "used">("new");
  const [addExpiration, setAddExpiration] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [filterCnpjId, setFilterCnpjId] = useState("all");
  const [filterSectorId, setFilterSectorId] = useState("all");
  const [searchEmployee, setSearchEmployee] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: epis } = useQuery({
    queryKey: ["epis-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epis")
        .select("id, name, stock_quantity, used_stock_quantity, ca_expiration, average_cost")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id && open,
  });

  const { data: allEmployees } = useQuery({
    queryKey: ["employees-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, sector_id, job_function_id, organization_cnpj_id, termination_date, is_active")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as EmployeeOption[];
    },
    enabled: !!organization?.id && open,
  });

  const { data: orgCnpjs } = useQuery({
    queryKey: ["organization-cnpjs-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_cnpjs")
        .select("id, cnpj, company_name")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("is_main", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id && open,
  });

  const { data: sectors } = useQuery({
    queryKey: ["sectors-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id && open,
  });

  const { data: sectorFunctionEpis } = useQuery({
    queryKey: ["sector-function-epis", organization?.id],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let from = 0;
      let allData: SectorFunctionEpi[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("sector_function_epis")
          .select("sector_id, job_function_id, epi_id, quantity, validity_months")
          .eq("organization_id", organization!.id)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data as SectorFunctionEpi[]);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return allData;
    },
    enabled: !!organization?.id && open,
  });

  // Filter employees by manager scope, then by UI filters
  const employees = useMemo(() => {
    if (!allEmployees) return [];
    let filtered = allEmployees.filter(e => !e.termination_date);
    // Manager scope
    if (managerCnpjIds !== null) {
      filtered = filtered.filter(e => e.organization_cnpj_id && managerCnpjIds.includes(e.organization_cnpj_id));
    }
    if (managerSectorIds !== null) {
      filtered = filtered.filter(e => e.sector_id && managerSectorIds.includes(e.sector_id));
    }
    // UI filters
    if (filterCnpjId !== "all") {
      filtered = filtered.filter(e => e.organization_cnpj_id === filterCnpjId);
    }
    if (filterSectorId !== "all") {
      filtered = filtered.filter(e => e.sector_id === filterSectorId);
    }
    if (searchEmployee.trim()) {
      const term = searchEmployee.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      filtered = filtered.filter(e => e.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term));
    }
    return filtered;
  }, [allEmployees, managerCnpjIds, managerSectorIds, filterCnpjId, filterSectorId, searchEmployee]);

  const availableEpis = epis?.filter(e => !epiItems.some(it => it.epi_id === e.id)) || [];

  const addEpi = () => {
    if (!addEpiId || addQty < 1) return;
    setEpiItems(prev => [...prev, { epi_id: addEpiId, quantity: addQty, stock_source: addSource, expiration_date: addExpiration || undefined }]);
    setAddEpiId("");
    setAddQty(1);
    setAddSource("new");
    setAddExpiration("");
  };

  const updateItemExpiration = (index: number, value: string) => {
    setEpiItems(prev => prev.map((it, i) => i === index ? { ...it, expiration_date: value || undefined } : it));
  };

  const removeEpi = (index: number) => {
    setEpiItems(prev => prev.filter((_, i) => i !== index));
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmployeeIds.size === employees.length) {
      setSelectedEmployeeIds(new Set());
    } else {
      setSelectedEmployeeIds(new Set(employees.map(e => e.id)));
    }
  };

  const calculateExpirationDate = (deliveryDateStr: string, validityMonths: number, caExpiration: string | null): string | null => {
    const deliveryDate = deliveryDateStr.includes("T") ? new Date(deliveryDateStr) : parseLocalDate(deliveryDateStr);
    const calculated = addMonths(deliveryDate, validityMonths);
    if (caExpiration) {
      const caDate = parseLocalDate(caExpiration);
      return isAfter(calculated, caDate) ? caExpiration : format(calculated, "yyyy-MM-dd");
    }
    return format(calculated, "yyyy-MM-dd");
  };

  const totalDeliveries = epiItems.length * selectedEmployeeIds.size;

  const handleSubmit = async () => {
    if (!epiItems.length || !selectedEmployeeIds.size || !organization?.id || !profile?.id) return;
    setIsSubmitting(true);
    try {
      let count = 0;
      const selectedEmps = (allEmployees || []).filter(e => selectedEmployeeIds.has(e.id));

      for (const emp of selectedEmps) {
        for (const item of epiItems) {
          const epiData = epis?.find(e => e.id === item.epi_id);

          // Resolve expiration: matrix > manual per-item > CA
          let expirationDate: string | null = null;
          let matrixMatched = false;
          if (emp.sector_id && emp.job_function_id && sectorFunctionEpis) {
            const assoc = sectorFunctionEpis.find(
              a => a.epi_id === item.epi_id && a.sector_id === emp.sector_id && a.job_function_id === emp.job_function_id
            );
            if (assoc) {
              expirationDate = calculateExpirationDate(deliveryDate, assoc.validity_months, epiData?.ca_expiration || null);
              matrixMatched = true;
            }
          }
          if (!matrixMatched) {
            if (item.expiration_date) {
              // Respect CA limit if earlier
              if (epiData?.ca_expiration) {
                const manual = parseLocalDate(item.expiration_date);
                const ca = parseLocalDate(epiData.ca_expiration);
                expirationDate = isAfter(manual, ca) ? epiData.ca_expiration : item.expiration_date;
              } else {
                expirationDate = item.expiration_date;
              }
            } else if (epiData?.ca_expiration) {
              expirationDate = epiData.ca_expiration;
            }
          }

          if (!expirationDate) {
            throw new Error(`Não foi possível determinar a data de vencimento para "${epiData?.name || "EPI"}" do funcionário "${emp.name}". Informe o "Vencimento" do EPI na lista ou cadastre a matriz Setor/Função.`);
          }


          const { error } = await supabase.from("epi_deliveries").insert({
            organization_id: organization.id,
            epi_id: item.epi_id,
            employee_id: profile.id,
            employee_record_id: emp.id,
            delivered_by: profile.id,
            quantity: item.quantity,
            delivery_date: withBrasiliaOffset(deliveryDate),
            reason: reason || null,
            notes: notes || null,
            status: "awaiting_signature",
            expiration_date: expirationDate,
            stock_source: item.stock_source,
            unit_cost: epiData?.average_cost ?? null,
          } as any);
          if (error) throw error;

          if (emp.organization_cnpj_id) {
            await debitCnpjStock(item.epi_id, emp.organization_cnpj_id, organization.id, item.quantity, item.stock_source);
          }
          count++;
        }
      }

      toast.success(`${count} entrega(s) registrada(s) com sucesso! Pendentes de assinatura.`);
      onSuccess();
      resetAndClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar entregas em massa");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setDeliveryDate(toDatetimeLocalValue(nowBrasilia()));
    setReason("");
    setNotes("");
    setEpiItems([]);
    setAddEpiId("");
    setAddQty(1);
    setAddSource("new");
    setAddExpiration("");
    setSelectedEmployeeIds(new Set());
    setFilterCnpjId("all");
    setFilterSectorId("all");
    setSearchEmployee("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Entrega em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Data da entrega */}
          <div>
            <Label>Data da Entrega</Label>
            <Input
              type="datetime-local"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-64"
            />
          </div>

          {/* Seleção de EPIs */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">EPIs para Entrega</Label>
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">EPI</Label>
                <Select value={addEpiId} onValueChange={setAddEpiId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um EPI" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEpis.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20">
                <Label className="text-xs">Qtd</Label>
                <Input type="number" min={1} value={addQty} onChange={e => setAddQty(Number(e.target.value))} />
              </div>
              <div className="w-32">
                <Label className="text-xs">Origem</Label>
                <RadioGroup value={addSource} onValueChange={(v) => setAddSource(v as "new" | "used")} className="flex gap-3 h-10 items-center">
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="new" id="bulk-new" />
                    <Label htmlFor="bulk-new" className="text-xs cursor-pointer">Novo</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="used" id="bulk-used" />
                    <Label htmlFor="bulk-used" className="text-xs cursor-pointer">Usado</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="w-40">
                <Label className="text-xs">Vencimento (opcional)</Label>
                <Input type="date" value={addExpiration} onChange={e => setAddExpiration(e.target.value)} />
              </div>
              <Button size="sm" onClick={addEpi} disabled={!addEpiId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {epiItems.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EPI</TableHead>
                    <TableHead className="w-16 text-center">Qtd</TableHead>
                    <TableHead className="w-20 text-center">Origem</TableHead>
                    <TableHead className="w-44">Vencimento (fallback)</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {epiItems.map((item, idx) => {
                    const epi = epis?.find(e => e.id === item.epi_id);
                    return (
                      <TableRow key={idx}>
                        <TableCell>{epi?.name || "—"}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">{item.stock_source === "new" ? "Novo" : "Usado"}</TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={item.expiration_date || ""}
                            onChange={(e) => updateItemExpiration(idx, e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeEpi(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Seleção de Funcionários */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Funcionários</Label>
            <div className="flex gap-2 items-end flex-wrap">
              {orgCnpjs && orgCnpjs.length > 1 && (
                <div>
                  <Label className="text-xs">Empresa (CNPJ)</Label>
                  <Select value={filterCnpjId} onValueChange={(v) => { setFilterCnpjId(v); setSelectedEmployeeIds(new Set()); }}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {orgCnpjs.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.company_name} ({formatCNPJ(c.cnpj)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {sectors && sectors.length > 0 && (
                <div>
                  <Label className="text-xs">Setor</Label>
                  <Select value={filterSectorId} onValueChange={(v) => { setFilterSectorId(v); setSelectedEmployeeIds(new Set()); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {sectors.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Buscar</Label>
                <Input
                  placeholder="Nome do funcionário..."
                  value={searchEmployee}
                  onChange={e => setSearchEmployee(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Checkbox
                checked={employees.length > 0 && selectedEmployeeIds.size === employees.length}
                onCheckedChange={toggleAll}
                id="select-all"
              />
              <Label htmlFor="select-all" className="text-sm cursor-pointer">
                Selecionar todos ({employees.length} funcionários)
              </Label>
              {selectedEmployeeIds.size > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  {selectedEmployeeIds.size} selecionado(s)
                </span>
              )}
            </div>

            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum funcionário encontrado</p>
                ) : (
                  employees.map(emp => (
                    <div
                      key={emp.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleEmployee(emp.id)}
                    >
                      <Checkbox
                        checked={selectedEmployeeIds.has(emp.id)}
                      />
                      <span className="text-sm">{emp.name}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Motivo e Observações */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Motivo (opcional)</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Entrega periódica" />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>

          {/* Resumo */}
          {epiItems.length > 0 && selectedEmployeeIds.size > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <strong>Resumo:</strong> {epiItems.length} EPI(s) × {selectedEmployeeIds.size} funcionário(s) = <strong>{totalDeliveries} entrega(s)</strong> serão registradas com status "Pendente de Assinatura".
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={isSubmitting}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !epiItems.length || !selectedEmployeeIds.size}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Registrar {totalDeliveries} Entrega(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

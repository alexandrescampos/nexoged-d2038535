import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { formatCNPJ } from "@/lib/cnpj";
import { parseLocalDate } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Printer, Upload, PenLine } from "lucide-react";
import SignatureDialog from "@/components/SignatureDialog";
import jsPDF from "jspdf";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useManagerCnpjs } from "@/hooks/useManagerCnpjs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, PackageCheck, RotateCcw, Trash2, Check, ChevronsUpDown, Eye, Download, MoreHorizontal, AlertTriangle, XCircle, Users, CalendarClock } from "lucide-react";
import BulkDeliveryDialog from "@/components/BulkDeliveryDialog";
import { ExtendExpirationDialog } from "@/components/ExtendExpirationDialog";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, addMonths, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { nowBrasilia, formatBrasiliaDateTime, withBrasiliaOffset, toDatetimeLocalValue } from "@/lib/timezone";
import * as XLSX from "xlsx";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { debitCnpjStock, creditUsedStock, getCnpjStockBatch } from "@/lib/stockOperations";
import { generateEpiTermoPDF } from "@/lib/epiTermo";

interface EpiDelivery {
  id: string;
  epi_id: string;
  employee_id: string;
  employee_record_id: string | null;
  delivered_by: string;
  organization_id: string;
  quantity: number;
  delivery_date: string;
  reason: string | null;
  status: string;
  return_date: string | null;
  notes: string | null;
  expiration_date: string | null;
  stock_source: string | null;
  unit_cost: number | null;
  signed_term_id: string | null;
  epis?: { name: string; ca_expiration: string | null; ca_number: string | null } | null;
  employee_record?: { name: string; pants_size: string | null; shoe_size: string | null; shirt_size: string | null; organization_cnpj_id: string | null; sector_id: string | null } | null;
  deliverer?: { full_name: string } | null;
}

interface GroupedDelivery {
  key: string;
  employee_record_id: string | null;
  employee_name: string;
  pants_size: string | null;
  shoe_size: string | null;
  shirt_size: string | null;
  delivery_date: string;
  delivered_by_name: string;
  reason: string | null;
  notes: string | null;
  items: EpiDelivery[];
  groupStatus: string;
  totalCost: number | null;
}

interface EpiOption { id: string; name: string; stock_quantity: number; used_stock_quantity: number; ca_expiration: string | null; }
interface EmployeeOption { id: string; name: string; pants_size: string | null; shoe_size: string | null; shirt_size: string | null; sector_id: string | null; job_function_id: string | null; termination_date: string | null; organization_cnpj_id: string | null; is_active: boolean; }
interface DeliveryItem { epi_id: string; quantity: number; expiration_date: string | null; fromAssociation?: boolean; validityMonths?: number; stock_source: "new" | "used"; }
interface SectorFunctionEpi { id: string; sector_id: string; job_function_id: string; epi_id: string; quantity: number; validity_months: number; }

const statusLabels: Record<string, string> = {
  awaiting_signature: "Pendente de Assinatura",
  delivered: "Entregue",
  returned: "Devolvido",
  lost: "Perdido",
  damaged: "Danificado",
  discarded: "Descartado",
  partial: "Parcial",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  awaiting_signature: "outline",
  delivered: "default",
  returned: "secondary",
  lost: "destructive",
  damaged: "destructive",
  discarded: "secondary",
  partial: "outline",
};

const statusClassNames: Record<string, string> = {
  awaiting_signature: "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200",
};

function deriveGroupStatus(items: EpiDelivery[]): string {
  const statuses = new Set(items.map((i) => i.status));
  if (statuses.size === 1) return items[0].status;
  return "partial";
}

export default function EpiDeliveries() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { organization, profile, isOrgAdmin, isSuperAdmin, isManager } = useAuth();
  const { managerCnpjIds, managerSectorIds } = useManagerCnpjs();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = usePersistedState("epi-deliveries:dialogOpen", false);
  const [detailsGroup, setDetailsGroup] = usePersistedState<GroupedDelivery | null>("epi-deliveries:detailsGroup", null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmployeeId, setFilterEmployeeId] = useState("all");
  const [filterCnpjId, setFilterCnpjId] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [employeeComboOpen, setEmployeeComboOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = usePersistedState("epi-deliveries:statusDialogOpen", false);
  const [statusDialogData, setStatusDialogData] = usePersistedState<{ delivery: EpiDelivery; newStatus: string } | null>("epi-deliveries:statusDialogData", null);
  const [statusNotes, setStatusNotes] = usePersistedState("epi-deliveries:statusNotes", "");
  const [statusQty, setStatusQty] = usePersistedState("epi-deliveries:statusQty", 1);
  const [uploadingTerm, setUploadingTerm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = usePersistedState("epi-deliveries:signatureDialogOpen", false);
  const [signatureGroup, setSignatureGroup] = usePersistedState<GroupedDelivery | null>("epi-deliveries:signatureGroup", null);
  const [bulkDialogOpen, setBulkDialogOpen] = usePersistedState("epi-deliveries:bulkDialogOpen", false);
  const [extendExpDialogOpen, setExtendExpDialogOpen] = usePersistedState("epi-deliveries:extendExpDialogOpen", false);
  const [extendExpDelivery, setExtendExpDelivery] = usePersistedState<{ id: string; epiName: string; expirationDate: string } | null>("epi-deliveries:extendExpDelivery", null);

  // Check if signed term already exists for active details group.
  // Usa o vínculo direto (signed_term_id) presente nos itens do grupo, evitando
  // contaminação cruzada quando há múltiplos grupos no mesmo timestamp.
  const [form, setForm] = useState({
    employee_id: "", delivery_date: toDatetimeLocalValue(nowBrasilia()),
    reason: "", notes: "",
  });
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [addEpiId, setAddEpiId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addStockSource, setAddStockSource] = useState<"new" | "used">("new");

  const canManage = isOrgAdmin || isSuperAdmin;

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ["epi-deliveries", organization?.id, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("epi_deliveries")
        .select("*, signed_term_id, epis(name, ca_expiration, ca_number), employee_record:employees!epi_deliveries_employee_record_id_fkey(name, pants_size, shoe_size, shirt_size, organization_cnpj_id, sector_id), deliverer:profiles!epi_deliveries_delivered_by_fkey(full_name)")
        .eq("organization_id", organization!.id)
        .order("delivery_date", { ascending: false });
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus as "delivered" | "returned" | "lost" | "damaged" | "awaiting_signature");
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as EpiDelivery[];
    },
    enabled: !!organization?.id,
  });

  const grouped = useMemo<GroupedDelivery[]>(() => {
    if (!deliveries?.length) return [];
    let filtered = deliveries;
    // Manager visibility filter
    if (managerCnpjIds !== null) {
      filtered = filtered.filter((d) => {
        const cnpjId = (d as any).employee_record?.organization_cnpj_id;
        if (!cnpjId || !managerCnpjIds.includes(cnpjId)) return false;
        return true;
      });
    }
    if (managerSectorIds !== null) {
      filtered = filtered.filter((d) => {
        const sectorId = (d as any).employee_record?.sector_id;
        return sectorId && managerSectorIds.includes(sectorId);
      });
    }
    if (filterCnpjId !== "all") {
      filtered = filtered.filter((d) => (d as any).employee_record?.organization_cnpj_id === filterCnpjId);
    }
    if (filterEmployeeId !== "all") {
      filtered = filtered.filter((d) => d.employee_record_id === filterEmployeeId);
    }
    if (filterDateFrom) {
      filtered = filtered.filter((d) => d.delivery_date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter((d) => d.delivery_date < filterDateTo + "T24");
    }
    const map = new Map<string, EpiDelivery[]>();
    for (const d of filtered) {
      const key = `${d.employee_record_id || ""}|${d.delivery_date}|${d.delivered_by}|${d.reason || ""}|${d.notes || ""}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    const result = Array.from(map.entries()).map(([key, items]) => {
      const first = items[0];
      return {
        key,
        employee_record_id: first.employee_record_id,
        employee_name: (first as any).employee_record?.name || "—",
        pants_size: (first as any).employee_record?.pants_size || null,
        shoe_size: (first as any).employee_record?.shoe_size || null,
        shirt_size: (first as any).employee_record?.shirt_size || null,
        delivery_date: first.delivery_date,
        delivered_by_name: first.deliverer?.full_name || "—",
        reason: first.reason,
        notes: first.notes,
        items,
        groupStatus: deriveGroupStatus(items),
        totalCost: items.some((i) => i.unit_cost != null)
          ? items.reduce((sum, i) => sum + (i.unit_cost ?? 0) * i.quantity, 0)
          : null,
      };
    });

    return result;
  }, [deliveries, filterCnpjId, filterEmployeeId, filterDateFrom, filterDateTo, managerCnpjIds, managerSectorIds]);

  const { sortedItems: sortedGrouped, sortField, sortDirection, handleSort } = useTableSort(grouped);

  useEffect(() => {
    const pendingKey = localStorage.getItem("epi-deliveries:detailsGroupKey");
    if (pendingKey && grouped.length > 0) {
      const group = grouped.find(g => g.key === pendingKey);
      if (group) {
        setDetailsGroup(group);
      }
      localStorage.removeItem("epi-deliveries:detailsGroupKey");
    }
  }, [grouped, setDetailsGroup]);

  const delPag = usePagination(sortedGrouped);

  const exportToExcel = () => {
    if (!deliveries?.length) return;
    let filtered = deliveries;
    if (filterStatus !== "all") {
      filtered = filtered.filter((d) => d.status === filterStatus);
    }
    if (filterEmployeeId !== "all") {
      filtered = filtered.filter((d) => d.employee_record_id === filterEmployeeId);
    }
    if (filterDateFrom) {
      filtered = filtered.filter((d) => d.delivery_date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter((d) => d.delivery_date < filterDateTo + "T24");
    }
    const rows = filtered.map((d) => ({
      "Funcionário": (d as any).employee_record?.name || "—",
      "EPI": d.epis?.name || "—",
      "Quantidade": d.quantity,
      "Data Entrega": formatBrasiliaDateTime(d.delivery_date),
      "Data Vencimento": d.expiration_date ? format(parseLocalDate(d.expiration_date), "dd/MM/yyyy") : "",
      "Entregue por": d.deliverer?.full_name || "—",
      "Status": statusLabels[d.status] || d.status,
      "Data Devolução": d.return_date ? format(parseLocalDate(d.return_date), "dd/MM/yyyy") : "",
      "Motivo": d.reason || "",
      "Observações": d.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entregas EPI");
    XLSX.writeFile(wb, `entregas-epi-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Excel exportado com sucesso!");
  };

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
      return data as (EpiOption & { average_cost: number | null })[];
    },
    enabled: !!organization?.id,
  });




  const { data: allEmployees } = useQuery({
    queryKey: ["employees-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, pants_size, shoe_size, shirt_size, sector_id, job_function_id, termination_date, organization_cnpj_id, is_active")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as EmployeeOption[];
    },
    enabled: !!organization?.id,
  });

  const employees = useMemo(() => {
    if (!allEmployees) return undefined;
    if (managerCnpjIds === null) return allEmployees;
    if (managerCnpjIds.length === 0) return [];
    let filtered = allEmployees.filter(e => e.organization_cnpj_id && managerCnpjIds.includes(e.organization_cnpj_id));
    if (managerSectorIds !== null) {
      filtered = filtered.filter(e => e.sector_id && managerSectorIds.includes(e.sector_id));
    }
    return filtered;
  }, [allEmployees, managerCnpjIds, managerSectorIds]);

  // Per-CNPJ stock for selected employee
  const selectedEmpCnpjId = useMemo(() => {
    if (!form.employee_id) return null;
    return employees?.find(e => e.id === form.employee_id)?.organization_cnpj_id || null;
  }, [form.employee_id, employees]);

  const { data: cnpjStockMap } = useQuery({
    queryKey: ["epi-cnpj-stock-with-sources", selectedEmpCnpjId],
    queryFn: async () => {
      // Get configured source CNPJs for the consumer
      const { data: sources, error: srcErr } = await supabase
        .from("cnpj_stock_sources" as any)
        .select("source_cnpj_id")
        .eq("consumer_cnpj_id", selectedEmpCnpjId!);
      if (srcErr) throw srcErr;
      const cnpjIds = [selectedEmpCnpjId!, ...((sources as any[]) || []).map((s) => s.source_cnpj_id)];

      const { data, error } = await supabase
        .from("epi_cnpj_stock" as any)
        .select("epi_id, stock_quantity, used_stock_quantity")
        .in("organization_cnpj_id", cnpjIds);
      if (error) throw error;

      const map: Record<string, { stock_quantity: number; used_stock_quantity: number }> = {};
      for (const row of (data as any[]) || []) {
        if (!map[row.epi_id]) map[row.epi_id] = { stock_quantity: 0, used_stock_quantity: 0 };
        map[row.epi_id].stock_quantity += row.stock_quantity || 0;
        map[row.epi_id].used_stock_quantity += row.used_stock_quantity || 0;
      }
      return map;
    },
    enabled: !!selectedEmpCnpjId,
    // Sempre buscar dados frescos ao abrir/usar o diálogo, para refletir
    // imediatamente novas fontes de estoque (CNPJ de backup) configuradas
    // em outra tela durante a mesma sessão.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: orgCnpjs } = useQuery({
    queryKey: ["organization-cnpjs-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_cnpjs")
        .select("id, cnpj, company_name")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("is_main", { ascending: false })
        .order("company_name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
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
          .select("id, sector_id, job_function_id, epi_id, quantity, validity_months")
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
    enabled: !!organization?.id,
  });

  const calculateExpirationDate = (deliveryDateStr: string, validityMonths: number, caExpiration: string | null): string | null => {
    const deliveryDate = deliveryDateStr.includes("T") ? new Date(deliveryDateStr) : parseLocalDate(deliveryDateStr);
    const calculated = addMonths(deliveryDate, validityMonths);
    if (caExpiration) {
      const caDate = parseLocalDate(caExpiration);
      return isAfter(calculated, caDate) ? caExpiration : format(calculated, "yyyy-MM-dd");
    }
    return format(calculated, "yyyy-MM-dd");
  };

  const loadFunctionEpis = () => {
    const emp = employees?.find((e) => e.id === form.employee_id);
    if (!emp || !emp.sector_id || !emp.job_function_id) {
      toast.info("Funcionário não possui setor ou função definidos.");
      return;
    }
    const associations = sectorFunctionEpis?.filter(
      (a) => a.sector_id === emp.sector_id && a.job_function_id === emp.job_function_id
    ) || [];
    if (!associations.length) {
      toast.info("Nenhum EPI associado ao setor/função deste funcionário.");
      return;
    }
    const newItems = [...items];
    let added = 0;
    for (const assoc of associations) {
      if (!newItems.some((it) => it.epi_id === assoc.epi_id)) {
        const epi = epis?.find((e) => e.id === assoc.epi_id);
        const expDate = calculateExpirationDate(form.delivery_date, assoc.validity_months, epi?.ca_expiration || null);
        newItems.push({ epi_id: assoc.epi_id, quantity: assoc.quantity, expiration_date: expDate, fromAssociation: true, validityMonths: assoc.validity_months, stock_source: "new" });
        added++;
      }
    }
    setItems(newItems);
    if (added > 0) {
      toast.success(`${added} EPI(s) adicionado(s) da função.`);
    } else {
      toast.info("Todos os EPIs da função já estão na lista.");
    }
  };

  const addItem = () => {
    if (!addEpiId || addQty < 1) return;
    const epi = epis?.find((e) => e.id === addEpiId);
    const emp = employees?.find((e) => e.id === form.employee_id);
    const assoc = emp?.sector_id && emp?.job_function_id
      ? sectorFunctionEpis?.find(
          (a) => a.epi_id === addEpiId && a.sector_id === emp.sector_id && a.job_function_id === emp.job_function_id
        )
      : undefined;

    let expDate: string | null;
    let fromAssociation = false;
    let validityMonths: number | undefined;

    if (assoc) {
      expDate = calculateExpirationDate(form.delivery_date, assoc.validity_months, epi?.ca_expiration || null);
      fromAssociation = true;
      validityMonths = assoc.validity_months;
    } else {
      expDate = epi?.ca_expiration || null;
    }

    setItems((prev) => [...prev, { epi_id: addEpiId, quantity: addQty, expiration_date: expDate, fromAssociation, validityMonths, stock_source: addStockSource }]);
    setAddEpiId("");
    setAddQty(1);
    setAddStockSource("new");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const availableEpis = epis?.filter((e) => !items.some((it) => it.epi_id === e.id)) || [];

  const resetDialog = () => {
    setForm({ employee_id: "", delivery_date: toDatetimeLocalValue(nowBrasilia()), reason: "", notes: "" });
    setItems([]);
    setAddEpiId("");
    setAddQty(1);
    setAddStockSource("new");
  };

  const deliverMutation = useMutation({
    mutationFn: async () => {
      // Validate termination date
      const emp = employees?.find((e) => e.id === form.employee_id);
      if (!emp) throw new Error("Funcionário não encontrado");
      
      if (emp.is_active === false) {
        throw new Error("Não é possível registrar entrega para funcionário inativo.");
      }

      if (emp.termination_date) {
        const deliveryDateStr = form.delivery_date.split("T")[0];
        if (deliveryDateStr > emp.termination_date) {
          throw new Error(`Funcionário desligado em ${format(parseLocalDate(emp.termination_date), "dd/MM/yyyy")}. Não é possível registrar entrega após o desligamento.`);
        }
      }

      // Validate that every item has an expiration date — vencimento é obrigatório
      const missingExp = items.findIndex((it) => !it.expiration_date);
      if (missingExp >= 0) {
        const epiName = epis?.find((e) => e.id === items[missingExp].epi_id)?.name || `Item ${missingExp + 1}`;
        throw new Error(`Informe a data de vencimento para "${epiName}". O vencimento é obrigatório.`);
      }

      const empCnpjId = emp.organization_cnpj_id;
      for (const item of items) {
        const epiData = epis?.find((e) => e.id === item.epi_id);
        const { error } = await supabase.from("epi_deliveries").insert({
          organization_id: organization!.id,
          epi_id: item.epi_id,
          employee_id: profile!.id,
          employee_record_id: form.employee_id,
          delivered_by: profile!.id,
          quantity: item.quantity,
          delivery_date: withBrasiliaOffset(form.delivery_date),
          reason: form.reason || null,
          notes: form.notes || null,
          status: "awaiting_signature",
          expiration_date: item.expiration_date,
          stock_source: item.stock_source,
          unit_cost: (epiData as any)?.average_cost ?? null,
        } as any);
        if (error) throw error;

        if (empCnpjId) {
          await debitCnpjStock(item.epi_id, empCnpjId, organization!.id, item.quantity, item.stock_source);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-cnpj-stock"] });
      toast.success(`${items.length} EPI(s) registrado(s) com sucesso! Pendente de assinatura.`);
      setDialogOpen(false);
      resetDialog();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao registrar entrega"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ delivery, newStatus, notes, qty }: { delivery: EpiDelivery; newStatus: string; notes?: string; qty: number }) => {
      const buildNotes = (base: string | null, status: string, extra?: string) => {
        const existing = base ? base + "\n" : "";
        return extra ? existing + `[${statusLabels[status]}] ${extra}` : base;
      };
      // Resolve employee CNPJ for stock operations
      const empCnpjId = delivery.employee_record_id
        ? (await supabase.from("employees").select("organization_cnpj_id").eq("id", delivery.employee_record_id).maybeSingle()).data?.organization_cnpj_id
        : null;

      if (qty >= delivery.quantity) {
        const updateData: any = {
          status: newStatus as "returned" | "lost" | "damaged" | "discarded",
          return_date: format(new Date(), "yyyy-MM-dd"),
        };
        const merged = buildNotes(delivery.notes, newStatus, notes);
        if (merged !== delivery.notes) updateData.notes = merged;
        const { error } = await supabase.from("epi_deliveries").update(updateData).eq("id", delivery.id);
        if (error) throw error;

        if (newStatus === "returned" && empCnpjId) {
          await creditUsedStock(delivery.epi_id, empCnpjId, organization!.id, delivery.quantity);
        }
      } else {
        const { error: updateErr } = await supabase
          .from("epi_deliveries")
          .update({ quantity: delivery.quantity - qty })
          .eq("id", delivery.id);
        if (updateErr) throw updateErr;

        const newRecord: any = {
          organization_id: delivery.organization_id || (organization!.id),
          epi_id: delivery.epi_id,
          employee_id: delivery.employee_id,
          employee_record_id: delivery.employee_record_id,
          delivered_by: delivery.delivered_by,
          quantity: qty,
          delivery_date: delivery.delivery_date,
          reason: delivery.reason,
          notes: buildNotes(delivery.notes, newStatus, notes),
          status: newStatus as "returned" | "lost" | "damaged" | "discarded",
          return_date: format(new Date(), "yyyy-MM-dd"),
          expiration_date: delivery.expiration_date,
        };
        const { error: insertErr } = await supabase.from("epi_deliveries").insert(newRecord);
        if (insertErr) throw insertErr;

        if (newStatus === "returned" && empCnpjId) {
          await creditUsedStock(delivery.epi_id, empCnpjId, organization!.id, qty);
        }
      }
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-cnpj-stock"] });
      const msgs: Record<string, string> = {
        returned: "Devolução registrada!",
        lost: "EPI marcado como perdido!",
        damaged: "EPI marcado como danificado!",
        discarded: "EPI descartado com sucesso!",
      };
      toast.success(msgs[newStatus] || "Status atualizado!");
      setStatusDialogOpen(false);
      setStatusDialogData(null);
      setStatusNotes("");
      setStatusQty(1);
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  // Keep details dialog in sync with fresh data
  const activeDetailsGroup = useMemo(() => {
    if (!detailsGroup) return null;
    return grouped.find((g) => g.key === detailsGroup.key) || null;
  }, [grouped, detailsGroup]);

  const { sortedItems: detailsSortedItems, sortField: detSortField, sortDirection: detSortDirection, handleSort: detHandleSort } = useTableSort(activeDetailsGroup?.items || []);
  const detPag = usePagination(detailsSortedItems);

  // Derived from the freshest grouped data (activeDetailsGroup), so the
  // "Termo já assinado" badge updates imediatamente após assinar sem reabrir.
  const detailsGroupSignedTermId = useMemo(() => {
    if (!activeDetailsGroup?.items?.length) return null;
    const withTerm = activeDetailsGroup.items.find((i) => (i as any).signed_term_id);
    return ((withTerm as any)?.signed_term_id as string | null) ?? null;
  }, [activeDetailsGroup]);

  const { data: existingSignedTermDelivery } = useQuery({
    queryKey: ["epi-signed-terms", detailsGroupSignedTermId],
    queryFn: async () => {
      if (!detailsGroupSignedTermId) return null;
      const { data, error } = await supabase
        .from("epi_signed_terms")
        .select("id, file_url")
        .eq("id", detailsGroupSignedTermId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!detailsGroupSignedTermId,
  });

  const generateTermoPDF = useCallback(async (group: GroupedDelivery, signatureDataUrl?: string): Promise<jsPDF | void> => {
    try {
      return await generateEpiTermoPDF(
        {
          employee_record_id: group.employee_record_id,
          employee_name: group.employee_name,
          delivery_date: group.delivery_date,
          items: group.items.map((it) => ({
            id: it.id,
            epi_id: it.epi_id,
            quantity: it.quantity,
            delivery_date: it.delivery_date,
            expiration_date: it.expiration_date,
            status: it.status,
            reason: it.reason,
          })),
        },
        organization,
        signatureDataUrl
      );
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar o PDF do termo.");
    }
  }, [organization]);

  const handleDigitalSign = useCallback(async (group: GroupedDelivery, signatureDataUrl: string, geo: import("@/lib/geo").CapturedGeo) => {
    try {
      const doc = await generateTermoPDF(group, signatureDataUrl);
      if (!doc || !organization?.id || !profile?.id || !group.employee_record_id) {
        throw new Error("Erro ao gerar PDF");
      }
      const { sealSignedTerm } = await import("@/lib/signedTerms");
      await sealSignedTerm({
        doc,
        employeeRecordId: group.employee_record_id,
        deliveryDate: group.delivery_date,
        geo,
        deliveryIds: group.items.map((i) => i.id),
      });
      // Update status from awaiting_signature to delivered
      const deliveryIds = group.items.filter(i => i.status === "awaiting_signature").map(i => i.id);
      if (deliveryIds.length > 0) {
        const { error: statusErr } = await supabase
          .from("epi_deliveries")
          .update({ status: "delivered" } as any)
          .in("id", deliveryIds);
        if (statusErr) console.error("Erro ao atualizar status:", statusErr);
      }
      toast.success("Termo assinado digitalmente, selado e arquivado com segurança!");
      queryClient.invalidateQueries({ queryKey: ["epi-signed-terms"] });
      queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
    } catch (err) {
      console.error("Erro na assinatura digital:", err);
      toast.error("Erro ao processar assinatura digital.");
      throw err;
    }
  }, [generateTermoPDF, organization, profile, queryClient]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Entregas de EPI</h1>
          <p className="text-muted-foreground">Controle de entregas e devoluções • Total: {grouped.length}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={!deliveries?.length}>
            <Download className="mr-2 h-4 w-4" /> Exportar Excel
          </Button>
          {canManage && (
            <>
              <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
                <Users className="mr-2 h-4 w-4" /> Entrega em Massa
              </Button>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nova Entrega
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <Label>Filtrar por status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="awaiting_signature">Pendente de Assinatura</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
              <SelectItem value="returned">Devolvido</SelectItem>
              <SelectItem value="lost">Perdido</SelectItem>
              <SelectItem value="damaged">Danificado</SelectItem>
              <SelectItem value="discarded">Descartado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Filtrar por funcionário</Label>
          <Select value={filterEmployeeId} onValueChange={setFilterEmployeeId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {employees?.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {orgCnpjs && orgCnpjs.length > 1 && (
          <div>
            <Label>Empresa (CNPJ)</Label>
            <Select value={filterCnpjId} onValueChange={setFilterCnpjId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {orgCnpjs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name} ({formatCNPJ(c.cnpj)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Data inicial</Label>
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div>
          <Label>Data final</Label>
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[160px]" />
        </div>
        {(filterDateFrom || filterDateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}>
            Limpar datas
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !grouped.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <PackageCheck className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma entrega registrada</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead field="employee_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Funcionário</SortableTableHead>
                  <SortableTableHead field="items.length" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Itens</SortableTableHead>
                  <SortableTableHead field="delivery_date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Data Entrega</SortableTableHead>
                  <SortableTableHead field="delivered_by_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Entregue por</SortableTableHead>
                  <SortableTableHead field="groupStatus" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                  <SortableTableHead field="totalCost" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Custo Total</SortableTableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delPag.paginatedItems.map((g) => (
                  <TableRow key={g.key} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailsGroup(g)}>
                    <TableCell className="font-medium">{g.employee_name}</TableCell>
                    <TableCell>
                      {g.items.length === 1
                        ? g.items[0].epis?.name || "1 item"
                        : `${g.items.length} itens`}
                    </TableCell>
                    <TableCell>{formatBrasiliaDateTime(g.delivery_date)}</TableCell>
                    <TableCell>{g.delivered_by_name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[g.groupStatus] || "default"} className={statusClassNames[g.groupStatus] || ""}>
                        {statusLabels[g.groupStatus] || g.groupStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {g.totalCost != null
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(g.totalCost)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver detalhes"
                        onClick={(e) => { e.stopPropagation(); setDetailsGroup(g); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination currentPage={delPag.currentPage} totalPages={delPag.totalPages} totalItems={delPag.totalItems} pageSize={delPag.pageSize} onPageChange={delPag.setCurrentPage} onPageSizeChange={delPag.setPageSize} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!detailsGroup} onOpenChange={(open) => { if (!open) setDetailsGroup(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Detalhes da Entrega</DialogTitle>
          </DialogHeader>
          {activeDetailsGroup && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Funcionário</span>
                  <p className="text-sm font-medium">{activeDetailsGroup.employee_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Data da Entrega</span>
                  <p className="text-sm font-medium">{formatBrasiliaDateTime(activeDetailsGroup.delivery_date)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Entregue por</span>
                  <p className="text-sm font-medium">{activeDetailsGroup.delivered_by_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Status Geral</span>
                  <Badge variant={statusVariants[activeDetailsGroup.groupStatus] || "default"} className={`mt-1 ${statusClassNames[activeDetailsGroup.groupStatus] || ""}`}>
                    {statusLabels[activeDetailsGroup.groupStatus] || activeDetailsGroup.groupStatus}
                  </Badge>
                </div>
              </div>

              {/* Employee sizes */}
              {(activeDetailsGroup.pants_size || activeDetailsGroup.shoe_size || activeDetailsGroup.shirt_size) && (
                <div className="grid grid-cols-3 gap-3 rounded-md bg-muted p-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Tam. Calça</span>
                    <p className="text-sm font-medium">{activeDetailsGroup.pants_size || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tam. Calçado</span>
                    <p className="text-sm font-medium">{activeDetailsGroup.shoe_size || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tam. Camisa</span>
                    <p className="text-sm font-medium">{activeDetailsGroup.shirt_size || "—"}</p>
                  </div>
                </div>
              )}

              {activeDetailsGroup.reason && (
                <div>
                  <span className="text-xs text-muted-foreground">Motivo</span>
                  <p className="text-sm">{activeDetailsGroup.reason}</p>
                </div>
              )}
              {activeDetailsGroup.notes && (
                <div>
                  <span className="text-xs text-muted-foreground">Observações</span>
                  <p className="text-sm">{activeDetailsGroup.notes}</p>
                </div>
              )}

              {/* Items table */}
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[850px]">
                  <TableHeader>
                     <TableRow>
                       <SortableTableHead field="epis.name" sortField={detSortField} sortDirection={detSortDirection} onSort={detHandleSort}>EPI</SortableTableHead>
                       <SortableTableHead field="epis.ca_number" sortField={detSortField} sortDirection={detSortDirection} onSort={detHandleSort}>C.A.</SortableTableHead>
                       <SortableTableHead field="quantity" sortField={detSortField} sortDirection={detSortDirection} onSort={detHandleSort} className="w-[60px]">Qtd</SortableTableHead>
                       <SortableTableHead field="stock_source" sortField={detSortField} sortDirection={detSortDirection} onSort={detHandleSort}>Origem</SortableTableHead>
                       <SortableTableHead field="unit_cost" sortField={detSortField} sortDirection={detSortDirection} onSort={detHandleSort}>Custo Unit.</SortableTableHead>
                       <SortableTableHead field="expiration_date" sortField={detSortField} sortDirection={detSortDirection} onSort={detHandleSort}>Vencimento</SortableTableHead>
                       <SortableTableHead field="status" sortField={detSortField} sortDirection={detSortDirection} onSort={detHandleSort}>Status</SortableTableHead>
                       <TableHead>Devolução</TableHead>
                       {canManage && <TableHead className="w-[60px]">Ações</TableHead>}
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {detPag.paginatedItems.map((d) => (
                       <TableRow key={d.id}>
                          <TableCell className="text-sm font-medium">{d.epis?.name || "—"}</TableCell>
                          <TableCell className="text-sm">{d.epis?.ca_number || "—"}</TableCell>
                          <TableCell className="text-sm">{d.quantity}</TableCell>
                          <TableCell>
                            <Badge variant={(d as any).stock_source === "used" ? "secondary" : "default"} className="text-xs">
                              {(d as any).stock_source === "used" ? "Usado" : "Novo"}
                            </Badge>
                           </TableCell>
                           <TableCell className="text-sm">
                             {d.unit_cost != null
                               ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.unit_cost)
                               : "—"}
                           </TableCell>
                           <TableCell className="text-sm">
                            {d.expiration_date ? (
                              <span className={d.expiration_date < today ? "text-destructive font-medium" : ""}>
                                {format(parseLocalDate(d.expiration_date), "dd/MM/yyyy")}
                              </span>
                            ) : "—"}
                          </TableCell>
                         <TableCell>
                           <Badge variant={statusVariants[d.status] || "default"} className={`text-xs ${statusClassNames[d.status] || ""}`}>
                             {statusLabels[d.status] || d.status}
                           </Badge>
                         </TableCell>
                         <TableCell className="text-sm">{d.return_date ? format(parseLocalDate(d.return_date), "dd/MM/yyyy") : "—"}</TableCell>
                         {canManage && (
                          <TableCell>
                            {(d.status === "delivered" || d.status === "awaiting_signature") && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setStatusDialogData({ delivery: d, newStatus: "returned" }); setStatusNotes(""); setStatusQty(d.quantity); setStatusDialogOpen(true); }}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Registrar Devolução
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setStatusDialogData({ delivery: d, newStatus: "lost" }); setStatusNotes(""); setStatusQty(d.quantity); setStatusDialogOpen(true); }}>
                                    <AlertTriangle className="mr-2 h-4 w-4" /> Marcar como Perdido
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setStatusDialogData({ delivery: d, newStatus: "damaged" }); setStatusNotes(""); setStatusQty(d.quantity); setStatusDialogOpen(true); }}>
                                    <XCircle className="mr-2 h-4 w-4" /> Marcar como Danificado
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setStatusDialogData({ delivery: d, newStatus: "discarded" }); setStatusNotes(""); setStatusQty(d.quantity); setStatusDialogOpen(true); }}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Descartar EPI
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { 
                                    setExtendExpDelivery({ 
                                      id: d.id, 
                                      epiName: d.epis?.name || "EPI", 
                                      expirationDate: d.expiration_date || "" 
                                    });
                                    setExtendExpDialogOpen(true);
                                  }}>
                                    <CalendarClock className="mr-2 h-4 w-4" /> Estender Validade
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  currentPage={detPag.currentPage}
                  totalPages={detPag.totalPages}
                  totalItems={detPag.totalItems}
                  pageSize={detPag.pageSize}
                  onPageChange={detPag.setCurrentPage}
                  onPageSizeChange={detPag.setPageSize}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDetailsGroup(null)}>Fechar</Button>
            {activeDetailsGroup && canManage && existingSignedTermDelivery && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-green-700 bg-green-100">
                  <Check className="mr-1 h-3 w-3" /> Termo já assinado
                </Badge>
                <button
                  type="button"
                  className="text-sm text-primary underline cursor-pointer"
                  onClick={async () => {
                    try {
                      const { openSignedTerm } = await import("@/lib/signedTerms");
                      await openSignedTerm(existingSignedTermDelivery.file_url);
                    } catch (e) {
                      console.error(e);
                      toast.error("Erro ao abrir o arquivo.");
                    }
                  }}
                >
                  Visualizar
                </button>
              </div>
            )}
            {activeDetailsGroup && canManage && !existingSignedTermDelivery && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !activeDetailsGroup || !organization || !profile) return;
                    setUploadingTerm(true);
                    try {
                      const ext = file.name.split(".").pop();
                      const path = `${organization.id}/${activeDetailsGroup.employee_record_id}/${Date.now()}.${ext}`;
                      const { error: upErr } = await supabase.storage.from("signed-terms").upload(path, file);
                      if (upErr) throw upErr;
                      const { data: urlData } = supabase.storage.from("signed-terms").getPublicUrl(path);
                      const { data: insertedTerm, error: dbErr } = await supabase
                        .from("epi_signed_terms" as any)
                        .insert({
                          organization_id: organization.id,
                          employee_record_id: activeDetailsGroup.employee_record_id,
                          delivery_date: activeDetailsGroup.delivery_date,
                          file_url: urlData.publicUrl,
                          file_name: file.name,
                          uploaded_by: profile.id,
                        })
                        .select("id")
                        .single();
                      if (dbErr) throw dbErr;
                      // Vincular todas as entregas deste grupo ao termo recém-criado
                      const allGroupIds = activeDetailsGroup.items.map((i) => i.id);
                      if (allGroupIds.length > 0 && (insertedTerm as any)?.id) {
                        const { error: linkErr } = await supabase
                          .from("epi_deliveries")
                          .update({ signed_term_id: (insertedTerm as any).id } as any)
                          .in("id", allGroupIds);
                        if (linkErr) console.error("Erro ao vincular termo às entregas:", linkErr);
                      }
                      // Update status from awaiting_signature to delivered
                      const deliveryIds = activeDetailsGroup.items.filter(i => i.status === "awaiting_signature").map(i => i.id);
                      if (deliveryIds.length > 0) {
                        const { error: statusErr } = await supabase
                          .from("epi_deliveries")
                          .update({ status: "delivered" } as any)
                          .in("id", deliveryIds);
                        if (statusErr) console.error("Erro ao atualizar status:", statusErr);
                      }
                      toast.success("Termo assinado carregado com sucesso!");
                      queryClient.invalidateQueries({ queryKey: ["epi-signed-terms"] });
                      queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
                    } catch (err) {
                      console.error(err);
                      toast.error("Erro ao carregar o termo assinado.");
                    } finally {
                      setUploadingTerm(false);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingTerm}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingTerm ? "Enviando..." : "Upload Termo Assinado"}
                </Button>
              </>
            )}
            {activeDetailsGroup && canManage && !existingSignedTermDelivery && (
              <Button
                variant="outline"
                onClick={() => { setSignatureGroup(activeDetailsGroup); setSignatureDialogOpen(true); }}
              >
                <PenLine className="mr-2 h-4 w-4" /> Assinar Digitalmente
              </Button>
            )}
            {activeDetailsGroup && (
              <Button onClick={() => generateTermoPDF(activeDetailsGroup)}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir Termo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Digital Signature Dialog */}
      {signatureGroup && (
        <SignatureDialog
          open={signatureDialogOpen}
          onOpenChange={setSignatureDialogOpen}
          title="Assinatura Digital - Termo de Entrega de EPI"
          employeeName={signatureGroup.employee_name}
          summary={
            <div>
              <p><strong>Funcionário:</strong> {signatureGroup.employee_name}</p>
              <p><strong>Data da Entrega:</strong> {formatBrasiliaDateTime(signatureGroup.delivery_date)}</p>
              <p><strong>Itens:</strong> {signatureGroup.items.length} EPI(s)</p>
            </div>
          }
          onConfirm={async (sig, geo) => handleDigitalSign(signatureGroup, sig, geo)}
        />
      )}

      {/* New Delivery Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (open) {
          // Garante leitura fresca das fontes de estoque (CNPJ de backup) toda vez que o diálogo abrir.
          queryClient.invalidateQueries({ queryKey: ["epi-cnpj-stock-with-sources"] });
        }
        if (!open) resetDialog();
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Entrega de EPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário *</Label>
              <Popover open={employeeComboOpen} onOpenChange={setEmployeeComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeeComboOpen}
                    className="w-full justify-between font-normal"
                  >
                    {form.employee_id
                      ? employees?.find((e) => e.id === form.employee_id)?.name
                      : "Selecione o funcionário"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command
                    filter={(value, search) => {
                      const emp = employees?.find((e) => e.id === value);
                      if (!emp) return 0;
                      const normalize = (s: string) =>
                        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                      return normalize(emp.name).includes(normalize(search)) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Buscar funcionário..." />
                    <CommandList>
                      <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {employees?.map((e) => (
                          <CommandItem
                            key={e.id}
                            value={e.id}
                            onSelect={(val) => {
                              setForm({ ...form, employee_id: val });
                              setEmployeeComboOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", form.employee_id === e.id ? "opacity-100" : "opacity-0")} />
                            {e.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {form.employee_id && (() => {
              const emp = employees?.find((e) => e.id === form.employee_id);
              return emp ? (
                <div className="grid grid-cols-3 gap-3 rounded-md bg-muted p-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Tam. Calça</span>
                    <p className="text-sm font-medium">{emp.pants_size || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tam. Calçado</span>
                    <p className="text-sm font-medium">{emp.shoe_size || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tam. Camisa</span>
                    <p className="text-sm font-medium">{emp.shirt_size || "—"}</p>
                  </div>
                </div>
              ) : null;
            })()}

            {form.employee_id && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={loadFunctionEpis}
              >
                <PackageCheck className="mr-2 h-4 w-4" /> Incluir EPIs da Função
              </Button>
            )}

            <div>
              <Label>Itens da Entrega</Label>
              {items.length > 0 && (
                <div className="mt-2 rounded-md border">
                  <Table>
                    <TableHeader>
                       <TableRow>
                         <TableHead>EPI</TableHead>
                         <TableHead className="w-[60px]">Qtd</TableHead>
                         <TableHead>Origem</TableHead>
                         <TableHead>Vencimento</TableHead>
                         <TableHead className="w-[40px]"></TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {items.map((item, idx) => {
                         const epi = epis?.find((e) => e.id === item.epi_id);
                         return (
                           <TableRow key={idx}>
                              <TableCell className="text-sm">{epi?.name || "—"}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-7 w-[60px] text-sm"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = Math.max(1, Number(e.target.value));
                                    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <RadioGroup
                                  value={item.stock_source}
                                  onValueChange={(v) =>
                                    setItems((prev) => prev.map((it, i) =>
                                      i === idx ? { ...it, stock_source: v as "new" | "used" } : it
                                    ))
                                  }
                                  className="flex gap-3"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <RadioGroupItem value="new" id={`item-stock-new-${idx}`} />
                                    <Label htmlFor={`item-stock-new-${idx}`} className="text-xs font-normal cursor-pointer">
                                      Novo ({cnpjStockMap?.[item.epi_id]?.stock_quantity ?? 0})
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <RadioGroupItem value="used" id={`item-stock-used-${idx}`} />
                                    <Label htmlFor={`item-stock-used-${idx}`} className="text-xs font-normal cursor-pointer">
                                      Usado ({cnpjStockMap?.[item.epi_id]?.used_stock_quantity ?? 0})
                                    </Label>
                                  </div>
                                </RadioGroup>
                              </TableCell>
                               <TableCell>
                                <Input
                                  type="date"
                                  required
                                  className={`h-7 w-[140px] text-sm ${!item.expiration_date ? "border-destructive" : ""}`}
                                  value={item.expiration_date || ""}
                                  onChange={(e) => {
                                    const val = e.target.value || null;
                                    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, expiration_date: val } : it));
                                  }}
                                />
                              </TableCell>
                             <TableCell>
                               <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}>
                                 <Trash2 className="h-3.5 w-3.5 text-destructive" />
                               </Button>
                             </TableCell>
                           </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex gap-2 mt-2 items-end flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Label className="text-xs text-muted-foreground">EPI</Label>
                  <Select value={addEpiId} onValueChange={(v) => { setAddEpiId(v); setAddStockSource("new"); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o EPI" /></SelectTrigger>
                    <SelectContent>
                      {availableEpis.map((e) => {
                        const cnpjS = cnpjStockMap?.[e.id];
                        return (
                          <SelectItem key={e.id} value={e.id}>{e.name} (N:{cnpjS?.stock_quantity ?? 0} U:{cnpjS?.used_stock_quantity ?? 0})</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[80px]">
                  <Label className="text-xs text-muted-foreground">Qtd</Label>
                  <Input type="number" min={1} value={addQty} onChange={(e) => setAddQty(Number(e.target.value))} />
                </div>
                {addEpiId && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Origem</Label>
                    <RadioGroup value={addStockSource} onValueChange={(v) => setAddStockSource(v as "new" | "used")} className="flex gap-3 mt-1">
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="new" id="stock-new" />
                        <Label htmlFor="stock-new" className="text-xs font-normal cursor-pointer">
                          Novo ({cnpjStockMap?.[addEpiId]?.stock_quantity ?? 0})
                        </Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="used" id="stock-used" />
                        <Label htmlFor="stock-used" className="text-xs font-normal cursor-pointer">
                          Usado ({cnpjStockMap?.[addEpiId]?.used_stock_quantity ?? 0})
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={addItem} disabled={!addEpiId || addQty < 1}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data da entrega</Label>
                <Input type="datetime-local" value={form.delivery_date} onChange={(e) => {
                  const newDate = e.target.value;
                  setForm({ ...form, delivery_date: newDate });
                  // Recalculate expiration dates for association items
                  setItems((prev) => prev.map((it) => {
                    if (it.fromAssociation && it.validityMonths) {
                      const epi = epis?.find((ep) => ep.id === it.epi_id);
                      return { ...it, expiration_date: calculateExpirationDate(newDate, it.validityMonths, epi?.ca_expiration || null) };
                    }
                    return it;
                  }));
                }} />
              </div>
              <div>
                <Label>Motivo</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex: Substituição, novo funcionário" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetDialog(); }}>Cancelar</Button>
            <Button
              onClick={() => deliverMutation.mutate()}
              disabled={!form.employee_id || items.length === 0 || deliverMutation.isPending}
            >
              {deliverMutation.isPending ? "Registrando..." : `Registrar ${items.length} item(ns)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Action Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={(open) => { if (!open) { setStatusDialogOpen(false); setStatusDialogData(null); setStatusNotes(""); setStatusQty(1); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusDialogData?.newStatus === "returned" ? "Registrar Devolução" : statusDialogData?.newStatus === "lost" ? "Marcar como Perdido" : "Marcar como Danificado"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              EPI: <span className="font-medium text-foreground">{statusDialogData?.delivery.epis?.name}</span>
            </p>
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                max={statusDialogData?.delivery.quantity || 1}
                value={statusQty}
                onChange={(e) => setStatusQty(Math.max(1, Math.min(Number(e.target.value), statusDialogData?.delivery.quantity || 1)))}
                className="w-[120px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Máximo: {statusDialogData?.delivery.quantity || 1} unidade(s)
              </p>
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Descreva o ocorrido..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStatusDialogOpen(false); setStatusDialogData(null); setStatusNotes(""); setStatusQty(1); }}>
              Cancelar
            </Button>
            <Button
              variant={statusDialogData?.newStatus === "returned" ? "default" : "destructive"}
              onClick={() => {
                if (statusDialogData) {
                  updateStatusMutation.mutate({ ...statusDialogData, notes: statusNotes || undefined, qty: statusQty });
                }
              }}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkDeliveryDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
          queryClient.invalidateQueries({ queryKey: ["epis"] });
          queryClient.invalidateQueries({ queryKey: ["epi-cnpj-stock"] });
        }}
      />

      {extendExpDelivery && (
        <ExtendExpirationDialog
          open={extendExpDialogOpen}
          onOpenChange={setExtendExpDialogOpen}
          delivery={extendExpDelivery}
          onSuccess={async (deliveryId: string) => {
                await queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
                // Encontrar o novo grupo que contém esta entrega para abrir a assinatura
                const { data } = await supabase
                  .from("epi_deliveries")
                  .select("*, signed_term_id, epis(name, ca_expiration, ca_number), employee_record:employees!epi_deliveries_employee_record_id_fkey(name, pants_size, shoe_size, shirt_size, organization_cnpj_id, sector_id), deliverer:profiles!epi_deliveries_delivered_by_fkey(full_name)")
                  .eq("id", deliveryId)
                  .single();
                
                if (data) {
                  const delivery = data as unknown as EpiDelivery;
                  const key = `${delivery.employee_record_id || ""}|${delivery.delivery_date}|${delivery.delivered_by}|${delivery.reason || ""}|${delivery.notes || ""}`;
                  const group = {
                    key,
                    employee_record_id: delivery.employee_record_id,
                    employee_name: (delivery as any).employee_record?.name || "—",
                    pants_size: (delivery as any).employee_record?.pants_size || null,
                    shoe_size: (delivery as any).employee_record?.shoe_size || null,
                    shirt_size: (delivery as any).employee_record?.shirt_size || null,
                    delivery_date: delivery.delivery_date,
                    delivered_by_name: delivery.deliverer?.full_name || "—",
                    reason: delivery.reason,
                    notes: delivery.notes,
                    items: [delivery],
                    groupStatus: delivery.status,
                    totalCost: delivery.unit_cost ? delivery.unit_cost * delivery.quantity : null,
                  };
                  setSignatureGroup(group);
                  setSignatureDialogOpen(true);
                  setDetailsGroup(null);
                }
              }}
            />
      )}
    </div>
  );
}

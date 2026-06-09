import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import { formatCNPJ } from "@/lib/cnpj";
import { todayBrasilia, nowBrasilia, withBrasiliaOffset, toDatetimeLocalValue, formatBrasiliaDateTime } from "@/lib/timezone";
import { parseLocalDate } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Printer, Loader2, RefreshCw, History, Upload, PenLine } from "lucide-react";
import SignatureDialog from "@/components/SignatureDialog";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { creditUsedStock, debitCnpjStock } from "@/lib/stockOperations";
import { useManagerCnpjs } from "@/hooks/useManagerCnpjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Check, ChevronsUpDown, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { format, addMonths, isAfter, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";

interface EmployeeOption {
  id: string;
  name: string;
  sector_id: string | null;
  job_function_id: string | null;
  cpf: string | null;
  organization_cnpj_id: string | null;
  termination_date: string | null;
  is_active: boolean;
}

interface DeliveredItem {
  id: string;
  epi_id: string;
  epi_name: string;
  ca_number: string | null;
  ca_expiration: string | null;
  quantity: number;
  delivery_date: string;
  expiration_date: string | null;
}

interface ExchangeSelection {
  delivery_id: string;
  epi_id: string;
  epi_name: string;
  ca_number: string | null;
  ca_expiration: string | null;
  original_qty: number;
  exchange_qty: number;
  new_qty: number;
}

interface SectorFunctionEpi {
  epi_id: string;
  validity_months: number;
}

interface ExchangeHistoryItem {
  id: string;
  epi_id: string;
  epi_name: string;
  employee_name: string;
  employee_record_id: string | null;
  organization_cnpj_id: string | null;
  quantity: number;
  delivery_date: string;
  expiration_date: string | null;
  reason: string | null;
  notes: string | null;
  status: string;
}

export default function EpiExchanges() {
  const { organization, profile, isOrgAdmin, isSuperAdmin, isManager } = useAuth();
  const { managerCnpjIds, managerSectorIds } = useManagerCnpjs();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const canManage = isOrgAdmin || isSuperAdmin;

  useEffect(() => {
    if (!canManage && !isManager) {
      navigate("/dashboard");
      toast.error("Acesso restrito a administradores.");
    }
  }, [canManage, isManager, navigate]);

  if (!canManage && !isManager) return null;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeComboOpen, setEmployeeComboOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [exchangeDate, setExchangeDate] = useState(todayBrasilia());
  const [reason, setReason] = useState("");
  const [selections, setSelections] = useState<ExchangeSelection[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exchangeComplete, setExchangeComplete] = useState(false);
  const [lastExchangeData, setLastExchangeData] = useState<{ employee: EmployeeOption; items: ExchangeSelection[]; date: string } | null>(null);
  const [uploadingTerm, setUploadingTerm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = usePersistedState("epi-exchanges:signatureDialogOpen", false);

  // Check if signed term already exists for last exchange
  const { data: existingSignedTermExchange } = useQuery({
    queryKey: ["epi-signed-terms", organization?.id, lastExchangeData?.employee?.id, lastExchangeData?.date],
    queryFn: async () => {
      if (!organization?.id || !lastExchangeData?.employee?.id || !lastExchangeData?.date) return null;
      const { data, error } = await supabase
        .from("epi_signed_terms")
        .select("id, file_url")
        .eq("organization_id", organization.id)
        .eq("employee_record_id", lastExchangeData.employee.id)
        .eq("delivery_date", lastExchangeData.date)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id && !!lastExchangeData?.employee?.id && !!lastExchangeData?.date,
  });

  // History filters
  const [histFilterEmployeeId, setHistFilterEmployeeId] = useState("all");
  const [histEmployeeComboOpen, setHistEmployeeComboOpen] = useState(false);
  const [histEmployeeSearch, setHistEmployeeSearch] = useState("");
  const [histFilterCnpjId, setHistFilterCnpjId] = useState("all");
  const [histFilterDateFrom, setHistFilterDateFrom] = useState<Date | undefined>(undefined);
  const [histFilterDateTo, setHistFilterDateTo] = useState<Date | undefined>(undefined);

  // Employees
  const { data: allEmployees } = useQuery({
    queryKey: ["employees-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, sector_id, job_function_id, cpf, organization_cnpj_id, termination_date, is_active")
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

  // EPIs in hand for selected employee
  const { data: deliveredItems, isLoading: loadingItems } = useQuery({
    queryKey: ["employee-delivered-epis", selectedEmployeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_deliveries")
        .select("id, epi_id, quantity, delivery_date, expiration_date, epis(name, ca_number, ca_expiration)")
        .eq("employee_record_id", selectedEmployeeId)
        .eq("status", "delivered")
        .eq("organization_id", organization!.id)
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        epi_id: d.epi_id,
        epi_name: d.epis?.name || "—",
        ca_number: d.epis?.ca_number || null,
        ca_expiration: d.epis?.ca_expiration || null,
        quantity: d.quantity,
        delivery_date: d.delivery_date,
        expiration_date: d.expiration_date,
      })) as DeliveredItem[];
    },
    enabled: !!selectedEmployeeId && !!organization?.id,
  });
  
  const { sortedItems: sortedDeliveredItems, sortField: delSortField, sortDirection: delSortDirection, handleSort: delHandleSort } = useTableSort(deliveredItems || []);
  const delPag = usePagination(sortedDeliveredItems);

  // Sector/function EPI matrix for validity
  const { data: sectorFunctionEpis } = useQuery({
    queryKey: ["sector-function-epis", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sector_function_epis")
        .select("epi_id, validity_months, sector_id, job_function_id")
        .eq("organization_id", organization!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Exchange history - new deliveries marked with [Troca]
  const { data: exchangeHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["exchange-history", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_deliveries")
        .select("id, epi_id, quantity, delivery_date, expiration_date, reason, notes, status, employee_record_id, epis(name), employee_record:employees!epi_deliveries_employee_record_id_fkey(name, organization_cnpj_id)")
        .eq("organization_id", organization!.id)
        .eq("status", "delivered")
        .like("notes", "%[Troca]%")
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        epi_id: d.epi_id,
        epi_name: d.epis?.name || "—",
        employee_name: d.employee_record?.name || "—",
        employee_record_id: d.employee_record_id,
        organization_cnpj_id: d.employee_record?.organization_cnpj_id || null,
        quantity: d.quantity,
        delivery_date: d.delivery_date,
        expiration_date: d.expiration_date,
        reason: d.reason,
        notes: d.notes,
        status: d.status,
      })) as ExchangeHistoryItem[];
    },
    enabled: !!organization?.id,
  });

  const visibleEmployeeIds = useMemo(() => new Set(employees?.map(e => e.id) || []), [employees]);

  const filteredHistory = useMemo(() => {
    if (!exchangeHistory?.length) return [];
    let filtered = exchangeHistory;
    // Manager visibility filter
    if (managerCnpjIds !== null) {
      filtered = filtered.filter((d) => d.employee_record_id && visibleEmployeeIds.has(d.employee_record_id));
    }
    if (histFilterCnpjId !== "all") {
      filtered = filtered.filter((d) => d.organization_cnpj_id === histFilterCnpjId);
    }
    if (histFilterEmployeeId !== "all") {
      filtered = filtered.filter((d) => d.employee_record_id === histFilterEmployeeId);
    }
    if (histFilterDateFrom) {
      const from = format(histFilterDateFrom, "yyyy-MM-dd");
      filtered = filtered.filter((d) => d.delivery_date >= from);
    }
    if (histFilterDateTo) {
      const to = format(histFilterDateTo, "yyyy-MM-dd");
      filtered = filtered.filter((d) => d.delivery_date <= to);
    }
    return filtered;
  }, [exchangeHistory, histFilterCnpjId, histFilterEmployeeId, histFilterDateFrom, histFilterDateTo, managerCnpjIds, visibleEmployeeIds]);

  const { sortedItems: sortedHistory, sortField: histSortField, sortDirection: histSortDirection, handleSort: histHandleSort } = useTableSort(filteredHistory);
  const histPag = usePagination(sortedHistory);

  const selectedEmployee = employees?.find((e) => e.id === selectedEmployeeId);

  const calculateExpirationDate = useCallback((deliveryDateStr: string, validityMonths: number, caExpiration: string | null): string | null => {
    const deliveryDate = parseLocalDate(deliveryDateStr);
    const calculated = addMonths(deliveryDate, validityMonths);
    if (caExpiration) {
      const caDate = parseLocalDate(caExpiration);
      return isAfter(calculated, caDate) ? caExpiration : format(calculated, "yyyy-MM-dd");
    }
    return format(calculated, "yyyy-MM-dd");
  }, []);

  const getValidityMonths = useCallback((epiId: string): number => {
    if (!selectedEmployee || !sectorFunctionEpis) return 12;
    const match = sectorFunctionEpis.find(
      (s) => s.epi_id === epiId && s.sector_id === selectedEmployee.sector_id && s.job_function_id === selectedEmployee.job_function_id
    );
    return match?.validity_months || 12;
  }, [selectedEmployee, sectorFunctionEpis]);

  const toggleSelection = (item: DeliveredItem) => {
    setSelections((prev) => {
      const exists = prev.find((s) => s.delivery_id === item.id);
      if (exists) return prev.filter((s) => s.delivery_id !== item.id);
      return [...prev, {
        delivery_id: item.id,
        epi_id: item.epi_id,
        epi_name: item.epi_name,
        ca_number: item.ca_number,
        ca_expiration: item.ca_expiration,
        original_qty: item.quantity,
        exchange_qty: item.quantity,
        new_qty: item.quantity,
      }];
    });
  };

  const updateExchangeQty = (deliveryId: string, qty: number) => {
    setSelections((prev) =>
      prev.map((s) => {
        if (s.delivery_id !== deliveryId) return s;
        const newExchangeQty = Math.min(Math.max(1, qty), s.original_qty);
        return { ...s, exchange_qty: newExchangeQty, new_qty: Math.max(s.new_qty, newExchangeQty) };
      })
    );
  };

  const updateNewQty = (deliveryId: string, qty: number) => {
    setSelections((prev) =>
      prev.map((s) => s.delivery_id === deliveryId ? { ...s, new_qty: Math.max(1, qty) } : s)
    );
  };

  const handleSelectEmployee = useCallback((empId: string) => {
    setSelectedEmployeeId(empId);
    setSelections([]);
    setExchangeComplete(false);
    setLastExchangeData(null);
    setEmployeeComboOpen(false);
  }, []);

  // Auto-select employee when navigating from expiring report
  useEffect(() => {
    const state = location.state as { employeeId?: string } | null;
    if (state?.employeeId && employees?.length) {
      const exists = employees.some(e => e.id === state.employeeId);
      if (exists) {
        handleSelectEmployee(state.employeeId);
        // Clear the state so it doesn't re-trigger
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, employees, handleSelectEmployee]);

  const exchangeMutation = useMutation({
    mutationFn: async () => {
      // Validate employee status
      const { data: empData } = await supabase
        .from("employees")
        .select("is_active, termination_date")
        .eq("id", selectedEmployeeId)
        .maybeSingle();
      
      if (empData) {
        if (empData.is_active === false) {
          throw new Error("Não é possível realizar troca para funcionário inativo.");
        }
        if (empData.termination_date) {
          const today = new Date().toISOString().split("T")[0];
          if (today > empData.termination_date) {
            throw new Error(`Funcionário desligado em ${empData.termination_date}. Não é possível realizar troca.`);
          }
        }
      }

      for (const sel of selections) {
        // 1. Return old item (full or partial)
        if (sel.exchange_qty >= sel.original_qty) {
          await supabase.from("epi_deliveries").update({
            status: "returned" as const,
            return_date: exchangeDate,
            notes: `[Troca] ${reason || "Troca de EPI"}`,
          }).eq("id", sel.delivery_id);
        } else {
          // Partial: reduce original qty
          await supabase.from("epi_deliveries").update({
            quantity: sel.original_qty - sel.exchange_qty,
          }).eq("id", sel.delivery_id);
          // Insert returned record for partial qty
          const { data: orig } = await supabase.from("epi_deliveries").select("*").eq("id", sel.delivery_id).single();
          if (orig) {
            await supabase.from("epi_deliveries").insert({
              organization_id: organization!.id,
              epi_id: sel.epi_id,
              employee_id: orig.employee_id,
              employee_record_id: orig.employee_record_id,
              delivered_by: orig.delivered_by,
              quantity: sel.exchange_qty,
              delivery_date: orig.delivery_date,
              reason: orig.reason,
              notes: `[Troca] ${reason || "Troca de EPI"}`,
              status: "returned" as const,
              return_date: exchangeDate,
              expiration_date: orig.expiration_date,
            });
          }
        }

        // 2. Restock returned item (used stock) — per CNPJ
        const empCnpjId = selectedEmployee?.organization_cnpj_id;
        if (empCnpjId) {
          await creditUsedStock(sel.epi_id, empCnpjId, organization!.id, sel.exchange_qty);
        }

        // 3. Create new delivery with recalculated expiration
        const validityMonths = getValidityMonths(sel.epi_id);
        const newExpDate = calculateExpirationDate(exchangeDate, validityMonths, sel.ca_expiration);

        if (!newExpDate) {
          throw new Error(`Não foi possível calcular a data de vencimento para "${sel.epi_name}". Verifique a validade na matriz Setor/Função ou o CA do EPI.`);
        }

        // Fetch current average_cost to store as unit_cost
        const { data: epiCostData } = await supabase.from("epis").select("average_cost").eq("id", sel.epi_id).single();

        await supabase.from("epi_deliveries").insert({
          organization_id: organization!.id,
          epi_id: sel.epi_id,
          employee_id: profile!.id,
          employee_record_id: selectedEmployeeId,
          delivered_by: profile!.id,
          quantity: sel.new_qty,
          delivery_date: withBrasiliaOffset(`${exchangeDate}T${toDatetimeLocalValue(nowBrasilia()).split("T")[1]}`),
          reason: reason || "Troca de EPI",
          notes: `[Troca] Substituição de EPI`,
          status: "delivered" as const,
          expiration_date: newExpDate,
          unit_cost: epiCostData?.average_cost ?? null,
        } as any);

        // 4. Debit stock for new item (using new_qty) — per CNPJ
        if (empCnpjId) {
          await debitCnpjStock(sel.epi_id, empCnpjId, organization!.id, sel.new_qty, "new");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["employee-delivered-epis"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-history"] });
      setLastExchangeData({
        employee: selectedEmployee!,
        items: [...selections],
        date: exchangeDate,
      });
      setExchangeComplete(true);
      setSelections([]);
      toast.success("Troca de EPI registrada com sucesso!");
    },
    onError: () => toast.error("Erro ao registrar troca de EPI"),
  });

  const handleSubmit = async () => {
    if (!selections.length) { toast.error("Selecione ao menos um EPI para troca."); return; }
    // Validate termination date
    if (selectedEmployee?.termination_date && exchangeDate > selectedEmployee.termination_date) {
      toast.error(`Funcionário desligado em ${format(parseLocalDate(selectedEmployee.termination_date), "dd/MM/yyyy")}. Não é possível registrar troca após o desligamento.`);
      return;
    }
    setIsSubmitting(true);
    try { await exchangeMutation.mutateAsync(); } finally { setIsSubmitting(false); }
  };

  const generateExchangePDF = useCallback(async (data: { employee: EmployeeOption; items: ExchangeSelection[]; date: string }, signatureDataUrl?: string): Promise<jsPDF | void> => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;

      // Fetch company name and logo from employee's CNPJ
      let companyName = organization?.name || "Empresa";
      let cnpjLogoUrl: string | null = null;
      if (data.employee.organization_cnpj_id) {
        const { data: cnpjData } = await supabase
          .from("organization_cnpjs")
          .select("company_name, logo_url")
          .eq("id", data.employee.organization_cnpj_id)
          .maybeSingle();
        if (cnpjData?.company_name) companyName = cnpjData.company_name;
        if (cnpjData?.logo_url) cnpjLogoUrl = cnpjData.logo_url;
      }

      // Logo - prefer CNPJ logo, fallback to org logo
      const logoSrc = cnpjLogoUrl || organization?.logo_url;
      if (logoSrc) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); img.src = logoSrc; });
          const canvas = document.createElement("canvas");
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          const imgData = canvas.toDataURL("image/png");
          const logoH = 18; const logoW = (img.width / img.height) * logoH;
          doc.addImage(imgData, "PNG", 14, y, logoW, logoH);
        } catch { /* skip */ }
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(companyName, pageWidth / 2, y + 10, { align: "center" });
      y += 25;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("FICHA DE TROCA DE EPI", pageWidth / 2, y, { align: "center" });
      y += 3;
      doc.setLineWidth(0.5);
      doc.line(14, y, pageWidth - 14, y);
      y += 8;

      // Employee info
      let sectorName = "—";
      let functionName = "—";
      if (data.employee.sector_id) {
        const { data: sec } = await supabase.from("sectors").select("name").eq("id", data.employee.sector_id).maybeSingle();
        if (sec) sectorName = sec.name;
      }
      if (data.employee.job_function_id) {
        const { data: fn } = await supabase.from("job_functions").select("name").eq("id", data.employee.job_function_id).maybeSingle();
        if (fn) functionName = fn.name;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const lineH = 6;
      const drawField = (label: string, value: string, x: number, row: number) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}: `, x, y + row * lineH);
        const labelW = doc.getTextWidth(`${label}: `);
        doc.setFont("helvetica", "normal");
        doc.text(value, x + labelW, y + row * lineH);
      };

      drawField("Nome", data.employee.name, 14, 0);
      drawField("Função", functionName, pageWidth / 2 + 5, 0);
      drawField("Setor", sectorName, 14, 1);
      drawField("Data da Troca", format(parseLocalDate(data.date), "dd/MM/yyyy"), pageWidth / 2 + 5, 1);
      y += lineH * 2 + 6;

      // Table
      const tableData = data.items.map((item, idx) => {
        const validityMonths = getValidityMonths(item.epi_id);
        const newExpDate = calculateExpirationDate(data.date, validityMonths, item.ca_expiration);
        return [
          String(idx + 1),
          item.epi_name,
          item.ca_number || "—",
          String(item.exchange_qty),
          String(item.new_qty),
          newExpDate ? format(parseLocalDate(newExpDate), "dd/MM/yyyy") : "—",
          "", // assinatura
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["#", "EPI", "C.A.", "Devolvido", "Recebido", "Nova Validade", "Assinatura"]],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2, minCellHeight: 14 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 10 }, 3: { cellWidth: 18, halign: "center" }, 4: { cellWidth: 18, halign: "center" }, 6: { cellWidth: 35 } },
        theme: "grid",
        margin: { left: 14, right: 14 },
        didDrawCell: (data2) => {
          if (signatureDataUrl && data2.section === 'body' && data2.column.index === 6) {
            const padding = 2;
            const cellW = data2.cell.width - padding * 2;
            const cellH = data2.cell.height - padding * 2;
            const imgRatio = 60 / 25;
            let imgW = cellW;
            let imgH = imgW / imgRatio;
            if (imgH > cellH) { imgH = cellH; imgW = imgH * imgRatio; }
            const x = data2.cell.x + (data2.cell.width - imgW) / 2;
            const sigY = data2.cell.y + (data2.cell.height - imgH) / 2;
            doc.addImage(signatureDataUrl, "PNG", x, sigY, imgW, imgH);
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 12;

      // Term
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("TERMO DE RESPONSABILIDADE – TROCA DE EPI", pageWidth / 2, y, { align: "center" });
      y += 6;
      doc.setFont("helvetica", "normal");
      const termoText = organization?.epi_term_text ||
        "Declaro ter recebido gratuitamente os Equipamentos de Proteção Individual (EPIs) acima descritos em substituição aos anteriormente entregues, " +
        "comprometendo-me a: usá-los apenas para a finalidade a que se destinam; responsabilizar-me pela guarda e " +
        "conservação dos mesmos; comunicar ao empregador qualquer alteração que os torne impróprios para uso; " +
        "devolvê-los ao empregador quando solicitado ou ao final do contrato de trabalho.";
      const splitText = doc.splitTextToSize(termoText, pageWidth - 28);
      doc.text(splitText, 14, y);
      y += splitText.length * 4 + 14;

      const city = organization?.city || "Local";
      const dateStr = format(parseLocalDate(data.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      doc.setFontSize(9);
      doc.text(`${city}, ${dateStr}`, pageWidth / 2, y, { align: "center" });
      y += 20;

      // Signature line or digital signature
      if (signatureDataUrl) {
        const sigImgW = 60;
        const sigImgH = 25;
        doc.addImage(signatureDataUrl, "PNG", (pageWidth - sigImgW) / 2, y - 10, sigImgW, sigImgH);
        y += 18;
      } else {
        doc.setLineWidth(0.3);
        const sigW = 70;
        doc.line((pageWidth - sigW) / 2, y, (pageWidth + sigW) / 2, y);
        y += 5;
      }
      doc.setFontSize(8);
      doc.text(data.employee.name, pageWidth / 2, y, { align: "center" });
      y += 4;
      doc.text("Assinatura do Funcionário", pageWidth / 2, y, { align: "center" });

      if (signatureDataUrl) {
        return doc;
      }
      doc.save(`Troca_EPI_${data.employee.name.replace(/\s+/g, "_")}_${data.date}.pdf`);
      toast.success("PDF de troca gerado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar o PDF.");
    }
  }, [organization, getValidityMonths, calculateExpirationDate]);

  const handleDigitalSignExchange = useCallback(async (data: { employee: EmployeeOption; items: ExchangeSelection[]; date: string }, signatureDataUrl: string, geo: import("@/lib/geo").CapturedGeo) => {
    try {
      const doc = await generateExchangePDF(data, signatureDataUrl);
      if (!doc || !organization?.id || !profile?.id) throw new Error("Erro ao gerar PDF");
      const { sealSignedTerm } = await import("@/lib/signedTerms");
      await sealSignedTerm({
        doc,
        employeeRecordId: data.employee.id,
        deliveryDate: data.date,
        geo,
      });
      toast.success("Termo de troca assinado, selado e arquivado com segurança!");
      queryClient.invalidateQueries({ queryKey: ["epi-signed-terms"] });
    } catch (err) {
      console.error("Erro na assinatura digital:", err);
      toast.error("Erro ao processar assinatura digital.");
      throw err;
    }
  }, [generateExchangePDF, organization, profile, queryClient]);

  if (!canManage) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground">Troca de EPI</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Troca de EPI</h1>
        <p className="text-muted-foreground">Registre a troca de EPIs de funcionários</p>
      </div>

      {/* Step 1: Select employee */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Selecionar Funcionário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="w-[350px]">
              <Label>Funcionário</Label>
              <Popover open={employeeComboOpen} onOpenChange={(open) => { setEmployeeComboOpen(open); if (!open) setEmployeeSearch(""); }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {selectedEmployee?.name || "Selecione um funcionário..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0 pointer-events-auto">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Buscar funcionário..." value={employeeSearch} onValueChange={setEmployeeSearch} />
                    <CommandList>
                      <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                      <CommandGroup>
                        {(employees || []).filter((emp) => {
                          if (!employeeSearch.trim()) return true;
                          const term = employeeSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                          return emp.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(term);
                        }).map((emp) => (
                          <CommandItem key={emp.id} value={emp.name} onSelect={() => handleSelectEmployee(emp.id)}>
                            <Check className={cn("mr-2 h-4 w-4", selectedEmployeeId === emp.id ? "opacity-100" : "opacity-0")} />
                            {emp.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-[200px]">
              <Label>Data da Troca</Label>
              <div className="flex gap-1">
                <Input
                  type="date"
                  value={exchangeDate}
                  onChange={(e) => setExchangeDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Motivo / Observações</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo da troca (ex: desgaste, dano, vencimento...)"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2: EPIs in hand */}
      {selectedEmployeeId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. EPIs em Mãos do Funcionário</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingItems ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando EPIs...</span>
              </div>
            ) : !deliveredItems?.length ? (
              <p className="text-muted-foreground py-4">Este funcionário não possui EPIs em mãos.</p>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Trocar</TableHead>
                    <SortableTableHead field="epi_name" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>EPI</SortableTableHead>
                    <SortableTableHead field="ca_number" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>C.A.</SortableTableHead>
                    <SortableTableHead field="quantity" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort} className="w-20">Em mãos</SortableTableHead>
                    <TableHead className="w-24">Qtd devolver</TableHead>
                    <TableHead className="w-24">Qtd nova</TableHead>
                    <SortableTableHead field="delivery_date" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>Data Entrega</SortableTableHead>
                    <SortableTableHead field="expiration_date" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>Validade Atual</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delPag.paginatedItems.map((item) => {
                    const sel = selections.find((s) => s.delivery_id === item.id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={!!sel}
                            onCheckedChange={() => toggleSelection(item)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.epi_name}</TableCell>
                        <TableCell>{item.ca_number || "—"}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          {sel ? (
                            <Input
                              type="number"
                              min={1}
                              max={item.quantity}
                              value={sel.exchange_qty}
                              onChange={(e) => updateExchangeQty(item.id, parseInt(e.target.value) || 1)}
                              className="w-20 h-8"
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {sel ? (
                            <Input
                              type="number"
                              min={1}
                              value={sel.new_qty}
                              onChange={(e) => updateNewQty(item.id, parseInt(e.target.value) || 1)}
                              className="w-20 h-8"
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{formatBrasiliaDateTime(item.delivery_date)}</TableCell>
                        <TableCell>
                          {item.expiration_date ? format(parseLocalDate(item.expiration_date), "dd/MM/yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={delPag.currentPage}
                totalPages={delPag.totalPages}
                totalItems={delPag.totalItems}
                pageSize={delPag.pageSize}
                onPageChange={delPag.setCurrentPage}
                onPageSizeChange={delPag.setPageSize}
              />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {selections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Confirmar Troca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p><strong>{selections.length}</strong> item(ns) selecionado(s) para troca.</p>
              <p>Ao confirmar, os EPIs antigos serão devolvidos e novos serão entregues com validade recalculada.</p>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EPI</TableHead>
                    <TableHead className="w-24">Devolvendo</TableHead>
                    <TableHead className="w-24">Recebendo</TableHead>
                    <TableHead>Nova Validade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selections.map((sel) => {
                    const validityMonths = getValidityMonths(sel.epi_id);
                    const newExpDate = calculateExpirationDate(exchangeDate, validityMonths, sel.ca_expiration);
                    return (
                      <TableRow key={sel.delivery_id}>
                        <TableCell>{sel.epi_name}</TableCell>
                        <TableCell>{sel.exchange_qty}</TableCell>
                        <TableCell>{sel.new_qty}</TableCell>
                        <TableCell>{newExpDate ? format(parseLocalDate(newExpDate), "dd/MM/yyyy") : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Confirmar Troca
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Print term */}
      {exchangeComplete && lastExchangeData && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg text-primary">✅ Troca Registrada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              A troca foi registrada com sucesso. Você pode imprimir o termo de troca para assinatura ou fazer upload do termo assinado.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => generateExchangePDF(lastExchangeData)}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir Termo de Troca
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !lastExchangeData || !organization?.id || !profile?.id) return;
                  setUploadingTerm(true);
                  try {
                    const ext = file.name.split(".").pop();
                    const filePath = `${organization.id}/${lastExchangeData.employee.id}/${Date.now()}.${ext}`;
                    const { error: uploadError } = await supabase.storage
                      .from("signed-terms")
                      .upload(filePath, file);
                    if (uploadError) throw uploadError;

                    const { data: urlData } = supabase.storage
                      .from("signed-terms")
                      .getPublicUrl(filePath);

                    const { error: insertError } = await supabase
                      .from("epi_signed_terms")
                      .insert({
                        organization_id: organization.id,
                        employee_record_id: lastExchangeData.employee.id,
                        delivery_date: lastExchangeData.date,
                        file_name: file.name,
                        file_url: urlData.publicUrl,
                        uploaded_by: profile.id,
                      });
                    if (insertError) throw insertError;

                    toast.success("Termo assinado enviado com sucesso!");
                    queryClient.invalidateQueries({ queryKey: ["epi-signed-terms"] });
                  } catch (err) {
                    console.error("Erro ao enviar termo:", err);
                    toast.error("Erro ao enviar o termo assinado.");
                  } finally {
                    setUploadingTerm(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
              />
              {existingSignedTermExchange ? (
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
                          await openSignedTerm(existingSignedTermExchange.file_url);
                        } catch (e) {
                          console.error(e);
                          toast.error("Erro ao abrir o arquivo.");
                        }
                      }}
                   >
                     Visualizar
                   </button>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingTerm}
                  >
                    {uploadingTerm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Upload Termo Assinado
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSignatureDialogOpen(true)}
                  >
                    <PenLine className="mr-2 h-4 w-4" /> Assinar Digitalmente
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedEmployeeId("");
                  setSelections([]);
                  setExchangeDate(format(new Date(), "yyyy-MM-dd"));
                  setReason("");
                  setExchangeComplete(false);
                  setLastExchangeData(null);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Nova Troca
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Digital Signature Dialog */}
      {lastExchangeData && (
        <SignatureDialog
          open={signatureDialogOpen}
          onOpenChange={setSignatureDialogOpen}
          title="Assinatura Digital - Termo de Troca de EPI"
          employeeName={lastExchangeData.employee.name}
          summary={
            <div>
              <p><strong>Funcionário:</strong> {lastExchangeData.employee.name}</p>
              <p><strong>Data da Troca:</strong> {format(parseLocalDate(lastExchangeData.date), "dd/MM/yyyy")}</p>
              <p><strong>Itens:</strong> {lastExchangeData.items.length} EPI(s)</p>
            </div>
          }
          onConfirm={async (sig, geo) => handleDigitalSignExchange(lastExchangeData, sig, geo)}
        />
      )}

      {/* Exchange History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Trocas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <Label>Funcionário</Label>
              <Popover open={histEmployeeComboOpen} onOpenChange={(open) => { setHistEmployeeComboOpen(open); if (!open) setHistEmployeeSearch(""); }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={histEmployeeComboOpen}
                    className="w-[250px] justify-between font-normal"
                  >
                    {histFilterEmployeeId === "all"
                      ? "Todos"
                      : employees?.find((e) => e.id === histFilterEmployeeId)?.name ?? "Todos"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Buscar por nome..." value={histEmployeeSearch} onValueChange={setHistEmployeeSearch} />
                    <CommandList>
                      <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setHistFilterEmployeeId("all");
                            setHistEmployeeComboOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", histFilterEmployeeId === "all" ? "opacity-100" : "opacity-0")} />
                          Todos
                        </CommandItem>
                        {(employees || []).filter((e) => {
                          if (!histEmployeeSearch.trim()) return true;
                          const term = histEmployeeSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                          return e.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(term);
                        }).map((e) => (
                          <CommandItem
                            key={e.id}
                            value={e.id}
                            onSelect={() => {
                              setHistFilterEmployeeId(e.id);
                              setHistEmployeeComboOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", histFilterEmployeeId === e.id ? "opacity-100" : "opacity-0")} />
                            {e.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {orgCnpjs && orgCnpjs.length > 1 && (
              <div>
                <Label>Empresa (CNPJ)</Label>
                <Select value={histFilterCnpjId} onValueChange={setHistFilterCnpjId}>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !histFilterDateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {histFilterDateFrom ? format(histFilterDateFrom, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={histFilterDateFrom} onSelect={setHistFilterDateFrom} locale={ptBR} captionLayout="dropdown-buttons" fromYear={2020} toYear={2030} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Data final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !histFilterDateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {histFilterDateTo ? format(histFilterDateTo, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={histFilterDateTo} onSelect={setHistFilterDateTo} locale={ptBR} captionLayout="dropdown-buttons" fromYear={2020} toYear={2030} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {(histFilterDateFrom || histFilterDateTo || histFilterEmployeeId !== "all" || histFilterCnpjId !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setHistFilterEmployeeId("all"); setHistFilterCnpjId("all"); setHistFilterDateFrom(undefined); setHistFilterDateTo(undefined); }}>
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Table */}
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando histórico...</span>
            </div>
          ) : !filteredHistory.length ? (
            <p className="text-muted-foreground py-4 text-center">Nenhuma troca registrada.</p>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead field="employee_name" sortField={histSortField} sortDirection={histSortDirection} onSort={histHandleSort}>Funcionário</SortableTableHead>
                      <SortableTableHead field="epi_name" sortField={histSortField} sortDirection={histSortDirection} onSort={histHandleSort}>EPI</SortableTableHead>
                      <SortableTableHead field="quantity" sortField={histSortField} sortDirection={histSortDirection} onSort={histHandleSort} className="w-16">Qtd</SortableTableHead>
                      <SortableTableHead field="delivery_date" sortField={histSortField} sortDirection={histSortDirection} onSort={histHandleSort}>Data Troca</SortableTableHead>
                      <SortableTableHead field="expiration_date" sortField={histSortField} sortDirection={histSortDirection} onSort={histHandleSort}>Nova Validade</SortableTableHead>
                      <SortableTableHead field="reason" sortField={histSortField} sortDirection={histSortDirection} onSort={histHandleSort}>Motivo</SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {histPag.paginatedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.employee_name}</TableCell>
                        <TableCell>{item.epi_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatBrasiliaDateTime(item.delivery_date)}</TableCell>
                        <TableCell>{item.expiration_date ? format(parseLocalDate(item.expiration_date), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.reason || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={histPag.currentPage}
                totalPages={histPag.totalPages}
                onPageChange={histPag.setCurrentPage}
                totalItems={filteredHistory.length}
                pageSize={histPag.pageSize}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
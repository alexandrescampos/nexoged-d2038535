import { useState, useRef, useMemo, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { formatBrasiliaDateTime, nowBrasilia, withBrasiliaOffset, toDatetimeLocalValue } from "@/lib/timezone";
import { addMonths, isAfter } from "date-fns";
import SignatureDialog from "@/components/SignatureDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateEpiTermoPDF } from "@/lib/epiTermo";
import * as XLSX from "xlsx";
import { formatCNPJ } from "@/lib/cnpj";
import { parseLocalDate } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { creditUsedStock } from "@/lib/stockOperations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Users, Eye, HardHat, AlertTriangle, PackageCheck, MoreHorizontal, RotateCcw, XCircle, FileText, ExternalLink, Trash2, Loader2, Upload, FolderOpen, Search, Download, X } from "lucide-react";
import EmployeeImport from "@/components/dashboard/EmployeeImport";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { useManagerCnpjs } from "@/hooks/useManagerCnpjs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";

interface Employee {
  id: string;
  organization_id: string;
  name: string;
  cpf: string | null;
  registration_number: string | null;
  ctps_number: string | null;
  admission_date: string | null;
  termination_date: string | null;
  sector_id: string | null;
  job_function_id: string | null;
  organization_cnpj_id: string | null;
  is_active: boolean;
  created_at: string;
  sectors?: { name: string } | null;
  job_functions?: { name: string } | null;
  organization_cnpjs?: { cnpj: string; company_name: string } | null;
}

interface EpiDeliveryDetail {
  id: string;
  epi_id: string;
  delivery_date: string;
  quantity: number;
  status: string;
  return_date: string | null;
  expiration_date: string | null;
  epis?: { name: string; ca_expiration: string | null } | null;
}

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const statusLabels: Record<string, string> = {
  awaiting_signature: "Pendente de Assinatura",
  delivered: "Entregue",
  returned: "Devolvido",
  lost: "Perdido",
  damaged: "Danificado",
  discarded: "Descartado",
  partial: "Parcial",
};

export default function Employees() {
  const { organization, profile, isOrgAdmin, isManager, isSuperAdmin } = useAuth();
  const { managerCnpjIds, managerSectorIds } = useManagerCnpjs();
  const canEdit = isOrgAdmin;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = usePersistedState("employees:dialogOpen", false);
  const [detailOpen, setDetailOpen] = usePersistedState("employees:detailOpen", false);
  const [selectedEmployee, setSelectedEmployee] = usePersistedState<Employee | null>("employees:selectedEmployee", null);
  const [editing, setEditing] = usePersistedState<Employee | null>("employees:editing", null);
  const [statusDialogOpen, setStatusDialogOpen] = usePersistedState("employees:statusDialogOpen", false);
  const [statusDialogData, setStatusDialogData] = usePersistedState<{ deliveryId: string; epiId: string; epiName: string; quantity: number; newStatus: string } | null>("employees:statusDialogData", null);
  const [statusNotes, setStatusNotes] = usePersistedState("employees:statusNotes", "");
  const [deleteTermData, setDeleteTermData] = useState<{ id: string; file_url: string; file_name: string } | null>(null);
  const [deletingTerm, setDeletingTerm] = useState(false);
  const [openingTermId, setOpeningTermId] = useState<string | null>(null);
  const [form, setForm] = usePersistedState("employees:form", { name: "", cpf: "", registration_number: "", ctps_number: "", admission_date: "", termination_date: "", sector_id: "", job_function_id: "", organization_cnpj_id: "", is_active: true, pants_size: "", shoe_size: "", shirt_size: "" });

  // Document upload state
  const [docDialogOpen, setDocDialogOpen] = usePersistedState("employees:docDialogOpen", false);
  const [docForm, setDocForm] = useState({ document_type: "Termo assinado", description: "", document_date: "" });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deleteDocData, setDeleteDocData] = useState<{ id: string; file_url: string; file_name: string } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  // Retroactive deliveries state
  const [retroPreviewOpen, setRetroPreviewOpen] = useState(false);
  const [retroSignatureOpen, setRetroSignatureOpen] = useState(false);
  const [retroPlan, setRetroPlan] = useState<Array<{ epi_id: string; epi_name: string; quantity: number; delivery_date: string; expiration_date: string | null; ca_expiration: string | null; average_cost: number | null }>>([]);
  const [retroSubmitting, setRetroSubmitting] = useState(false);
  const [retroCreatedGroup, setRetroCreatedGroup] = useState<{ employee_record_id: string; employee_name: string; delivery_date: string; items: Array<{ id: string; epi_id: string; quantity: number; delivery_date: string; expiration_date: string | null; status: string; reason: string | null }> } | null>(null);
  const [retroItemToRemove, setRetroItemToRemove] = useState<number | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, sectors(name), job_functions(name), organization_cnpjs(cnpj, company_name)")
        .eq("organization_id", organization!.id)
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!organization?.id,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCnpjId, setFilterCnpjId] = useState("all");
  const [filterSectorId, setFilterSectorId] = useState("all");
  const [filterFunctionId, setFilterFunctionId] = useState("all");

  const normalize = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    let result = [...employees];

    // Manager CNPJ filtering: only show employees from associated CNPJs
    if (managerCnpjIds !== null) {
      if (managerCnpjIds.length === 0) return [];
      result = result.filter(emp => emp.organization_cnpj_id && managerCnpjIds.includes(emp.organization_cnpj_id));
    }

    // Manager Sector filtering: if manager has sectors assigned, only show those
    if (managerSectorIds !== null) {
      result = result.filter(emp => emp.sector_id && managerSectorIds.includes(emp.sector_id));
    }

    if (filterCnpjId !== "all") {
      result = result.filter(emp => emp.organization_cnpj_id === filterCnpjId);
    }
    if (filterSectorId !== "all") {
      result = result.filter(emp => emp.sector_id === filterSectorId);
    }
    if (filterFunctionId !== "all") {
      result = result.filter(emp => emp.job_function_id === filterFunctionId);
    }
    if (!searchTerm.trim()) return result;
    const term = normalize(searchTerm);
    const termDigits = term.replace(/\D/g, "");
    const filtered = result.filter(emp => {
      const nameMatch = normalize(emp.name).includes(term);
      const cpfMatch = termDigits.length > 0 && emp.cpf
        ? emp.cpf.replace(/\D/g, "").includes(termDigits)
        : false;
      const regMatch = emp.registration_number
        ? normalize(emp.registration_number).includes(term)
        : false;
      return nameMatch || cpfMatch || regMatch;
    });
    return filtered;
  }, [employees, searchTerm, filterCnpjId, filterSectorId, filterFunctionId, managerCnpjIds, managerSectorIds, isOrgAdmin, isSuperAdmin]);

  const { sortedItems: sortedEmployees, sortField, sortDirection, handleSort } = useTableSort(filteredEmployees);
  const empPag = usePagination(sortedEmployees);

  // Reset pagination when search or filter changes
  useEffect(() => {
    empPag.resetPage();
  }, [searchTerm, filterCnpjId, filterSectorId, filterFunctionId]);

  // Query for filter dropdown job functions (independent of form)
  const { data: filterJobFunctions } = useQuery({
    queryKey: ["filter-job-functions", organization?.id, filterSectorId],
    queryFn: async () => {
      let query = supabase.from("job_functions").select("id, name")
        .eq("organization_id", organization!.id).eq("is_active", true).order("name");
      if (filterSectorId !== "all") query = query.eq("sector_id", filterSectorId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const hasActiveFilters = filterCnpjId !== "all" || filterSectorId !== "all" || filterFunctionId !== "all" || searchTerm.trim() !== "";

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCnpjId("all");
    setFilterSectorId("all");
    setFilterFunctionId("all");
  };

  const handleFilterSectorChange = (value: string) => {
    setFilterSectorId(value);
    setFilterFunctionId("all");
  };

  const exportToExcel = () => {
    const rows = sortedEmployees.map(emp => ({
      "Nome": emp.name,
      "Empresa": emp.organization_cnpjs?.company_name || "",
      "CPF": emp.cpf ? formatCpf(emp.cpf) : "",
      "Setor": emp.sectors?.name || "",
      "Função": emp.job_functions?.name || "",
      "Admissão": emp.admission_date ? format(parseLocalDate(emp.admission_date), "dd/MM/yyyy") : "",
      "Desligamento": (emp as any).termination_date ? format(parseLocalDate((emp as any).termination_date), "dd/MM/yyyy") : "",
      "Status": emp.is_active ? "Ativo" : "Inativo",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários");
    XLSX.writeFile(wb, "funcionarios.xlsx");
    toast.success(`${rows.length} funcionário(s) exportado(s)!`);
  };

  const { data: sectors } = useQuery({
    queryKey: ["sectors-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors").select("id, name")
        .eq("organization_id", organization!.id).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: jobFunctions } = useQuery({
    queryKey: ["job-functions-active", organization?.id, form.sector_id],
    queryFn: async () => {
      let query = supabase.from("job_functions").select("id, name")
        .eq("organization_id", organization!.id).eq("is_active", true).order("name");
      if (form.sector_id) query = query.eq("sector_id", form.sector_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
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

  const { data: employeeDeliveries } = useQuery({
    queryKey: ["employee-deliveries", selectedEmployee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_deliveries")
        .select("id, epi_id, delivery_date, quantity, status, return_date, expiration_date, epis(name, ca_expiration)")
        .eq("employee_record_id", selectedEmployee!.id)
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return data as EpiDeliveryDetail[];
    },
    enabled: !!selectedEmployee?.id && detailOpen,
  });

  const { sortedItems: sortedDeliveries, sortField: delSortField, sortDirection: delSortDirection, handleSort: delHandleSort } = useTableSort(employeeDeliveries || []);
  const delPag = usePagination(sortedDeliveries);

  // Matrix EPIs for the selected employee's sector+function
  const { data: matrixEpis } = useQuery({
    queryKey: ["matrix-epis-for-employee", organization?.id, selectedEmployee?.sector_id, selectedEmployee?.job_function_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sector_function_epis")
        .select("epi_id, quantity, validity_months, epis(id, name, ca_expiration, average_cost)")
        .eq("organization_id", organization!.id)
        .eq("sector_id", selectedEmployee!.sector_id!)
        .eq("job_function_id", selectedEmployee!.job_function_id!);
      if (error) throw error;
      return data as Array<{ epi_id: string; quantity: number; validity_months: number; epis: { id: string; name: string; ca_expiration: string | null; average_cost: number | null } | null }>;
    },
    enabled: !!organization?.id && !!selectedEmployee?.sector_id && !!selectedEmployee?.job_function_id && detailOpen,
  });

  const { data: signedTerms } = useQuery({
    queryKey: ["signed-terms", selectedEmployee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_signed_terms" as any)
        .select("*")
        .eq("employee_record_id", selectedEmployee!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedEmployee?.id && detailOpen,
  });

  const { data: employeeDocuments } = useQuery({
    queryKey: ["employee-documents", selectedEmployee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents" as any)
        .select("*")
        .eq("employee_id", selectedEmployee!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedEmployee?.id && detailOpen,
  });

  const handleDocUpload = async () => {
    if (!docFile || !selectedEmployee || !organization || !profile) return;
    if (docFile.size > 10 * 1024 * 1024) {
      toast.error("Arquivo deve ter no máximo 10MB");
      return;
    }
    setUploadingDoc(true);
    try {
      const timestamp = Date.now();
      const filePath = `${organization.id}/${selectedEmployee.id}/${timestamp}_${docFile.name}`;
      const { error: uploadError } = await supabase.storage.from("employee-documents").upload(filePath, docFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("employee-documents").getPublicUrl(filePath);
      const { error: insertError } = await supabase.from("employee_documents" as any).insert({
        organization_id: organization.id,
        employee_id: selectedEmployee.id,
        file_name: docFile.name,
        file_url: urlData.publicUrl,
        description: docForm.description || null,
        document_type: docForm.document_type,
        document_date: docForm.document_date || null,
        uploaded_by: profile.id,
      } as any);
      if (insertError) throw insertError;
      queryClient.invalidateQueries({ queryKey: ["employee-documents", selectedEmployee.id] });
      toast.success("Documento enviado com sucesso!");
      setDocDialogOpen(false);
      setDocFile(null);
      setDocForm({ document_type: "Termo assinado", description: "", document_date: "" });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar documento.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ deliveryId, epiId, quantity, newStatus, notes }: { deliveryId: string; epiId: string; quantity: number; newStatus: string; notes?: string }) => {
      const updateData: any = {
        status: newStatus as "returned" | "lost" | "damaged" | "discarded",
        return_date: format(new Date(), "yyyy-MM-dd"),
      };
      if (notes) {
        updateData.notes = `[${statusLabels[newStatus]}] ${notes}`;
      }
      const { error } = await supabase.from("epi_deliveries").update(updateData).eq("id", deliveryId);
      if (error) throw error;

      if (newStatus === "returned" && selectedEmployee?.organization_cnpj_id) {
        await creditUsedStock(epiId, selectedEmployee.organization_cnpj_id, organization!.id, quantity);
      }
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ["employee-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      const msgs: Record<string, string> = { 
        returned: "Devolução registrada!", 
        lost: "EPI marcado como perdido!", 
        damaged: "EPI marcado como danificado!",
        discarded: "EPI descartado com sucesso!"
      };
      toast.success(msgs[newStatus] || "Status atualizado!");
      setStatusDialogOpen(false);
      setStatusDialogData(null);
      setStatusNotes("");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.termination_date && form.admission_date && form.termination_date <= form.admission_date) {
        throw new Error("Data de desligamento deve ser posterior à data de admissão.");
      }
      const payload = {
        name: form.name,
        cpf: form.cpf.replace(/\D/g, "") || null,
        registration_number: form.registration_number || null,
        ctps_number: form.ctps_number || null,
        admission_date: form.admission_date || null,
        termination_date: form.termination_date || null,
        sector_id: form.sector_id || null,
        job_function_id: form.job_function_id || null,
        organization_cnpj_id: form.organization_cnpj_id || null,
        is_active: form.is_active,
        pants_size: form.pants_size || null,
        shoe_size: form.shoe_size || null,
        shirt_size: form.shirt_size || null,
      };
      if (editing) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert({ ...payload, organization_id: organization!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(editing ? "Funcionário atualizado!" : "Funcionário cadastrado!");
      closeDialog();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar funcionário"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", cpf: "", registration_number: "", ctps_number: "", admission_date: "", termination_date: "", sector_id: "", job_function_id: "", organization_cnpj_id: "", is_active: true, pants_size: "", shoe_size: "", shirt_size: "" });
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      name: emp.name,
      cpf: emp.cpf ? formatCpf(emp.cpf) : "",
      registration_number: emp.registration_number || "",
      ctps_number: emp.ctps_number || "",
      admission_date: emp.admission_date || "",
      termination_date: emp.termination_date || "",
      sector_id: emp.sector_id || "",
      job_function_id: emp.job_function_id || "",
      organization_cnpj_id: emp.organization_cnpj_id || "",
      is_active: emp.is_active,
      pants_size: (emp as any).pants_size || "",
      shoe_size: (emp as any).shoe_size || "",
      shirt_size: (emp as any).shirt_size || "",
    });
    setDialogOpen(true);
  };

  const openDetail = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const today = new Date().toISOString().split("T")[0];
  const activeEpis = employeeDeliveries?.filter((d) => d.status === "delivered") || [];
  const expiredEpis = employeeDeliveries?.filter(
    (d) => d.status === "delivered" && d.epis?.ca_expiration && d.epis.ca_expiration < today
  ) || [];
  const lastDelivery = employeeDeliveries?.[0];

  const activeCount = employees?.filter(e => e.is_active).length ?? 0;
  const maxUsers = organization?.max_users ?? null;
  const isUnlimited = maxUsers === null || maxUsers >= 999999;
  const isLimitReached = !isUnlimited && activeCount >= maxUsers;
  const remainingSlots = isUnlimited ? Infinity : Math.max(0, (maxUsers ?? 0) - activeCount);

  // ============ Retroactive deliveries ============
  const canGenerateRetro = !!(
    selectedEmployee?.sector_id &&
    selectedEmployee?.job_function_id &&
    selectedEmployee?.admission_date &&
    matrixEpis &&
    matrixEpis.length > 0 &&
    canEdit
  );

  const retroLimitDate = selectedEmployee?.termination_date || today;

  const computeRetroPlan = () => {
    if (!selectedEmployee?.admission_date || !matrixEpis) return [];
    const limit = parseLocalDate(retroLimitDate);
    const admission = parseLocalDate(selectedEmployee.admission_date);
    if (isAfter(admission, limit)) return [];

    const plan: typeof retroPlan = [];
    for (const m of matrixEpis) {
      if (!m.epis) continue;
      let cur = admission;
      while (!isAfter(cur, limit)) {
        const calculated = addMonths(cur, m.validity_months);
        const ca = m.epis.ca_expiration ? parseLocalDate(m.epis.ca_expiration) : null;
        const expDate = ca && isAfter(calculated, ca)
          ? m.epis.ca_expiration
          : format(calculated, "yyyy-MM-dd");
        plan.push({
          epi_id: m.epi_id,
          epi_name: m.epis.name,
          quantity: m.quantity,
          delivery_date: format(cur, "yyyy-MM-dd"),
          expiration_date: expDate,
          ca_expiration: m.epis.ca_expiration,
          average_cost: m.epis.average_cost,
        });
        cur = addMonths(cur, m.validity_months);
      }
    }
    plan.sort((a, b) =>
      a.delivery_date === b.delivery_date
        ? a.epi_name.localeCompare(b.epi_name)
        : a.delivery_date.localeCompare(b.delivery_date)
    );
    return plan;
  };

  const handleOpenRetroPreview = () => {
    const plan = computeRetroPlan();
    if (plan.length === 0) {
      toast.info("Não há entregas a gerar para o período.");
      return;
    }
    setRetroPlan(plan);
    setRetroPreviewOpen(true);
  };

  const handleConfirmRetroDeliveries = async () => {
    if (!selectedEmployee || !organization?.id || !profile?.id || retroPlan.length === 0) return;
    setRetroSubmitting(true);
    try {
      const groupDate = withBrasiliaOffset(toDatetimeLocalValue(nowBrasilia()));
      const rows = retroPlan.map((p) => ({
        organization_id: organization.id,
        epi_id: p.epi_id,
        employee_id: profile.id,
        employee_record_id: selectedEmployee.id,
        delivered_by: profile.id,
        quantity: p.quantity,
        delivery_date: groupDate,
        reason: `Entrega retroativa referente a ${format(parseLocalDate(p.delivery_date), "dd/MM/yyyy")}`,
        notes: null,
        status: "awaiting_signature" as const,
        expiration_date: p.expiration_date,
        stock_source: "new",
        unit_cost: p.average_cost,
      }));

      const { data: inserted, error } = await supabase
        .from("epi_deliveries")
        .insert(rows as any)
        .select("id, epi_id, quantity, delivery_date, expiration_date, status, reason");
      if (error) throw error;

      toast.success(`${inserted?.length ?? 0} entrega(s) retroativa(s) criada(s).`);
      setRetroCreatedGroup({
        employee_record_id: selectedEmployee.id,
        employee_name: selectedEmployee.name,
        delivery_date: groupDate,
        items: (inserted || []).map((it: any) => ({
          id: it.id,
          epi_id: it.epi_id,
          quantity: it.quantity,
          delivery_date: it.delivery_date,
          expiration_date: it.expiration_date,
          status: it.status,
          reason: it.reason,
        })),
      });
      setRetroPreviewOpen(false);
      setRetroSignatureOpen(true);
      queryClient.invalidateQueries({ queryKey: ["employee-deliveries", selectedEmployee.id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao criar entregas retroativas.");
    } finally {
      setRetroSubmitting(false);
    }
  };

  const handleRetroSign = async (signatureDataUrl: string, geo: import("@/lib/geo").CapturedGeo) => {
    if (!retroCreatedGroup || !organization?.id || !profile?.id) return;
    try {
      const doc = await generateEpiTermoPDF(retroCreatedGroup, organization, signatureDataUrl);
      if (!doc) throw new Error("Erro ao gerar PDF");
      const { sealSignedTerm } = await import("@/lib/signedTerms");
      await sealSignedTerm({
        doc,
        employeeRecordId: retroCreatedGroup.employee_record_id!,
        deliveryDate: retroCreatedGroup.delivery_date,
        geo,
      });
      const ids = retroCreatedGroup.items.map((i) => i.id);
      const { error: stErr } = await supabase
        .from("epi_deliveries")
        .update({ status: "delivered" } as any)
        .in("id", ids);
      if (stErr) console.error(stErr);
      toast.success("Termo retroativo assinado, selado e arquivado com segurança!");
      setRetroSignatureOpen(false);
      setRetroCreatedGroup(null);
      setRetroPlan([]);
      queryClient.invalidateQueries({ queryKey: ["employee-deliveries", retroCreatedGroup.employee_record_id] });
      queryClient.invalidateQueries({ queryKey: ["signed-terms", retroCreatedGroup.employee_record_id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao assinar o termo retroativo.");
      throw err;
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Funcionários</h1>
            <p className="text-muted-foreground">Gerencie os funcionários da organização • Total: {filteredEmployees.length}</p>
          </div>
          {!isUnlimited && (
            <Badge variant={isLimitReached ? "destructive" : "secondary"} className="text-sm">
              {activeCount}/{maxUsers} funcionários
            </Badge>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <EmployeeImport
              onImportComplete={() => queryClient.invalidateQueries({ queryKey: ["employees"] })}
              currentCount={activeCount}
              maxUsers={maxUsers}
            />
            <Button onClick={openCreate} disabled={isLimitReached}>
              <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
            </Button>
          </div>
        )}
      </div>

      {isLimitReached && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Limite de funcionários atingido ({maxUsers}). Atualize seu plano para cadastrar mais funcionários.
        </div>
      )}

      <div className="flex gap-4 items-end flex-wrap">
        <div className="relative">
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome, CPF ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[280px]"
            />
          </div>
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
                {(managerCnpjIds !== null
                  ? orgCnpjs.filter(c => managerCnpjIds.includes(c.id))
                  : orgCnpjs
                ).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name} ({formatCNPJ(c.cnpj)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Setor</Label>
          <Select value={filterSectorId} onValueChange={handleFilterSectorChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {sectors?.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Função</Label>
          <Select value={filterFunctionId} onValueChange={setFilterFunctionId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {filterJobFunctions?.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
            <X className="mr-1 h-4 w-4" /> Limpar Filtros
          </Button>
        )}
        {sortedEmployees.length > 0 && (
          <Button variant="outline" size="icon" onClick={exportToExcel} title="Exportar para Excel" className="h-10 w-10">
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !employees?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum funcionário cadastrado</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                   <SortableTableHead field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Nome</SortableTableHead>
                   <SortableTableHead field="organization_cnpjs.company_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Empresa</SortableTableHead>
                   <SortableTableHead field="cpf" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>CPF</SortableTableHead>
                   <SortableTableHead field="sectors.name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Setor</SortableTableHead>
                   <SortableTableHead field="job_functions.name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Função</SortableTableHead>
                   <SortableTableHead field="admission_date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Admissão</SortableTableHead>
                   <SortableTableHead field="is_active" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                   <TableHead className="w-[100px]">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {empPag.paginatedItems.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                       {searchTerm.trim() ? "Nenhum funcionário encontrado para a busca." : "Nenhum funcionário cadastrado."}
                     </TableCell>
                   </TableRow>
                 ) : empPag.paginatedItems.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell className="text-sm">{emp.organization_cnpjs?.company_name || "—"}</TableCell>
                      <TableCell>{emp.cpf ? formatCpf(emp.cpf) : "—"}</TableCell>
                      <TableCell>{emp.sectors?.name || "—"}</TableCell>
                      <TableCell>{emp.job_functions?.name || "—"}</TableCell>
                      <TableCell>{emp.admission_date ? format(parseLocalDate(emp.admission_date), "dd/MM/yyyy") : "—"}</TableCell>
                     <TableCell>
                       <Badge variant={emp.is_active ? "default" : "secondary"}>
                         {emp.is_active ? "Ativo" : "Inativo"}
                       </Badge>
                     </TableCell>
                     <TableCell className="flex gap-1">
                       <Button variant="ghost" size="icon" onClick={() => openDetail(emp)} title="Ver detalhes">
                         <Eye className="h-4 w-4" />
                       </Button>
                       {canEdit && (
                         <Button variant="ghost" size="icon" onClick={() => openEdit(emp)} title="Editar">
                           <Pencil className="h-4 w-4" />
                         </Button>
                       )}
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
            </Table>
            <TablePagination currentPage={empPag.currentPage} totalPages={empPag.totalPages} totalItems={empPag.totalItems} pageSize={empPag.pageSize} onPageChange={empPag.setCurrentPage} onPageSizeChange={empPag.setPageSize} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })} placeholder="000.000.000-00" maxLength={14} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Matrícula</Label>
                <Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="Nº da matrícula" />
              </div>
              <div>
                <Label>Nº CTPS</Label>
                <Input value={form.ctps_number} onChange={(e) => setForm({ ...form, ctps_number: e.target.value })} placeholder="Nº da CTPS" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Admissão</Label>
                <Input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} />
              </div>
              <div>
                <Label>Data de Desligamento</Label>
                <Input type="date" value={form.termination_date} onChange={(e) => setForm({ ...form, termination_date: e.target.value })} min={form.admission_date || undefined} />
                {form.termination_date && form.admission_date && form.termination_date <= form.admission_date && (
                  <p className="text-xs text-destructive mt-1">Deve ser posterior à data de admissão</p>
                )}
              </div>
            </div>
            <div>
              <Label>Setor</Label>
              <Select value={form.sector_id} onValueChange={(v) => setForm({ ...form, sector_id: v, job_function_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {sectors?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Função</Label>
              <Select value={form.job_function_id} onValueChange={(v) => setForm({ ...form, job_function_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                <SelectContent>
                  {jobFunctions?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CNPJ / Empresa *</Label>
              <Select value={form.organization_cnpj_id} onValueChange={(v) => setForm({ ...form, organization_cnpj_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {orgCnpjs?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{formatCNPJ(c.cnpj)} - {c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Tam. Calça</Label>
                <Input value={form.pants_size} onChange={(e) => setForm({ ...form, pants_size: e.target.value })} placeholder="Ex: 42" />
              </div>
              <div>
                <Label>Tam. Calçado</Label>
                <Input value={form.shoe_size} onChange={(e) => setForm({ ...form, shoe_size: e.target.value })} placeholder="Ex: 40" />
              </div>
              <div>
                <Label>Tam. Camisa</Label>
                <Input value={form.shirt_size} onChange={(e) => setForm({ ...form, shirt_size: e.target.value })} placeholder="Ex: M" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || !form.organization_cnpj_id || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEmployee?.name}</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">CPF:</span> {selectedEmployee.cpf ? formatCpf(selectedEmployee.cpf) : "—"}</div>
                <div><span className="text-muted-foreground">Admissão:</span> {selectedEmployee.admission_date ? format(parseLocalDate(selectedEmployee.admission_date), "dd/MM/yyyy") : "—"}</div>
                <div><span className="text-muted-foreground">Setor:</span> {selectedEmployee.sectors?.name || "—"}</div>
                <div><span className="text-muted-foreground">Desligamento:</span> {selectedEmployee.termination_date ? format(parseLocalDate(selectedEmployee.termination_date), "dd/MM/yyyy") : "—"}</div>
                <div><span className="text-muted-foreground">Função:</span> {selectedEmployee.job_functions?.name || "—"}</div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                      <PackageCheck className="h-3 w-3" /> EPIs Ativos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-2xl font-bold">{activeEpis.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> CAs Vencidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-2xl font-bold text-destructive">{expiredEpis.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                      <HardHat className="h-3 w-3" /> Última Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-sm font-medium">
                      {lastDelivery ? formatBrasiliaDateTime(lastDelivery.delivery_date) : "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Signed Terms */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Termos Assinados
                </h3>
                {!signedTerms?.length ? (
                  <p className="text-sm text-muted-foreground">Nenhum termo assinado carregado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Data Entrega</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead className="w-[60px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signedTerms.map((term: any) => (
                        <TableRow key={term.id}>
                          <TableCell className="text-sm font-medium">{term.file_name}</TableCell>
                          <TableCell className="text-sm">{formatBrasiliaDateTime(term.delivery_date)}</TableCell>
                          <TableCell className="text-sm">{formatBrasiliaDateTime(term.created_at)}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={openingTermId === term.id}
                              onClick={async () => {
                                setOpeningTermId(term.id);
                                try {
                                  const { openSignedTerm } = await import("@/lib/signedTerms");
                                  await openSignedTerm(term.file_url, term.file_name);
                                } catch (e) {
                                  console.error(e);
                                  toast.error("Erro ao abrir o arquivo.");
                                } finally {
                                  setOpeningTermId(null);
                                }
                              }}
                              title="Abrir / Imprimir"
                            >
                              {openingTermId === term.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ExternalLink className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            {isOrgAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  title="Excluir termo"
                                  onClick={() => setDeleteTermData({ id: term.id, file_url: term.file_url, file_name: term.file_name })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Documents */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" /> Documentos
                  </h3>
                  {(isOrgAdmin || isManager) && (
                    <Button size="sm" variant="outline" onClick={() => { setDocForm({ document_type: "Termo assinado", description: "", document_date: "" }); setDocFile(null); setDocDialogOpen(true); }}>
                      <Upload className="mr-2 h-3 w-3" /> Enviar Documento
                    </Button>
                  )}
                </div>
                {!employeeDocuments?.length ? (
                  <p className="text-sm text-muted-foreground">Nenhum documento carregado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead className="w-[60px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeDocuments.map((doc: any) => (
                        <TableRow key={doc.id}>
                          <TableCell className="text-sm font-medium">{doc.file_name}</TableCell>
                          <TableCell className="text-sm">{doc.document_type}</TableCell>
                          <TableCell className="text-sm">{doc.document_date ? format(parseLocalDate(doc.document_date), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell className="text-sm">{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={openingDocId === doc.id}
                              onClick={async () => {
                                setOpeningDocId(doc.id);
                                try {
                                  const url = new URL(doc.file_url);
                                  const match = url.pathname.match(/\/employee-documents\/(.+)$/);
                                  if (!match) throw new Error("Caminho inválido");
                                  const filePath = decodeURIComponent(match[1]);
                                  const { data: blob, error } = await supabase.storage.from("employee-documents").download(filePath);
                                  if (error || !blob) throw error || new Error("Arquivo não encontrado");
                                   const blobUrl = URL.createObjectURL(blob);
                                   const link = document.createElement("a");
                                   link.href = blobUrl;
                                   link.target = "_blank";
                                   link.rel = "noopener noreferrer";
                                   if (doc.file_name) {
                                     link.download = doc.file_name;
                                   }
                                   document.body.appendChild(link);
                                   link.click();
                                   document.body.removeChild(link);
                                   setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                                } catch {
                                  toast.error("Erro ao abrir o arquivo.");
                                } finally {
                                  setOpeningDocId(null);
                                }
                              }}
                              title="Abrir"
                            >
                              {openingDocId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                            </Button>
                            {isOrgAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title="Excluir documento"
                                onClick={() => setDeleteDocData({ id: doc.id, file_url: doc.file_url, file_name: doc.file_name })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Delivery History */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h3 className="font-semibold">Histórico de EPIs</h3>
                  <div className="flex gap-2">
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                              if (!selectedEmployee || !employeeDeliveries?.length) return;
                              try {
                                const doc = new jsPDF();
                                const pageWidth = doc.internal.pageSize.getWidth();
                                let y = 15;

                                // Get organization/company info
                                let companyName = organization?.name || "Empresa";
                                let logoUrl = organization?.logo_url || null;

                                if (selectedEmployee.organization_cnpj_id) {
                                  const { data: cnpjData } = await supabase
                                    .from("organization_cnpjs")
                                    .select("company_name, logo_url")
                                    .eq("id", selectedEmployee.organization_cnpj_id)
                                    .maybeSingle();
                                  if (cnpjData?.company_name) companyName = cnpjData.company_name;
                                  if (cnpjData?.logo_url) logoUrl = cnpjData.logo_url;
                                }

                                // Fetch additional employee data (admission, ctps)
                                const { data: empExtra } = await supabase
                                  .from("employees")
                                  .select("admission_date, ctps_number")
                                  .eq("id", selectedEmployee.id)
                                  .maybeSingle();

                                // Add Logo
                                if (logoUrl) {
                                  try {
                                    const img = new Image();
                                    img.crossOrigin = "anonymous";
                                    await new Promise<void>((resolve, reject) => {
                                      img.onload = () => resolve();
                                      img.onerror = () => reject();
                                      img.src = logoUrl!;
                                    });
                                    const canvas = document.createElement("canvas");
                                    canvas.width = img.width;
                                    canvas.height = img.height;
                                    const ctx = canvas.getContext("2d");
                                    ctx?.drawImage(img, 0, 0);
                                    const imgData = canvas.toDataURL("image/png");
                                    const logoH = 18;
                                    const logoW = (img.width / img.height) * logoH;
                                    doc.addImage(imgData, "PNG", 14, y, logoW, logoH);
                                  } catch (e) { console.error("Logo error", e); }
                                }

                                doc.setFontSize(14);
                                doc.setFont("helvetica", "bold");
                                doc.text(companyName, pageWidth / 2, y + 10, { align: "center" });
                                y += 25;

                                doc.setFontSize(12);
                                doc.setFont("helvetica", "bold");
                                doc.text("FICHA CONSOLIDADA DE EPI", pageWidth / 2, y, { align: "center" });
                                y += 3;
                                doc.setLineWidth(0.5);
                                doc.line(14, y, pageWidth - 14, y);
                                y += 8;

                                doc.setFontSize(9);
                                doc.setFont("helvetica", "normal");
                                const infoLeft = 14;
                                const infoRight = pageWidth / 2 + 5;
                                const lineH = 6;
                                const drawField = (label: string, value: string, x: number, row: number) => {
                                  doc.setFont("helvetica", "bold");
                                  doc.text(`${label}: `, x, y + row * lineH);
                                  const labelW = doc.getTextWidth(`${label}: `);
                                  doc.setFont("helvetica", "normal");
                                  doc.text(value, x + labelW, y + row * lineH);
                                };

                                drawField("Nome", selectedEmployee.name, infoLeft, 0);
                                drawField("Função", selectedEmployee.job_functions?.name || "—", infoRight, 0);
                                drawField("Setor", selectedEmployee.sectors?.name || "—", infoLeft, 1);
                                drawField(
                                  "Data Admissão",
                                  empExtra?.admission_date ? format(parseLocalDate(empExtra.admission_date), "dd/MM/yyyy") : "—",
                                  infoRight,
                                  1
                                );
                                drawField("CPF", selectedEmployee.cpf ? formatCpf(selectedEmployee.cpf) : "—", infoLeft, 2);
                                drawField("CTPS", empExtra?.ctps_number || "—", infoRight, 2);

                                y += lineH * 3 + 6;

                              const tableData = employeeDeliveries
                                .filter(d => ["delivered", "awaiting_signature", "lost", "damaged", "discarded"].includes(d.status))
                                .map((d) => [
                                  d.epis?.name || "—",
                                  formatBrasiliaDateTime(d.delivery_date),
                                  String(d.quantity),
                                  statusLabels[d.status] || d.status,
                                  d.expiration_date ? format(parseLocalDate(d.expiration_date), "dd/MM/yyyy") : "—",
                                ]);

                              autoTable(doc, {
                                startY: y,
                                head: [["EPI", "Data Entrega", "Qtd", "Status", "Vencimento"]],
                                body: tableData,
                                styles: { fontSize: 8 },
                                headStyles: { fillColor: [60, 60, 60] },
                              });

                              doc.save(`Ficha_EPI_Consolidada_${selectedEmployee.name.replace(/\s+/g, "_")}.pdf`);
                              toast.success("Ficha consolidada gerada com sucesso!");
                            } catch (err) {
                              console.error(err);
                              toast.error("Erro ao gerar PDF consolidado.");
                            }
                          }}
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Download className="mr-2 h-4 w-4" /> Gerar Ficha Consolidada
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleOpenRetroPreview}
                          disabled={!canGenerateRetro}
                          title={
                            !selectedEmployee?.sector_id || !selectedEmployee?.job_function_id
                              ? "Funcionário precisa ter setor e função definidos"
                              : !selectedEmployee?.admission_date
                              ? "Funcionário precisa ter data de admissão"
                              : !matrixEpis || matrixEpis.length === 0
                              ? "Não há EPIs cadastrados na matriz para este setor/função"
                              : "Gerar entregas retroativas a partir da admissão"
                          }
                        >
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Gerar entregas retroativas
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {!employeeDeliveries?.length ? (
                  <p className="text-sm text-muted-foreground">Nenhuma entrega registrada para este funcionário.</p>
                ) : (
                  <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead field="epis.name" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>EPI</SortableTableHead>
                        <SortableTableHead field="delivery_date" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>Data</SortableTableHead>
                        <SortableTableHead field="quantity" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>Qtd</SortableTableHead>
                        <SortableTableHead field="status" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>Status</SortableTableHead>
                        <SortableTableHead field="expiration_date" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>Vencimento</SortableTableHead>
                        <SortableTableHead field="epis.ca_expiration" sortField={delSortField} sortDirection={delSortDirection} onSort={delHandleSort}>Validade CA</SortableTableHead>
                        <TableHead className="w-[60px]">Ações</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {delPag.paginatedItems.map((d) => (
                         <TableRow key={d.id}>
                           <TableCell className="font-medium">{d.epis?.name || "—"}</TableCell>
                           <TableCell>{formatBrasiliaDateTime(d.delivery_date)}</TableCell>
                           <TableCell>{d.quantity}</TableCell>
                            <TableCell>
                              <Badge
                                variant={d.status === "delivered" ? "default" : (d.status === "lost" || d.status === "damaged") ? "destructive" : (d.status === "awaiting_signature") ? "outline" : "secondary"}
                                className={d.status === "awaiting_signature" ? "bg-yellow-100 text-yellow-800 border-yellow-300" : ""}
                              >
                                {statusLabels[d.status] || d.status}
                              </Badge>
                             </TableCell>
                           <TableCell>
                             {d.expiration_date ? (
                               <span className={d.expiration_date < today ? "text-destructive font-medium" : ""}>
                                 {format(parseLocalDate(d.expiration_date), "dd/MM/yyyy")}
                               </span>
                             ) : "—"}
                           </TableCell>
                           <TableCell>
                             {d.epis?.ca_expiration ? (
                               <span className={d.epis.ca_expiration < today ? "text-destructive font-medium" : ""}>
                                 {format(parseLocalDate(d.epis.ca_expiration), "dd/MM/yyyy")}
                               </span>
                             ) : "—"}
                           </TableCell>
                           <TableCell>
                             {d.status === "delivered" && (
                               <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                   <Button variant="ghost" size="icon" className="h-7 w-7" disabled={updateStatusMutation.isPending}>
                                     <MoreHorizontal className="h-3.5 w-3.5" />
                                   </Button>
                                 </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ deliveryId: d.id, epiId: d.epi_id, quantity: d.quantity, newStatus: "returned" })}>
                                      <RotateCcw className="mr-2 h-4 w-4" /> Registrar Devolução
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setStatusDialogData({ deliveryId: d.id, epiId: d.epi_id, epiName: d.epis?.name || "—", quantity: d.quantity, newStatus: "lost" }); setStatusNotes(""); setStatusDialogOpen(true); }}>
                                      <AlertTriangle className="mr-2 h-4 w-4" /> Marcar como Perdido
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setStatusDialogData({ deliveryId: d.id, epiId: d.epi_id, epiName: d.epis?.name || "—", quantity: d.quantity, newStatus: "damaged" }); setStatusNotes(""); setStatusDialogOpen(true); }}>
                                      <XCircle className="mr-2 h-4 w-4" /> Marcar como Danificado
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setStatusDialogData({ deliveryId: d.id, epiId: d.epi_id, epiName: d.epis?.name || "—", quantity: d.quantity, newStatus: "discarded" }); setStatusNotes(""); setStatusDialogOpen(true); }}>
                                      <Trash2 className="mr-2 h-4 w-4" /> Descartar EPI
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                               </DropdownMenu>
                             )}
                           </TableCell>
                         </TableRow>
                       ))}
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Notes Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={(open) => { if (!open) { setStatusDialogOpen(false); setStatusDialogData(null); setStatusNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusDialogData?.newStatus === "lost" ? "Marcar como Perdido" : statusDialogData?.newStatus === "damaged" ? "Marcar como Danificado" : "Descartar EPI"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              EPI: <span className="font-medium text-foreground">{statusDialogData?.epiName}</span>
            </p>
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
            <Button variant="outline" onClick={() => { setStatusDialogOpen(false); setStatusDialogData(null); setStatusNotes(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (statusDialogData) {
                  updateStatusMutation.mutate({ ...statusDialogData, notes: statusNotes || undefined });
                }
              }}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Term Confirmation */}
      <AlertDialog open={!!deleteTermData} onOpenChange={(open) => { if (!open) setDeleteTermData(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir termo assinado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o arquivo <span className="font-medium">{deleteTermData?.file_name}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTerm}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingTerm}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteTermData) return;
                setDeletingTerm(true);
                try {
                  const url = new URL(deleteTermData.file_url);
                  const pathMatch = url.pathname.match(/\/signed-terms\/(.+)$/);
                  if (pathMatch) {
                    await supabase.storage.from("signed-terms").remove([decodeURIComponent(pathMatch[1])]);
                  }
                  const { error } = await supabase.from("epi_signed_terms" as any).delete().eq("id", deleteTermData.id);
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ["signed-terms", selectedEmployee?.id] });
                  toast.success("Termo excluído com sucesso!");
                  setDeleteTermData(null);
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao excluir o termo.");
                } finally {
                  setDeletingTerm(false);
                }
              }}
            >
              {deletingTerm ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Document Dialog */}
      <Dialog open={docDialogOpen} onOpenChange={(open) => { if (!open) { setDocDialogOpen(false); setDocFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Documento</DialogTitle>
            <DialogDescription>Faça upload de um documento para o funcionário {selectedEmployee?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Arquivo *</Label>
              <input
                ref={docFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setDocFile(file);
                }}
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => docFileRef.current?.click()}>
                  <Upload className="mr-2 h-3 w-3" /> Selecionar Arquivo
                </Button>
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">{docFile?.name || "Nenhum arquivo selecionado"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DOC (máx. 10MB)</p>
            </div>
            <div>
              <Label>Tipo de Documento *</Label>
              <Select value={docForm.document_type} onValueChange={(v) => setDocForm({ ...docForm, document_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Termo assinado">Termo assinado</SelectItem>
                  <SelectItem value="ASO">ASO</SelectItem>
                  <SelectItem value="Ficha de EPI">Ficha de EPI</SelectItem>
                  <SelectItem value="Contrato">Contrato</SelectItem>
                  <SelectItem value="Certificado">Certificado</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do Documento</Label>
              <Input type="date" value={docForm.document_date} onChange={(e) => setDocForm({ ...docForm, document_date: e.target.value })} />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={docForm.description} onChange={(e) => setDocForm({ ...docForm, description: e.target.value })} placeholder="Descrição do documento..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDocDialogOpen(false); setDocFile(null); }}>Cancelar</Button>
            <Button onClick={handleDocUpload} disabled={!docFile || uploadingDoc}>
              {uploadingDoc ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation */}
      <AlertDialog open={!!deleteDocData} onOpenChange={(open) => { if (!open) setDeleteDocData(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o arquivo <span className="font-medium">{deleteDocData?.file_name}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoc}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingDoc}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteDocData) return;
                setDeletingDoc(true);
                try {
                  const url = new URL(deleteDocData.file_url);
                  const pathMatch = url.pathname.match(/\/employee-documents\/(.+)$/);
                  if (pathMatch) {
                    await supabase.storage.from("employee-documents").remove([decodeURIComponent(pathMatch[1])]);
                  }
                  const { error } = await supabase.from("employee_documents" as any).delete().eq("id", deleteDocData.id);
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ["employee-documents", selectedEmployee?.id] });
                  toast.success("Documento excluído com sucesso!");
                  setDeleteDocData(null);
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao excluir o documento.");
                } finally {
                  setDeletingDoc(false);
                }
              }}
            >
              {deletingDoc ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Retroactive deliveries preview */}
      <Dialog open={retroPreviewOpen} onOpenChange={(v) => !retroSubmitting && setRetroPreviewOpen(v)}>
        <DialogContent className="max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              Pré-visualização de entregas retroativas
            </DialogTitle>
            <DialogDescription>
              Período: <strong>{selectedEmployee?.admission_date ? format(parseLocalDate(selectedEmployee.admission_date), "dd/MM/yyyy") : "—"}</strong>
              {" "}até{" "}
              <strong>
                {selectedEmployee?.termination_date
                  ? `${format(parseLocalDate(selectedEmployee.termination_date), "dd/MM/yyyy")} (desligamento)`
                  : "hoje"}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <strong>Atenção:</strong> esta ação criará{" "}
              <strong>{retroPlan.length}</strong> entrega(s) com status "Pendente de assinatura".
              Em seguida, será aberta a janela de assinatura digital para emitir um único termo
              consolidado. As entregas <strong>não debitam estoque</strong> (são históricas).
            </div>

            {(() => {
              // Ordena por delivery_date ASC e, em caso de empate, por epi_id ASC
              // Mantém o índice original em retroPlan para que a remoção continue correta
              const sortedRetroPlan = retroPlan
                .map((p, originalIdx) => ({ p, originalIdx }))
                .sort((a, b) => {
                  if (a.p.delivery_date !== b.p.delivery_date) {
                    return a.p.delivery_date < b.p.delivery_date ? -1 : 1;
                  }
                  if (a.p.epi_id !== b.p.epi_id) {
                    return a.p.epi_id < b.p.epi_id ? -1 : 1;
                  }
                  return a.originalIdx - b.originalIdx;
                });

              const totalEntregas = sortedRetroPlan.length;
              const totalQtd = sortedRetroPlan.reduce((sum, { p }) => sum + (Number(p.quantity) || 0), 0);
              const totalEpisDistintos = new Set(sortedRetroPlan.map(({ p }) => p.epi_id)).size;
              const totalCusto = sortedRetroPlan.reduce(
                (sum, { p }) => sum + (Number(p.average_cost) || 0) * (Number(p.quantity) || 0),
                0,
              );
              const primeira = sortedRetroPlan[0]?.p.delivery_date;
              const ultima = sortedRetroPlan[sortedRetroPlan.length - 1]?.p.delivery_date;

              return (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Entregas</div>
                      <div className="font-semibold">{totalEntregas}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">EPIs distintos</div>
                      <div className="font-semibold">{totalEpisDistintos}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Qtd total de itens</div>
                      <div className="font-semibold">{totalQtd}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Custo estimado</div>
                      <div className="font-semibold">
                        {totalCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    </div>
                    {primeira && ultima && (
                      <div className="col-span-2 md:col-span-4 text-xs text-muted-foreground">
                        Período coberto:{" "}
                        <strong>{format(parseLocalDate(primeira), "dd/MM/yyyy")}</strong>
                        {" "}até{" "}
                        <strong>{format(parseLocalDate(ultima), "dd/MM/yyyy")}</strong>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>EPI</TableHead>
                          <TableHead>Data de entrega</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right w-20">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedRetroPlan.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                              Nenhum EPI selecionado. Cancele e reabra para gerar novamente.
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedRetroPlan.map(({ p, originalIdx }) => (
                            <TableRow key={`${p.epi_id}-${originalIdx}`}>
                              <TableCell>{p.epi_name}</TableCell>
                              <TableCell>{format(parseLocalDate(p.delivery_date), "dd/MM/yyyy")}</TableCell>
                              <TableCell className="text-center">{p.quantity}</TableCell>
                              <TableCell>{p.expiration_date ? format(parseLocalDate(p.expiration_date), "dd/MM/yyyy") : "—"}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={retroSubmitting}
                                  onClick={() => setRetroItemToRemove(originalIdx)}
                                  title="Remover este EPI"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRetroPreviewOpen(false)} disabled={retroSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmRetroDeliveries} disabled={retroSubmitting || retroPlan.length === 0}>
              {retroSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>Confirmar e assinar agora</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={retroItemToRemove !== null} onOpenChange={(v) => !v && setRetroItemToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover EPI da lista?</AlertDialogTitle>
            <AlertDialogDescription>
              {retroItemToRemove !== null && retroPlan[retroItemToRemove] ? (
                <>
                  Remover <strong>{retroPlan[retroItemToRemove].epi_name}</strong> da entrega de{" "}
                  <strong>{format(parseLocalDate(retroPlan[retroItemToRemove].delivery_date), "dd/MM/yyyy")}</strong>?
                  <br />
                  Esta linha não será gerada no termo.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (retroItemToRemove !== null) {
                  setRetroPlan((prev) => prev.filter((_, i) => i !== retroItemToRemove));
                  setRetroItemToRemove(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SignatureDialog
        open={retroSignatureOpen}
        onOpenChange={(v) => {
          setRetroSignatureOpen(v);
          if (!v) {
            // se fechou sem assinar, manter as entregas como pendentes (já gravadas)
            setRetroCreatedGroup(null);
            setRetroPlan([]);
          }
        }}
        title="Assinatura Digital - Termo Retroativo de EPI"
        employeeName={retroCreatedGroup?.employee_name || selectedEmployee?.name || ""}
        summary={
          retroCreatedGroup ? (
            <p>
              Termo consolidado com <strong>{retroCreatedGroup.items.length}</strong> entrega(s)
              retroativa(s).
            </p>
          ) : null
        }
        onConfirm={handleRetroSign}
      />
    </div>
  );
}

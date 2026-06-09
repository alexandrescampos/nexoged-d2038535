import { useState, useRef, useCallback, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { nowBrasilia, formatBrasiliaDateTime } from "@/lib/timezone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { debitCnpjStock, getEmployeeCnpjId, getCnpjStockBatch } from "@/lib/stockOperations";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Eye, Check, X, FileText, Loader2, Trash2, Printer, Upload, ChevronsUpDown, Pencil, PenLine } from "lucide-react";
import SignatureDialog from "@/components/SignatureDialog";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateEpiTermoPDF, type TermoGroup } from "@/lib/epiTermo";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";

const statusLabels: Record<string, string> = {
  pending: "Pendente de Aprovação",
  awaiting_signature: "Pendente de Assinatura",
  approved: "Entregue",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  awaiting_signature: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const typeLabels: Record<string, string> = {
  new: "Novo EPI",
  exchange: "Troca",
};

interface RequestItem {
  epi_id: string;
  quantity: number;
  reason: string;
  delivery_id?: string;
}

export default function EpiRequests() {
  const { organization, profile, isOrgAdmin, isManager } = useAuth();
  const { managerCnpjIds, managerSectorIds } = useManagerCnpjs();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = usePersistedState("epi-requests:createOpen", false);
  const [editOpen, setEditOpen] = usePersistedState("epi-requests:editOpen", false);
  const [editingRequestId, setEditingRequestId] = usePersistedState<string | null>("epi-requests:editingRequestId", null);
  const [detailOpen, setDetailOpen] = usePersistedState("epi-requests:detailOpen", false);
  const [rejectOpen, setRejectOpen] = usePersistedState("epi-requests:rejectOpen", false);
  const [selectedRequest, setSelectedRequest] = usePersistedState<any>("epi-requests:selectedRequest", null);
  const [rejectionReason, setRejectionReason] = usePersistedState("epi-requests:rejectionReason", "");
  const [uploadingTerm, setUploadingTerm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = usePersistedState("epi-requests:signatureDialogOpen", false);
  const [approveOpen, setApproveOpen] = usePersistedState("epi-requests:approveOpen", false);
  const [approveStockSource, setApproveStockSource] = usePersistedState<"new" | "used">("epi-requests:approveStockSource", "new");
  const [approveItemSources, setApproveItemSources] = usePersistedState<Record<string, "new" | "used">>("epi-requests:approveItemSources", {});
  const [approveItemExpirations, setApproveItemExpirations] = useState<Record<string, string>>({});

  // Form state
  const [employeeId, setEmployeeId] = useState("");
  const [requestType, setRequestType] = useState<"new" | "exchange">("new");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<RequestItem[]>([{ epi_id: "", quantity: 1, reason: "" }]);

  // Fetch requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["epi-requests", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("epi_requests")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Fetch employees
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees-active", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, organization_cnpj_id, sector_id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Filter employees by manager CNPJs and sectors
  const employees = useMemo(() => {
    if (managerCnpjIds === null) return allEmployees;
    if (managerCnpjIds.length === 0) return [];
    let filtered = allEmployees.filter(e => e.organization_cnpj_id && managerCnpjIds.includes(e.organization_cnpj_id));
    if (managerSectorIds !== null) {
      filtered = filtered.filter(e => e.sector_id && managerSectorIds.includes(e.sector_id));
    }
    return filtered;
  }, [allEmployees, managerCnpjIds, managerSectorIds]);

  // Fetch EPIs
  const { data: epis = [] } = useQuery({
    queryKey: ["epis-active", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("epis")
        .select("id, name, stock_quantity")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Fetch request items for detail view
  const { data: requestItems = [] } = useQuery({
    queryKey: ["epi-request-items", selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest?.id) return [];
      const { data, error } = await supabase
        .from("epi_request_items")
        .select("*, epis:epi_id(name, ca_expiration)")
        .eq("request_id", selectedRequest.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRequest?.id,
  });

  // Fetch CNPJ stock for items in selected request (used in approve dialog)
  const { data: approveCnpjStockMap = {} } = useQuery({
    queryKey: ["approve-cnpj-stock", selectedRequest?.id, selectedRequest?.employee_id, requestItems.map((i: any) => i.epi_id).join(",")],
    queryFn: async () => {
      if (!selectedRequest?.employee_id || requestItems.length === 0) return {};
      const empCnpjId = await getEmployeeCnpjId(selectedRequest.employee_id);
      if (!empCnpjId) return {};
      return await getCnpjStockBatch(requestItems.map((i: any) => i.epi_id), empCnpjId);
    },
    enabled: !!selectedRequest?.id && requestItems.length > 0 && approveOpen,
  });

  // Check if a signed term already exists for the selected request
  const selectedDeliveryDate = selectedRequest?.responded_at || null;
  const { data: existingSignedTerm } = useQuery({
    queryKey: ["epi-signed-terms", selectedRequest?.employee_id, selectedDeliveryDate],
    queryFn: async () => {
      if (!orgId || !selectedRequest?.employee_id || !selectedDeliveryDate) return null;
      const { data, error } = await supabase
        .from("epi_signed_terms")
        .select("id, file_url")
        .eq("organization_id", orgId)
        .eq("employee_record_id", selectedRequest.employee_id)
        .eq("delivery_date", selectedDeliveryDate)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && !!selectedRequest?.employee_id && !!selectedDeliveryDate,
  });

  // Fetch employee deliveries for exchange
  const { data: employeeDeliveries = [] } = useQuery({
    queryKey: ["employee-deliveries", employeeId, requestType],
    queryFn: async () => {
      if (!employeeId || requestType !== "exchange") return [];
      const { data, error } = await supabase
        .from("epi_deliveries")
        .select("id, epi_id, delivery_date, epis:epi_id(name)")
        .eq("employee_record_id", employeeId)
        .eq("status", "delivered");
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && requestType === "exchange",
  });

  // Fetch profiles for names
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-map", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("organization_id", orgId);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name || "Usuário"]));
  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  // Create request mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || !profile?.id) throw new Error("Sem organização");
      const validItems = items.filter((i) => i.epi_id);
      if (!employeeId || validItems.length === 0) throw new Error("Preencha todos os campos");

      const { data: req, error: reqError } = await supabase
        .from("epi_requests")
        .insert({
          organization_id: orgId,
          employee_id: employeeId,
          request_type: requestType,
          requested_by: profile.id,
          notes: notes || null,
        })
        .select()
        .single();
      if (reqError) throw reqError;

      const itemsToInsert = validItems.map((i) => ({
        request_id: req.id,
        epi_id: i.epi_id,
        quantity: i.quantity,
        reason: i.reason || null,
        delivery_id: i.delivery_id || null,
      }));

      const { error: itemsError } = await supabase
        .from("epi_request_items")
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("Solicitação criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["epi-requests"] });
      resetForm();
      setCreateOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar solicitação"),
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ requestId, itemSources, itemExpirations }: { requestId: string; itemSources: Record<string, "new" | "used">; itemExpirations: Record<string, string> }) => {
      if (!profile?.id || !orgId) throw new Error("Sem dados");

      // Get request details
      const { data: req, error: reqErr } = await supabase
        .from("epi_requests")
        .select("*")
        .eq("id", requestId)
        .single();
      if (reqErr) throw reqErr;

      // Defensive scope check: scoped admins/managers must own this employee's CNPJ
      if (managerCnpjIds !== null && !visibleEmployeeIds.has(req.employee_id)) {
        throw new Error("Você não tem permissão sobre esta solicitação (fora dos seus CNPJs).");
      }

      // Validate employee status
      const { data: empData } = await supabase
        .from("employees")
        .select("is_active, termination_date")
        .eq("id", req.employee_id)
        .maybeSingle();

      if (empData) {
        if (empData.is_active === false) {
          throw new Error("Não é possível aprovar solicitação para funcionário inativo.");
        }
        if (empData.termination_date) {
          const today = new Date().toISOString().split("T")[0];
          if (today > empData.termination_date) {
            throw new Error(`Funcionário desligado em ${empData.termination_date}. Não é possível aprovar solicitação.`);
          }
        }
      }
      const { data: reqItems, error: itemsErr } = await supabase
        .from("epi_request_items")
        .select("*")
        .eq("request_id", requestId);
      if (itemsErr) throw itemsErr;

      // Validate every item has an expiration date — vencimento é obrigatório
      for (const item of reqItems || []) {
        const exp = itemExpirations[item.id];
        if (!exp) {
          throw new Error(`Informe a data de vencimento para todos os itens. O vencimento é obrigatório.`);
        }
      }

      // Persist per-item stock source and expiration_date
      for (const item of reqItems || []) {
        const src = itemSources[item.id] || "new";
        const { error: itemUpdErr } = await supabase
          .from("epi_request_items")
          .update({ stock_source: src, expiration_date: itemExpirations[item.id] } as any)
          .eq("id", item.id);
        if (itemUpdErr) throw itemUpdErr;
      }

      // Fallback stock_source on request = first item's source
      const fallbackSource = (reqItems && reqItems.length > 0)
        ? (itemSources[reqItems[0].id] || "new")
        : "new";

      // Update request status to awaiting_signature
      const { error: updateErr } = await supabase
        .from("epi_requests")
        .update({
          status: "awaiting_signature",
          responded_by: profile.id,
          responded_at: new Date().toISOString(),
          stock_source: fallbackSource,
        } as any)
        .eq("id", requestId);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      toast.success("Solicitação aprovada! Aguardando assinatura do termo.");
      queryClient.invalidateQueries({ queryKey: ["epi-requests"] });
      queryClient.invalidateQueries({ queryKey: ["epi-request-items"] });
      queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
      setApproveOpen(false);
      setDetailOpen(false);
      setApproveItemSources({});
    },
    onError: (err: any) => toast.error(err.message || "Erro ao aprovar"),
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      if (!profile?.id) throw new Error("Sem dados");
      if (managerCnpjIds !== null) {
        const { data: r } = await supabase
          .from("epi_requests")
          .select("employee_id")
          .eq("id", requestId)
          .maybeSingle();
        if (r && !visibleEmployeeIds.has(r.employee_id)) {
          throw new Error("Você não tem permissão sobre esta solicitação (fora dos seus CNPJs).");
        }
      }
      const { error } = await supabase
        .from("epi_requests")
        .update({
          status: "rejected",
          responded_by: profile.id,
          responded_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação rejeitada.");
      queryClient.invalidateQueries({ queryKey: ["epi-requests"] });
      setRejectOpen(false);
      setDetailOpen(false);
      setRejectionReason("");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao rejeitar"),
  });

  // Cancel mutation (manager)
  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("epi_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação cancelada.");
      queryClient.invalidateQueries({ queryKey: ["epi-requests"] });
      setDetailOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao cancelar"),
  });

  // Update mutation (edit pending request)
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingRequestId || !orgId) throw new Error("Sem dados");
      const validItems = items.filter((i) => i.epi_id);
      if (!employeeId || validItems.length === 0) throw new Error("Preencha todos os campos");

      // Update request
      const { error: updateErr } = await supabase
        .from("epi_requests")
        .update({
          employee_id: employeeId,
          request_type: requestType,
          notes: notes || null,
        })
        .eq("id", editingRequestId);
      if (updateErr) throw updateErr;

      // Delete old items
      const { error: delErr } = await supabase
        .from("epi_request_items")
        .delete()
        .eq("request_id", editingRequestId);
      if (delErr) throw delErr;

      // Insert new items
      const itemsToInsert = validItems.map((i) => ({
        request_id: editingRequestId,
        epi_id: i.epi_id,
        quantity: i.quantity,
        reason: i.reason || null,
        delivery_id: i.delivery_id || null,
      }));
      const { error: insertErr } = await supabase
        .from("epi_request_items")
        .insert(itemsToInsert);
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["epi-requests"] });
      queryClient.invalidateQueries({ queryKey: ["epi-request-items"] });
      resetForm();
      setEditOpen(false);
      setEditingRequestId(null);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar solicitação"),
  });

  const openEdit = async (request: any) => {
    setEmployeeId(request.employee_id);
    setRequestType(request.request_type as "new" | "exchange");
    setNotes(request.notes || "");
    setEditingRequestId(request.id);

    // Fetch existing items
    const { data: existingItems } = await supabase
      .from("epi_request_items")
      .select("*")
      .eq("request_id", request.id);

    if (existingItems && existingItems.length > 0) {
      setItems(existingItems.map((i) => ({
        epi_id: i.epi_id,
        quantity: i.quantity,
        reason: i.reason || "",
        delivery_id: i.delivery_id || undefined,
      })));
    } else {
      setItems([{ epi_id: "", quantity: 1, reason: "" }]);
    }

    setDetailOpen(false);
    setEditOpen(true);
  };

  const resetForm = () => {
    setEmployeeId("");
    setRequestType("new");
    setNotes("");
    setItems([{ epi_id: "", quantity: 1, reason: "" }]);
  };

  const addItem = () => setItems([...items, { epi_id: "", quantity: 1, reason: "" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof RequestItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  // Set of visible employee IDs for filtering requests
  const visibleEmployeeIds = useMemo(() => new Set(employees.map(e => e.id)), [employees]);

  const filteredRequests = useMemo(() => {
    let filtered = requests;
    // Filter by manager visibility
    if (managerCnpjIds !== null) {
      filtered = filtered.filter((r) => visibleEmployeeIds.has(r.employee_id));
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }
    return filtered;
  }, [requests, statusFilter, managerCnpjIds, visibleEmployeeIds, isOrgAdmin]);

  const { sortedItems: sortedRequests, sortField, sortDirection, handleSort } = useTableSort(filteredRequests);
  const { paginatedItems, currentPage, totalPages, setCurrentPage, totalItems, pageSize } = usePagination(sortedRequests, { pageSize: 10 });

  const openDetail = (req: any) => {
    setSelectedRequest(req);
    setDetailOpen(true);
  };

  const generateTermoPDF = useCallback(async (request: any, signatureDataUrl?: string): Promise<jsPDF | void> => {
    try {
      const { data: reqItems } = await supabase
        .from("epi_request_items")
        .select("id, epi_id, quantity, expiration_date")
        .eq("request_id", request.id);

      const deliveryDateIso = request.responded_at || new Date().toISOString();
      const employeeName = employeeMap[request.employee_id] || "—";

      const group: TermoGroup = {
        employee_record_id: request.employee_id,
        employee_name: employeeName,
        delivery_date: deliveryDateIso,
        items: (reqItems || []).map((item: any) => ({
          id: item.id,
          epi_id: item.epi_id,
          quantity: item.quantity,
          delivery_date: deliveryDateIso,
          expiration_date: item.expiration_date ?? null,
          status: "delivered",
        })),
      };

      const result = await generateEpiTermoPDF(group, organization, signatureDataUrl);
      if (signatureDataUrl) return result as jsPDF;
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar o PDF do termo.");
    }
  }, [organization, employeeMap]);

  const completeRequestDelivery = useCallback(async (request: any, fallbackSource: "new" | "used") => {
    if (!profile?.id || !orgId) throw new Error("Sem dados");

    const { data: reqItems, error: itemsErr } = await supabase
      .from("epi_request_items")
      .select("*")
      .eq("request_id", request.id);
    if (itemsErr) throw itemsErr;

    // For exchange: mark old deliveries as returned
    if (request.request_type === "exchange") {
      for (const item of reqItems) {
        if (item.delivery_id) {
          await supabase
            .from("epi_deliveries")
            .update({ status: "returned", return_date: new Date().toISOString().split("T")[0] })
            .eq("id", item.delivery_id);
        }
      }
    }

    const deliveryIds: string[] = [];
    const empCnpjId = await getEmployeeCnpjId(request.employee_id);

    // Create new deliveries
    for (const item of reqItems) {
      const itemSource = ((item as any).stock_source ?? fallbackSource) as "new" | "used";
      const { data: epiCostData } = await supabase.from("epis").select("average_cost").eq("id", item.epi_id).single();

      const { data: del, error: delErr } = await supabase.from("epi_deliveries").insert({
        organization_id: orgId,
        epi_id: item.epi_id,
        employee_id: profile.id, // User performing the delivery/signature
        employee_record_id: request.employee_id,
        delivered_by: profile.id,
        quantity: item.quantity,
        delivery_date: nowBrasilia(),
        reason: request.request_type === "exchange" ? "Troca via solicitação" : "Solicitação aprovada",
        unit_cost: epiCostData?.average_cost ?? null,
        status: "delivered",
        stock_source: itemSource,
        expiration_date: (item as any).expiration_date ?? null,
      } as any).select().single();

      if (delErr) throw delErr;
      deliveryIds.push(del.id);

      // Decrement stock from correct source
      if (empCnpjId) {
        await debitCnpjStock(item.epi_id, empCnpjId, orgId!, item.quantity, itemSource);
      }
    }

    // Update request status to approved/delivered
    const { error: statusErr } = await supabase
      .from("epi_requests")
      .update({ status: "approved" })
      .eq("id", request.id);
    if (statusErr) throw statusErr;

    return deliveryIds;
  }, [profile, orgId]);

  const handleDigitalSignRequest = useCallback(async (request: any, signatureDataUrl: string, geo: import("@/lib/geo").CapturedGeo) => {
    try {
      const doc = await generateTermoPDF(request, signatureDataUrl);
      if (!doc || !organization?.id || !profile?.id) throw new Error("Erro ao gerar PDF");
      
      // Complete delivery and stock update
      const deliveryIds = await completeRequestDelivery(request, (request.stock_source ?? "new") as "new" | "used");
      
      const deliveryDate = request.responded_at || new Date().toISOString();
      const { sealSignedTerm } = await import("@/lib/signedTerms");
      await sealSignedTerm({
        doc,
        employeeRecordId: request.employee_id,
        deliveryDate,
        geo,
        deliveryIds: deliveryIds, // Pass the new delivery IDs to link them to the term
      });

      queryClient.invalidateQueries({ queryKey: ["epi-requests"] });
      toast.success("Termo assinado, entregue e arquivado com segurança!");
      queryClient.invalidateQueries({ queryKey: ["epi-signed-terms"] });
      queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
    } catch (err) {
      console.error("Erro na assinatura digital:", err);
      toast.error("Erro ao processar assinatura digital.");
      throw err;
    }
  }, [generateTermoPDF, organization, profile, queryClient, completeRequestDelivery]);

  const handleUploadSignedTerm = useCallback(async (file: File, request: any) => {
    if (!organization?.id || !profile?.id) return;
    setUploadingTerm(true);
    try {
      // Complete delivery and stock update first
      const deliveryIds = await completeRequestDelivery(request, (request.stock_source ?? "new") as "new" | "used");

      const ext = file.name.split(".").pop() || "pdf";
      const filePath = `${organization.id}/${request.employee_id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("signed-terms")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("signed-terms")
        .getPublicUrl(filePath);

      const deliveryDate = request.responded_at || new Date().toISOString();

      const { data: insertedTerm, error: insertError } = await supabase
        .from("epi_signed_terms")
        .insert({
          organization_id: organization.id,
          employee_record_id: request.employee_id,
          delivery_date: deliveryDate,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: profile.id,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Link deliveries to the uploaded term
      if (deliveryIds.length > 0) {
        await supabase
          .from("epi_deliveries")
          .update({ signed_term_id: insertedTerm.id })
          .in("id", deliveryIds);
      }

      queryClient.invalidateQueries({ queryKey: ["epi-requests"] });
      queryClient.invalidateQueries({ queryKey: ["epi-deliveries"] });
      toast.success("Termo assinado enviado e entrega concluída!");
    } catch (err: any) {
      console.error("Erro ao enviar termo:", err);
      toast.error(err.message || "Erro ao enviar o termo assinado.");
    } finally {
      setUploadingTerm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [organization, profile, queryClient, completeRequestDelivery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de EPI</h1>
          <p className="text-sm text-muted-foreground">
            {isOrgAdmin
              ? "Gerencie as solicitações de EPI da organização"
              : "Solicite novos EPIs ou trocas para funcionários"}
            {" • Total: "}{filteredRequests.length}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Solicitação
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Label className="text-sm whitespace-nowrap">Filtrar por status:</Label>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente de Aprovação</SelectItem>
            <SelectItem value="awaiting_signature">Pendente de Assinatura</SelectItem>
            <SelectItem value="approved">Entregue</SelectItem>
            <SelectItem value="rejected">Rejeitada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>{statusFilter === "all" ? "Nenhuma solicitação encontrada" : "Nenhuma solicitação com este status"}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead field="created_at" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Data</SortableTableHead>
                    <SortableTableHead field="employee_id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Funcionário</SortableTableHead>
                    <SortableTableHead field="request_type" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Tipo</SortableTableHead>
                    <SortableTableHead field="requested_by" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Solicitado por</SortableTableHead>
                    <SortableTableHead field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>{format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>{employeeMap[req.employee_id] || "—"}</TableCell>
                      <TableCell>{typeLabels[req.request_type] || req.request_type}</TableCell>
                      <TableCell>{profileMap[req.requested_by] || "—"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[req.status] || ""}>
                          {statusLabels[req.status] || req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetail(req)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {req.status === "pending" && (isOrgAdmin || req.requested_by === profile?.id) && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(req)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de EPI</DialogTitle>
            <DialogDescription>Preencha os dados da solicitação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Funcionário *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {employeeId
                        ? employees.find((e) => e.id === employeeId)?.name ?? "Selecione"
                        : "Buscar funcionário..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        const emp = employees.find((e) => e.id === value);
                        if (!emp) return 0;
                        const normalize = (s: string) =>
                          s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                        return normalize(emp.name).includes(normalize(search)) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="Buscar por nome..." />
                      <CommandList>
                        <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                        {employees.map((e) => (
                          <CommandItem
                            key={e.id}
                            value={e.id}
                            onSelect={(val) => setEmployeeId(val)}
                          >
                            <Check className={`mr-2 h-4 w-4 ${employeeId === e.id ? "opacity-100" : "opacity-0"}`} />
                            {e.name}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={requestType} onValueChange={(v) => setRequestType(v as "new" | "exchange")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Novo EPI</SelectItem>
                    <SelectItem value="exchange">Troca de EPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações gerais..." />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens da Solicitação</Label>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar Item
                </Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-6 w-6">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">EPI *</Label>
                      <Select value={item.epi_id} onValueChange={(v) => updateItem(idx, "epi_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {epis.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name} (estoque: {e.stock_quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Motivo</Label>
                      <Input
                        value={item.reason}
                        onChange={(e) => updateItem(idx, "reason", e.target.value)}
                        placeholder="Ex: Desgaste"
                      />
                    </div>
                  </div>
                  {requestType === "exchange" && employeeDeliveries.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Entrega a trocar</Label>
                      <Select
                        value={item.delivery_id || ""}
                        onValueChange={(v) => updateItem(idx, "delivery_id", v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione a entrega original" /></SelectTrigger>
                        <SelectContent>
                          {employeeDeliveries.map((d: any) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.epis?.name || "EPI"} - {formatBrasiliaDateTime(d.delivery_date)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Funcionário:</span>
                  <p className="font-medium">{employeeMap[selectedRequest.employee_id] || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">{typeLabels[selectedRequest.request_type]}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Solicitado por:</span>
                  <p className="font-medium">{profileMap[selectedRequest.requested_by] || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className={statusColors[selectedRequest.status]}>
                    {statusLabels[selectedRequest.status]}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p className="font-medium">{format(new Date(selectedRequest.created_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
                {selectedRequest.responded_by && (
                  <div>
                    <span className="text-muted-foreground">Respondido por:</span>
                    <p className="font-medium">{profileMap[selectedRequest.responded_by] || "—"}</p>
                  </div>
                )}
              </div>

              {selectedRequest.notes && (
                <div>
                  <span className="text-sm text-muted-foreground">Observações:</span>
                  <p className="text-sm">{selectedRequest.notes}</p>
                </div>
              )}

              {selectedRequest.rejection_reason && (
                <div className="bg-destructive/10 p-3 rounded-md">
                  <span className="text-sm font-medium text-destructive">Motivo da rejeição:</span>
                  <p className="text-sm">{selectedRequest.rejection_reason}</p>
                </div>
              )}

              <div>
                <span className="text-sm font-medium">Itens solicitados:</span>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>EPI</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.epis?.name || "—"}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          {selectedRequest.status === "pending" ? (
                            "—"
                          ) : (
                            <Badge variant={(item.stock_source ?? "new") === "used" ? "secondary" : "default"} className="text-xs">
                              {(item.stock_source ?? "new") === "used" ? "Usado" : "Novo"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.reason || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {isOrgAdmin && selectedRequest.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      // Initialize per-item sources to "new" and pre-fill expiration with CA expiration if available
                      const initial: Record<string, "new" | "used"> = {};
                      const initialExp: Record<string, string> = {};
                      for (const it of requestItems) {
                        initial[(it as any).id] = "new";
                        initialExp[(it as any).id] = (it as any).expiration_date || (it as any).epis?.ca_expiration || "";
                      }
                      setApproveItemSources(initial);
                      setApproveItemExpirations(initialExp);
                      setApproveOpen(true);
                    }}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Aprovar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setRejectOpen(true)}
                  >
                    <X className="mr-2 h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              )}

              {(isOrgAdmin || isManager) && (selectedRequest.status === "awaiting_signature" || selectedRequest.status === "approved") && (
                <div className="space-y-2 pt-2">
                  {(existingSignedTerm || selectedRequest.status === "approved") && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-green-700 bg-green-100">
                        <Check className="mr-1 h-3 w-3" /> Termo já assinado
                      </Badge>
                      {existingSignedTerm && (
                        <button
                          type="button"
                          className="text-sm text-primary underline cursor-pointer"
                          onClick={async () => {
                            try {
                              const { openSignedTerm } = await import("@/lib/signedTerms");
                              await openSignedTerm(existingSignedTerm.file_url);
                            } catch (e) {
                              console.error(e);
                              toast.error("Erro ao abrir o arquivo.");
                            }
                          }}
                        >
                          Visualizar
                        </button>
                      )}
                    </div>
                  )}
                  {selectedRequest.status === "awaiting_signature" && !existingSignedTerm && (
                    <div className="p-3 border rounded-md bg-muted/20 text-xs text-muted-foreground">
                      A origem de estoque foi definida por item na aprovação (veja a coluna <strong>Origem</strong> acima).
                      A baixa no estoque ocorrerá automaticamente após a confirmação da assinatura.
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => generateTermoPDF(selectedRequest)}
                    >
                      <Printer className="mr-2 h-4 w-4" /> Imprimir Termo
                    </Button>
                    {selectedRequest.status === "awaiting_signature" && !existingSignedTerm && (
                      <>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingTerm}
                        >
                          {uploadingTerm ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          Upload Termo Assinado
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSignatureDialogOpen(true)}
                        >
                          <PenLine className="mr-2 h-4 w-4" /> Assinar Digitalmente
                        </Button>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadSignedTerm(file, selectedRequest);
                      }}
                    />
                  </div>
                </div>
              )}

              {selectedRequest.status === "pending" && (isOrgAdmin || selectedRequest.requested_by === profile?.id) && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openEdit(selectedRequest)}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </Button>
                  {!isOrgAdmin && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => cancelMutation.mutate(selectedRequest.id)}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <X className="mr-2 h-4 w-4" />
                      )}
                      Cancelar
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>Informe o motivo da rejeição</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Motivo da rejeição..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              onClick={() =>
                rejectMutation.mutate({
                  requestId: selectedRequest.id,
                  reason: rejectionReason,
                })
              }
            >
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog - choose stock source per item */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aprovar Solicitação</DialogTitle>
            <DialogDescription>
              Escolha, para cada item, se a baixa será no estoque <strong>Novo</strong> ou <strong>Usado</strong> e informe a <strong>data de vencimento</strong>.
              A baixa ocorrerá automaticamente quando a assinatura for coletada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EPI</TableHead>
                  <TableHead className="w-16 text-center">Qtd</TableHead>
                  <TableHead className="w-48">Origem</TableHead>
                  <TableHead className="w-40">Vencimento *</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestItems.map((item: any) => {
                  const stock = approveCnpjStockMap?.[item.epi_id];
                  const newQty = stock?.stock_quantity ?? 0;
                  const usedQty = stock?.used_stock_quantity ?? 0;
                  const current = approveItemSources[item.id] ?? "new";
                  const expValue = approveItemExpirations[item.id] ?? "";
                  const insufficient =
                    (current === "new" && newQty < item.quantity) ||
                    (current === "used" && usedQty < item.quantity);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.epis?.name || "—"}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell>
                        <Select
                          value={current}
                          onValueChange={(v) =>
                            setApproveItemSources({ ...approveItemSources, [item.id]: v as "new" | "used" })
                          }
                        >
                          <SelectTrigger className={insufficient ? "border-destructive" : ""}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Novo ({newQty})</SelectItem>
                            <SelectItem value="used">Usado ({usedQty})</SelectItem>
                          </SelectContent>
                        </Select>
                        {insufficient && (
                          <p className="text-[10px] text-destructive mt-1">Saldo insuficiente nesta origem.</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          required
                          className={!expValue ? "border-destructive" : ""}
                          value={expValue}
                          onChange={(e) =>
                            setApproveItemExpirations({ ...approveItemExpirations, [item.id]: e.target.value })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={approveMutation.isPending}>
              Cancelar
            </Button>
            <Button
              disabled={
                approveMutation.isPending ||
                !selectedRequest ||
                (requestItems as any[]).some((it) => !approveItemExpirations[it.id])
              }
              onClick={() => {
                if (!selectedRequest) return;
                const sources: Record<string, "new" | "used"> = {};
                const expirations: Record<string, string> = {};
                for (const it of requestItems as any[]) {
                  sources[it.id] = approveItemSources[it.id] ?? "new";
                  expirations[it.id] = approveItemExpirations[it.id] ?? "";
                }
                approveMutation.mutate({ requestId: selectedRequest.id, itemSources: sources, itemExpirations: expirations });
              }}
            >
              {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { resetForm(); setEditingRequestId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Solicitação de EPI</DialogTitle>
            <DialogDescription>Altere os dados da solicitação pendente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Funcionário *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {employeeId
                        ? employees.find((e) => e.id === employeeId)?.name ?? "Selecione"
                        : "Buscar funcionário..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        const emp = employees.find((e) => e.id === value);
                        if (!emp) return 0;
                        const normalize = (s: string) =>
                          s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                        return normalize(emp.name).includes(normalize(search)) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="Buscar por nome..." />
                      <CommandList>
                        <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                        {employees.map((e) => (
                          <CommandItem
                            key={e.id}
                            value={e.id}
                            onSelect={(val) => setEmployeeId(val)}
                          >
                            <Check className={`mr-2 h-4 w-4 ${employeeId === e.id ? "opacity-100" : "opacity-0"}`} />
                            {e.name}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={requestType} onValueChange={(v) => setRequestType(v as "new" | "exchange")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Novo EPI</SelectItem>
                    <SelectItem value="exchange">Troca de EPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações gerais..." />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens da Solicitação</Label>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar Item
                </Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-6 w-6">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">EPI *</Label>
                      <Select value={item.epi_id} onValueChange={(v) => updateItem(idx, "epi_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {epis.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name} (estoque: {e.stock_quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Motivo</Label>
                      <Input
                        value={item.reason}
                        onChange={(e) => updateItem(idx, "reason", e.target.value)}
                        placeholder="Ex: Desgaste"
                      />
                    </div>
                  </div>
                  {requestType === "exchange" && employeeDeliveries.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Entrega a trocar</Label>
                      <Select
                        value={item.delivery_id || ""}
                        onValueChange={(v) => updateItem(idx, "delivery_id", v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione a entrega original" /></SelectTrigger>
                        <SelectContent>
                          {employeeDeliveries.map((d: any) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.epis?.name || "EPI"} - {formatBrasiliaDateTime(d.delivery_date)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); resetForm(); setEditingRequestId(null); }}>Cancelar</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Digital Signature Dialog */}
      {selectedRequest && (
        <SignatureDialog
          open={signatureDialogOpen}
          onOpenChange={setSignatureDialogOpen}
          title="Assinatura Digital - Termo de EPI"
          employeeName={employeeMap[selectedRequest.employee_id] || "Funcionário"}
          summary={
            <div>
              <p><strong>Funcionário:</strong> {employeeMap[selectedRequest.employee_id] || "—"}</p>
              <p><strong>Tipo:</strong> {typeLabels[selectedRequest.request_type] || selectedRequest.request_type}</p>
              <p><strong>Status:</strong> {statusLabels[selectedRequest.status]}</p>
            </div>
          }
          onConfirm={async (sig, geo) => handleDigitalSignRequest(selectedRequest, sig, geo)}
        />
      )}
    </div>
  );
}

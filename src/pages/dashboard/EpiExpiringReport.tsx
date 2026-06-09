import { useState, useMemo, useEffect } from "react";
import { formatCNPJ } from "@/lib/cnpj";
import { format, parseISO, addDays } from "date-fns";
import { formatBrasiliaDateTime } from "@/lib/timezone";
import { FileDown, AlertTriangle, ShoppingCart, FileText, RefreshCw, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { useAuth } from "@/hooks/useAuth";
import { useManagerCnpjs } from "@/hooks/useManagerCnpjs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { ExtendExpirationDialog } from "@/components/ExtendExpirationDialog";
import { useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "epi_expiring_report_state";

type PersistedState = {
  startDate: string;
  endDate: string;
  generated: boolean;
  filterCnpjId: string;
};

function readPersistedState(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export default function EpiExpiringReport() {
  const { organization, isOrgAdmin, isSuperAdmin } = useAuth();
  const canManage = isOrgAdmin || isSuperAdmin;
  const { managerCnpjIds, managerSectorIds } = useManagerCnpjs();
  const navigate = useNavigate();
  const persisted = readPersistedState();
  const [startDate, setStartDate] = useState(persisted?.startDate ?? format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(persisted?.endDate ?? format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [generated, setGenerated] = useState(persisted?.generated ?? false);
  const [filterCnpjId, setFilterCnpjId] = useState(persisted?.filterCnpjId ?? "all");
  const [extendDelivery, setExtendDelivery] = useState<{ id: string; epiName: string; expirationDate: string } | null>(null);
  const queryClient = useQueryClient();

  // Persist filter state across tab navigation
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ startDate, endDate, generated, filterCnpjId }),
      );
    } catch {
      // ignore storage errors
    }
  }, [startDate, endDate, generated, filterCnpjId]);

  const { data: orgCnpjs } = useQuery({
    queryKey: ["organization-cnpjs-active", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_cnpjs")
        .select("id, cnpj, company_name, logo_url")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("is_main", { ascending: false })
        .order("company_name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const filteredCnpjs = useMemo(() => {
    if (!orgCnpjs) return [];
    if (managerCnpjIds === null) return orgCnpjs;
    return orgCnpjs.filter(c => managerCnpjIds.includes(c.id));
  }, [orgCnpjs, managerCnpjIds]);

  const { data: allExpiringDeliveries = [], isLoading } = useQuery({
    queryKey: ["epi-expiring", organization?.id, startDate, endDate, generated],
    queryFn: async () => {
      if (!organization?.id || !startDate || !endDate || !generated) return [];
      const { data, error } = await supabase
        .from("epi_deliveries")
        .select(
          `
          id, quantity, delivery_date, expiration_date, epi_id,
          epis:epi_id (id, name, ca_number, stock_quantity, min_stock),
          employees:employee_record_id (id, name, organization_cnpj_id, sector_id)
        `,
        )
        .eq("organization_id", organization.id)
        .eq("status", "delivered")
        .gte("expiration_date", startDate)
        .lte("expiration_date", endDate)
        .order("expiration_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id && !!startDate && !!endDate && generated,
  });

  const { data: allNegativeStockEpis = [] } = useQuery({
    queryKey: ["epis-negative-stock", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("epis")
        .select("id, name, ca_number, stock_quantity, min_stock")
        .eq("organization_id", organization.id)
        .lt("stock_quantity", 0);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const expiringDeliveries = useMemo(() => {
    let filtered = allExpiringDeliveries;
    // Manager visibility filter
    if (managerCnpjIds !== null) {
      filtered = filtered.filter((d: any) => {
        const cnpjId = d.employees?.organization_cnpj_id;
        return cnpjId && managerCnpjIds.includes(cnpjId);
      });
    }
    if (managerSectorIds !== null) {
      filtered = filtered.filter((d: any) => {
        const sectorId = d.employees?.sector_id;
        return sectorId && managerSectorIds.includes(sectorId);
      });
    }
    if (filterCnpjId !== "all") {
      filtered = filtered.filter((d: any) => d.employees?.organization_cnpj_id === filterCnpjId);
    }
    return filtered;
  }, [allExpiringDeliveries, filterCnpjId, managerCnpjIds, managerSectorIds]);

  const purchaseNeeds = useMemo(() => {
    const grouped: Record<string, { epi: any; expiringQty: number }> = {};

    // Add negative stock items first (regardless of period)
    for (const epi of allNegativeStockEpis) {
      grouped[epi.id] = { epi, expiringQty: 0 };
    }

    // Add expiring items
    for (const d of expiringDeliveries) {
      const epi = d.epis as any;
      if (!epi) continue;
      if (!grouped[epi.id]) {
        grouped[epi.id] = { epi, expiringQty: 0 };
      }
      grouped[epi.id].expiringQty += d.quantity;
    }

    return Object.values(grouped)
      .map(({ epi, expiringQty }) => {
        const need = expiringQty + epi.min_stock - epi.stock_quantity;
        return {
          id: epi.id,
          name: epi.name,
          ca_number: epi.ca_number,
          stock_quantity: epi.stock_quantity,
          min_stock: epi.min_stock,
          expiring_qty: expiringQty,
          need: Math.max(0, need),
        };
      })
      .filter((item) => item.need > 0 || item.stock_quantity < 0)
      .sort((a, b) => {
        if (a.stock_quantity < 0 && b.stock_quantity >= 0) return -1;
        if (b.stock_quantity < 0 && a.stock_quantity >= 0) return 1;
        return b.need - a.need;
      });
  }, [expiringDeliveries, allNegativeStockEpis]);

  const { sortedItems: sortedExpiring, sortField: expSortField, sortDirection: expSortDir, handleSort: expHandleSort } = useTableSort(expiringDeliveries);
  const { paginatedItems: paginatedExpiring, ...expiringPagination } = usePagination(sortedExpiring);
  const { sortedItems: sortedPurchase, sortField: purSortField, sortDirection: purSortDir, handleSort: purHandleSort } = useTableSort(purchaseNeeds);
  const { paginatedItems: paginatedPurchase, ...purchasePagination } = usePagination(sortedPurchase);

  const handleGenerate = () => {
    if (!startDate || !endDate) {
      toast.error("Selecione o período completo.");
      return;
    }
    if (startDate > endDate) {
      toast.error("A data inicial deve ser anterior à data final.");
      return;
    }
    setGenerated(true);
  };

  const exportExpiringToExcel = () => {
    const rows = expiringDeliveries.map((d) => ({
      EPI: (d.epis as any)?.name || "",
      CA: (d.epis as any)?.ca_number || "",
      Funcionário: (d.employees as any)?.name || "",
      Quantidade: d.quantity,
      "Data Entrega": d.delivery_date ? formatBrasiliaDateTime(d.delivery_date) : "",
      "Data Vencimento": d.expiration_date ? format(parseISO(d.expiration_date), "dd/MM/yyyy") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EPIs Vencendo");
    XLSX.writeFile(wb, "epis-vencendo.xlsx");
  };

  const exportPurchaseToExcel = () => {
    const rows = purchaseNeeds.map((item) => ({
      EPI: item.name,
      CA: item.ca_number || "",
      "Estoque Atual": item.stock_quantity,
      "Qtd Vencendo": item.expiring_qty,
      "Estoque Mínimo": item.min_stock,
      "Qtd a Adquirir": item.need,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Necessidade de Compra");
    XLSX.writeFile(wb, "necessidade-compra.xlsx");
  };

  const addPdfHeader = async (doc: jsPDF, title: string, logoOverride?: string | null) => {
    let startY = 15;
    const logoToUse = logoOverride !== undefined ? logoOverride : organization?.logo_url;
    // Add logo if available
    if (logoToUse) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = logoToUse;
        });
        doc.addImage(img, "PNG", 14, 10, 30, 30);
        startY = 15;
      } catch {
        // Logo failed, continue without it
      }
    }
    const xText = logoToUse ? 50 : 14;
    doc.setFontSize(16);
    doc.text(organization?.name || "Relatório", xText, startY);
    doc.setFontSize(11);
    doc.text(title, xText, startY + 7);
    doc.setFontSize(9);
    doc.text(`Período: ${startDate ? format(parseISO(startDate), "dd/MM/yyyy") : ""} a ${endDate ? format(parseISO(endDate), "dd/MM/yyyy") : ""}`, xText, startY + 13);
    doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, xText, startY + 18);
    return startY + 28;
  };

  const getSelectedCnpjLogo = () => {
    const selectedCnpj = filterCnpjId !== "all" ? orgCnpjs?.find(c => c.id === filterCnpjId) : null;
    return selectedCnpj?.logo_url || organization?.logo_url || null;
  };

  const exportExpiringToPdf = async () => {
    const doc = new jsPDF();
    const logoUrl = getSelectedCnpjLogo();
    const startY = await addPdfHeader(doc, "Relatório de EPIs Vencendo", logoUrl);
    autoTable(doc, {
      startY,
      head: [["EPI", "CA", "Funcionário", "Qtd", "Data Entrega", "Data Vencimento"]],
      body: expiringDeliveries.map((d) => [
        (d.epis as any)?.name || "",
        (d.epis as any)?.ca_number || "",
        (d.employees as any)?.name || "",
        d.quantity,
        d.delivery_date ? formatBrasiliaDateTime(d.delivery_date) : "",
        d.expiration_date ? format(parseISO(d.expiration_date), "dd/MM/yyyy") : "",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save("epis-vencendo.pdf");
  };

  const exportPurchaseToPdf = async () => {
    const doc = new jsPDF();
    const logoUrl = getSelectedCnpjLogo();
    const startY = await addPdfHeader(doc, "Necessidade de Compra de EPIs", logoUrl);
    autoTable(doc, {
      startY,
      head: [["EPI", "CA", "Estoque Atual", "Qtd Vencendo", "Estoque Mínimo", "Qtd a Adquirir"]],
      body: purchaseNeeds.map((item) => [
        item.name,
        item.ca_number || "",
        item.stock_quantity,
        item.expiring_qty,
        item.min_stock,
        item.need,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save("necessidade-compra.pdf");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatório de Vencimento de EPIs</h1>
        <p className="text-muted-foreground">Consulte EPIs com vencimento no período e a necessidade de compra</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setGenerated(false); }} className="w-[160px]" />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setGenerated(false); }} className="w-[160px]" />
            </div>
            {filteredCnpjs.length > 1 && (
              <div className="space-y-2">
                <Label>Empresa (CNPJ)</Label>
                <Select value={filterCnpjId} onValueChange={(v) => { setFilterCnpjId(v); }}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {filteredCnpjs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name} ({formatCNPJ(c.cnpj)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={handleGenerate} disabled={!startDate || !endDate}>
              Gerar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {generated && (
        <>
          {/* Section 1: Expiring EPIs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  EPIs Vencendo no Período
                </CardTitle>
                <CardDescription>
                  {expiringDeliveries.length} entrega(s) com vencimento entre {startDate ? format(parseISO(startDate), "dd/MM/yyyy") : ""} e{" "}
                  {endDate ? format(parseISO(endDate), "dd/MM/yyyy") : ""}
                </CardDescription>
              </div>
              {expiringDeliveries.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportExpiringToExcel}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportExpiringToPdf}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Carregando...</p>
              ) : expiringDeliveries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum EPI vencendo no período selecionado.</p>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableTableHead field="epis.name" sortField={expSortField} sortDirection={expSortDir} onSort={expHandleSort}>EPI</SortableTableHead>
                          <SortableTableHead field="epis.ca_number" sortField={expSortField} sortDirection={expSortDir} onSort={expHandleSort}>CA</SortableTableHead>
                          <SortableTableHead field="employees.name" sortField={expSortField} sortDirection={expSortDir} onSort={expHandleSort}>Funcionário</SortableTableHead>
                          <SortableTableHead field="quantity" sortField={expSortField} sortDirection={expSortDir} onSort={expHandleSort} className="text-center">Qtd</SortableTableHead>
                          <SortableTableHead field="delivery_date" sortField={expSortField} sortDirection={expSortDir} onSort={expHandleSort}>Data Entrega</SortableTableHead>
                          <SortableTableHead field="expiration_date" sortField={expSortField} sortDirection={expSortDir} onSort={expHandleSort}>Data Vencimento</SortableTableHead>
                          {canManage && <TableHead className="text-center">Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedExpiring.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium">{(d.epis as any)?.name || "-"}</TableCell>
                            <TableCell>{(d.epis as any)?.ca_number || "-"}</TableCell>
                            <TableCell>{(d.employees as any)?.name || "-"}</TableCell>
                            <TableCell className="text-center">{d.quantity}</TableCell>
                            <TableCell>
                              {d.delivery_date ? formatBrasiliaDateTime(d.delivery_date) : "-"}
                            </TableCell>
                            <TableCell>
                              {d.expiration_date ? format(parseISO(d.expiration_date), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            {canManage && (
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate("/dashboard/epi-exchanges", {
                                      state: { employeeId: (d.employees as any)?.id, employeeName: (d.employees as any)?.name }
                                    })}
                                    disabled={!(d.employees as any)?.id}
                                  >
                                    <RefreshCw className="mr-1 h-3 w-3" />
                                    Trocar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setExtendDelivery({
                                      id: d.id,
                                      epiName: (d.epis as any)?.name || "-",
                                      expirationDate: d.expiration_date || "",
                                    })}
                                    disabled={!d.expiration_date}
                                  >
                                    <CalendarClock className="mr-1 h-3 w-3" />
                                    Estender
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination
                    currentPage={expiringPagination.currentPage}
                    totalPages={expiringPagination.totalPages}
                    totalItems={expiringPagination.totalItems}
                    pageSize={expiringPagination.pageSize}
                    onPageChange={expiringPagination.setCurrentPage}
                    onPageSizeChange={expiringPagination.setPageSize}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Purchase Needs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Necessidade de Compra
                </CardTitle>
                <CardDescription>
                  Fórmula: Qtd Vencendo + Estoque Mínimo − Estoque Atual = Qtd a Adquirir
                </CardDescription>
              </div>
              {purchaseNeeds.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportPurchaseToExcel}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportPurchaseToPdf}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {purchaseNeeds.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma necessidade de compra identificada para o período.
                </p>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableTableHead field="name" sortField={purSortField} sortDirection={purSortDir} onSort={purHandleSort}>EPI</SortableTableHead>
                          <SortableTableHead field="ca_number" sortField={purSortField} sortDirection={purSortDir} onSort={purHandleSort}>CA</SortableTableHead>
                          <SortableTableHead field="stock_quantity" sortField={purSortField} sortDirection={purSortDir} onSort={purHandleSort} className="text-center">Estoque Atual</SortableTableHead>
                          <SortableTableHead field="expiring_qty" sortField={purSortField} sortDirection={purSortDir} onSort={purHandleSort} className="text-center">Qtd Vencendo</SortableTableHead>
                          <SortableTableHead field="min_stock" sortField={purSortField} sortDirection={purSortDir} onSort={purHandleSort} className="text-center">Estoque Mínimo</SortableTableHead>
                          <SortableTableHead field="need" sortField={purSortField} sortDirection={purSortDir} onSort={purHandleSort} className="text-center">Qtd a Adquirir</SortableTableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPurchase.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.ca_number || "-"}</TableCell>
                            <TableCell className="text-center">{item.stock_quantity}</TableCell>
                            <TableCell className="text-center">{item.expiring_qty}</TableCell>
                            <TableCell className="text-center">{item.min_stock}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="destructive">{item.need}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination
                    currentPage={purchasePagination.currentPage}
                    totalPages={purchasePagination.totalPages}
                    totalItems={purchasePagination.totalItems}
                    pageSize={purchasePagination.pageSize}
                    onPageChange={purchasePagination.setCurrentPage}
                    onPageSizeChange={purchasePagination.setPageSize}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ExtendExpirationDialog
        open={!!extendDelivery}
        onOpenChange={(open) => { if (!open) setExtendDelivery(null); }}
        delivery={extendDelivery}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["epi-expiring"] });
          setExtendDelivery(null);
        }}
      />
    </div>
  );
}

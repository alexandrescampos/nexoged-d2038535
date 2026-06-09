import { useState, useRef, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { parseLocalDate } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CaepiValidationBadge } from "@/components/CaepiValidationBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, HardHat, AlertTriangle, Clock, Upload, Search, Download, Package } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { toast } from "sonner";
import { format, isBefore, addDays, isAfter } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { useMemo } from "react";
import * as XLSX from "xlsx";
import { formatCNPJ } from "@/lib/cnpj";

interface Epi {
  id: string;
  organization_id: string;
  category_id: string | null;
  code: string;
  name: string;
  description: string | null;
  ca_number: string | null;
  ca_expiration: string | null;
  manufacturer: string | null;
  model: string | null;
  stock_quantity: number;
  used_stock_quantity: number;
  min_stock: number;
  average_cost: number | null;
  is_active: boolean;
  epi_categories?: { name: string } | null;
}

interface EpiCategory {
  id: string;
  name: string;
}

const emptyForm = {
  code: "", name: "", description: "", ca_number: "", ca_expiration: "",
  manufacturer: "", model: "",
  average_cost: "" as string | number, category_id: "", is_active: true,
};

export default function EpiCatalog() {
  const { organization, isOrgAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = usePersistedState("epi-catalog:dialogOpen", false);
  const [editing, setEditing] = usePersistedState<Epi | null>("epi-catalog:editing", null);
  const [form, setForm] = usePersistedState("epi-catalog:form", emptyForm);
  const [filterCategory, setFilterCategory] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockDialogOpen, setStockDialogOpen] = usePersistedState("epi-catalog:stockDialogOpen", false);
  const [stockEpi, setStockEpi] = usePersistedState<Epi | null>("epi-catalog:stockEpi", null);

  const { data: categories } = useQuery({
    queryKey: ["epi-categories", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_categories")
        .select("id, name")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as EpiCategory[];
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

  const { data: epis, isLoading } = useQuery({
    queryKey: ["epis", organization?.id, filterCategory],
    queryFn: async () => {
      let query = supabase
        .from("epis")
        .select("*, epi_categories(name)")
        .eq("organization_id", organization!.id)
        .order("name");
      if (filterCategory !== "all") {
        query = query.eq("category_id", filterCategory);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Epi[];
    },
    enabled: !!organization?.id,
  });

  // Stock per CNPJ for the selected EPI
  const { data: cnpjStockData, isLoading: loadingStock } = useQuery({
    queryKey: ["epi-cnpj-stock", stockEpi?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_cnpj_stock")
        .select("id, organization_cnpj_id, stock_quantity, used_stock_quantity, min_stock")
        .eq("epi_id", stockEpi!.id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!stockEpi?.id && !!organization?.id,
  });

  const [stockFormEdits, setStockFormEdits] = useState<Record<string, { stock_quantity: number; used_stock_quantity: number; min_stock: number }>>({});

  useEffect(() => {
    if (cnpjStockData && orgCnpjs) {
      const edits: Record<string, { stock_quantity: number; used_stock_quantity: number; min_stock: number }> = {};
      for (const cnpj of orgCnpjs) {
        const existing = cnpjStockData.find(s => s.organization_cnpj_id === cnpj.id);
        edits[cnpj.id] = {
          stock_quantity: existing?.stock_quantity ?? 0,
          used_stock_quantity: existing?.used_stock_quantity ?? 0,
          min_stock: existing?.min_stock ?? 0,
        };
      }
      setStockFormEdits(edits);
    }
  }, [cnpjStockData, orgCnpjs]);

  const saveStockMutation = useMutation({
    mutationFn: async () => {
      if (!stockEpi || !organization) return;
      for (const [cnpjId, values] of Object.entries(stockFormEdits)) {
        const existing = cnpjStockData?.find(s => s.organization_cnpj_id === cnpjId);
        if (existing) {
          const { error } = await supabase
            .from("epi_cnpj_stock")
            .update({ stock_quantity: values.stock_quantity, used_stock_quantity: values.used_stock_quantity, min_stock: values.min_stock })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("epi_cnpj_stock")
            .insert({
              epi_id: stockEpi.id,
              organization_cnpj_id: cnpjId,
              organization_id: organization.id,
              stock_quantity: values.stock_quantity,
              used_stock_quantity: values.used_stock_quantity,
              min_stock: values.min_stock,
            });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-cnpj-stock"] });
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      toast.success("Estoque atualizado!");
      setStockDialogOpen(false);
      setStockEpi(null);
    },
    onError: () => toast.error("Erro ao salvar estoque"),
  });

  const filteredEpis = useMemo(() => {
    if (!epis) return [];
    if (!searchTerm.trim()) return epis;
    const term = searchTerm.toLowerCase();
    return epis.filter(epi =>
      epi.name.toLowerCase().includes(term) ||
      epi.code.toLowerCase().includes(term)
    );
  }, [epis, searchTerm]);

  const { sortedItems: sortedEpis, sortField, sortDirection, handleSort } = useTableSort(filteredEpis);
  const epiPag = usePagination(sortedEpis);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        ca_number: form.ca_number || null,
        ca_expiration: form.ca_expiration || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        average_cost: form.average_cost !== "" ? Number(form.average_cost) : null,
        category_id: form.category_id || null,
        is_active: form.is_active,
        organization_id: organization!.id,
      };
      if (editing) {
        const { error } = await supabase.from("epis").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("epis").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      toast.success(editing ? "EPI atualizado!" : "EPI cadastrado!");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar EPI"),
  });

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      // Read headers from first row explicitly
      const rawHeaderRow = (XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 }))[0] as any[] | undefined;
      if (!rawHeaderRow || rawHeaderRow.length === 0) {
        toast.error("Planilha vazia ou sem cabeçalho.");
        setImporting(false);
        return;
      }
      const actualHeaders = rawHeaderRow.map(h => String(h ?? "").trim());

      // Read data rows with defval to preserve empty cells
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      if (!rows.length) {
        toast.error("Planilha sem dados.");
        setImporting(false);
        return;
      }

      // Normalize helper
      const norm = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim();

      const columnAliases: Record<string, string[]> = {
        "CÓD": ["cod", "codigo", "código"],
        "DESCRIÇÃO": ["descricao", "descrição", "nome"],
        "CATEGORIA": ["categoria"],
        "CA": ["ca", "n° ca", "nº ca", "n ca", "numero ca", "num ca"],
        "VALIDADE CA": ["validade ca", "validade do ca", "vencimento ca"],
        "FABRICANTE": ["fabricante"],
        "MODELO": ["modelo"],
        "CUSTO MÉDIO": ["custo medio", "custo médio", "custo", "preco", "preço", "valor"],
        "STATUS": ["status", "ativo", "situação", "situacao"],
      };

      // Find actual header for each canonical key using 3-tier matching
      const headerMap: Record<string, string | null> = {};
      const normalizedHeaders = actualHeaders.map(norm);

      for (const [canonical, aliases] of Object.entries(columnAliases)) {
        const normalizedAliases = aliases.map(norm);
        let found: string | null = null;

        // Tier 1: exact match
        for (const alias of normalizedAliases) {
          const idx = normalizedHeaders.indexOf(alias);
          if (idx !== -1) { found = actualHeaders[idx]; break; }
        }
        // Tier 2: startsWith
        if (!found) {
          for (const alias of normalizedAliases) {
            const idx = normalizedHeaders.findIndex(h => h.startsWith(alias));
            if (idx !== -1) { found = actualHeaders[idx]; break; }
          }
        }
        // Tier 3: includes
        if (!found) {
          for (const alias of normalizedAliases) {
            if (alias.length < 2) continue; // skip too-short aliases for includes
            const idx = normalizedHeaders.findIndex(h => h.includes(alias));
            if (idx !== -1) { found = actualHeaders[idx]; break; }
          }
        }
        headerMap[canonical] = found;
      }

      const requiredKeys = ["CÓD", "DESCRIÇÃO"];
      const missingRequired = requiredKeys.filter(k => !headerMap[k]);

      if (missingRequired.length > 0) {
        toast.error(`Colunas obrigatórias não encontradas: ${missingRequired.join(", ")}. Baixe o template para ver o formato correto.`);
        setImporting(false);
        return;
      }

      const optionalKeys = ["CATEGORIA", "CA", "VALIDADE CA", "FABRICANTE", "MODELO", "CUSTO MÉDIO", "STATUS"];
      const missingOptional = optionalKeys.filter(k => !headerMap[k]);
      if (missingOptional.length > 0) {
        toast.warning(`Colunas opcionais não encontradas: ${missingOptional.join(", ")}. Os dados correspondentes serão ignorados.`);
      }

      // Safe value getter
      const col = (row: Record<string, any>, key: string): string => {
        const h = headerMap[key];
        if (!h) return "";
        const v = row[h];
        if (v === null || v === undefined) return "";
        return String(v).trim();
      };

      // Robust date parser
      const parseImportDate = (value: any): string | null => {
        if (value === null || value === undefined || value === "") return null;
        // Excel serial date
        if (typeof value === "number" && value > 1 && value < 100000) {
          const excelEpoch = new Date(Date.UTC(1899, 11, 30));
          const d = new Date(excelEpoch.getTime() + value * 86400000);
          return format(d, "yyyy-MM-dd");
        }
        if (value instanceof Date) {
          return format(value, "yyyy-MM-dd");
        }
        const s = String(value).trim();
        if (!s) return null;
        // DD/MM/YYYY
        const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (brMatch) {
          const [, dd, mm, yyyy] = brMatch;
          return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        }
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return null;
      };

      // Extract unique categories
      const categoryNames = [...new Set(rows.map(r => col(r, "CATEGORIA")).filter(Boolean))];

      // Upsert categories
      const categoryMap: Record<string, string> = {};
      for (const catName of categoryNames) {
        const { data: existing } = await supabase
          .from("epi_categories")
          .select("id")
          .eq("organization_id", organization.id)
          .eq("name", catName)
          .maybeSingle();
        if (existing) {
          categoryMap[catName] = existing.id;
        } else {
          const { data: created, error } = await supabase
            .from("epi_categories")
            .insert({ name: catName, organization_id: organization.id })
            .select("id")
            .single();
          if (error) throw error;
          categoryMap[catName] = created.id;
        }
      }

      // Parse cost value
      const parseCost = (value: unknown): number | null => {
        if (value === null || value === undefined || value === "") return null;
        if (typeof value === "number") return value > 0 ? value : null;
        const s = String(value).trim().replace(/[R$\s]/g, "").replace(",", ".");
        const n = parseFloat(s);
        return !isNaN(n) && n >= 0 ? n : null;
      };

      // Build EPI payloads
      const epiPayloads = rows.map(r => {
        const rawDate = headerMap["VALIDADE CA"] ? r[headerMap["VALIDADE CA"]!] : undefined;
        const rawCost = headerMap["CUSTO MÉDIO"] ? r[headerMap["CUSTO MÉDIO"]!] : undefined;
        const rawStatus = headerMap["STATUS"] ? col(r, "STATUS") : "";
        
        // Ativo if empty or if contains 'at' (for 'ativo'), 'sim', 's', '1', 'true'
        let isActive = true;
        if (rawStatus) {
          const s = rawStatus.toLowerCase();
          isActive = s.includes("at") || s === "sim" || s === "s" || s === "1" || s === "true" || s === "y" || s === "yes";
          // If explicitly 'inativo', 'n', 'nao', '0', 'false', 'n'
          if (s.includes("ina") || s === "não" || s === "nao" || s === "n" || s === "0" || s === "false") {
            isActive = false;
          }
        }

        return {
          code: String(col(r, "CÓD")),
          name: col(r, "DESCRIÇÃO"),
          category_id: categoryMap[col(r, "CATEGORIA")] || null,
          ca_number: col(r, "CA") || null,
          ca_expiration: parseImportDate(rawDate),
          manufacturer: col(r, "FABRICANTE") || null,
          model: col(r, "MODELO") || null,
          average_cost: parseCost(rawCost),
          organization_id: organization.id,
          stock_quantity: 0,
          used_stock_quantity: 0,
          min_stock: 0,
          is_active: isActive,
        };
      }).filter(p => p.code && p.name);

      // Insert in batches of 50
      let inserted = 0;
      let skipped = 0;
      for (let i = 0; i < epiPayloads.length; i += 50) {
        const batch = epiPayloads.slice(i, i + 50);
        const { error, data: result } = await supabase.from("epis").upsert(batch, { onConflict: "organization_id,code" }).select("id");
        if (error) throw error;
        inserted += result?.length || 0;
        skipped += batch.length - (result?.length || 0);
      }

      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-categories"] });
      toast.success(`Importação concluída! ${inserted} EPIs inseridos${skipped > 0 ? `, ${skipped} já existentes` : ""}.`);
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error("Erro na importação: " + (err.message || "erro desconhecido"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (epi: Epi) => {
    setEditing(epi);
    setForm({
      code: epi.code,
      name: epi.name,
      description: epi.description || "",
      ca_number: epi.ca_number || "",
      ca_expiration: epi.ca_expiration || "",
      manufacturer: epi.manufacturer || "",
      model: epi.model || "",
      average_cost: epi.average_cost ?? "",
      category_id: epi.category_id || "",
      is_active: epi.is_active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const today = new Date();
  const isExpired = (date: string | null) => date && isBefore(parseLocalDate(date), today);
  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const d = parseLocalDate(date);
    return !isBefore(d, today) && !isAfter(d, addDays(today, 30));
  };
  const isLowStock = (qty: number, min: number) => qty <= min;

  const expiringSoonCount = epis?.filter(e => isExpiringSoon(e.ca_expiration)).length || 0;
  const expiredCount = epis?.filter(e => isExpired(e.ca_expiration)).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Catálogo de EPIs</h1>
          <p className="text-muted-foreground">
            Equipamentos de proteção cadastrados • Total: {filteredEpis.length}
          </p>
        </div>
        {isOrgAdmin && (
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button variant="outline" onClick={() => {
              const wb = XLSX.utils.book_new();
              const ws = XLSX.utils.json_to_sheet([
                 { "CÓD": "EPI-001", "DESCRIÇÃO": "Capacete de segurança classe B", "CATEGORIA": "Proteção da Cabeça", "CA": "12345", "VALIDADE CA": "31/12/2026", "FABRICANTE": "3M", "MODELO": "H-700", "CUSTO MÉDIO": 45.90, "STATUS": "Ativo" },
               ]);
              XLSX.utils.book_append_sheet(wb, ws, "Template");
              XLSX.writeFile(wb, "template_catalogo_epi.xlsx");
            }}>
              <Download className="mr-2 h-4 w-4" /> Baixar Template
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload className="mr-2 h-4 w-4" /> {importing ? "Importando..." : "Importar Planilha"}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Novo EPI
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div className="relative">
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[250px]"
            />
          </div>
        </div>
        <div>
          <Label>Filtrar por categoria</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(expiringSoonCount > 0 || expiredCount > 0) && (
        <div className="flex gap-4">
          {expiredCount > 0 && (
            <Card className="flex-1 border-destructive/50">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">{expiredCount} CA(s) vencido(s)</p>
                  <p className="text-xs text-muted-foreground">Certificados expirados</p>
                </div>
              </CardContent>
            </Card>
          )}
          {expiringSoonCount > 0 && (
            <Card className="flex-1 border-warning/50">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-medium text-warning">{expiringSoonCount} CA(s) vencendo em 30 dias</p>
                  <p className="text-xs text-muted-foreground">Atenção necessária</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !epis?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <HardHat className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum EPI cadastrado</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead field="code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Código</SortableTableHead>
                  <SortableTableHead field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Nome</SortableTableHead>
                  <SortableTableHead field="epi_categories.name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Categoria</SortableTableHead>
                  <SortableTableHead field="ca_number" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>CA</SortableTableHead>
                  <SortableTableHead field="ca_expiration" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Validade CA</SortableTableHead>
                  <SortableTableHead field="manufacturer" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Fabricante</SortableTableHead>
                  <SortableTableHead field="stock_quantity" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Estoque</SortableTableHead>
                  <SortableTableHead field="used_stock_quantity" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Est. Usado</SortableTableHead>
                  <SortableTableHead field="average_cost" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Custo Médio</SortableTableHead>
                  <SortableTableHead field="is_active" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                  {isOrgAdmin && <TableHead className="w-[80px]">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {epiPag.paginatedItems.map((epi) => (
                  <TableRow key={epi.id}>
                    <TableCell className="font-mono text-xs">{epi.code}</TableCell>
                    <TableCell className="font-medium">{epi.name}</TableCell>
                    <TableCell>{epi.epi_categories?.name || "—"}</TableCell>
                    <TableCell>{epi.ca_number || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {epi.ca_expiration ? format(parseLocalDate(epi.ca_expiration), "dd/MM/yyyy") : "—"}
                        {isExpired(epi.ca_expiration) && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Vencido</Badge>
                        )}
                        {isExpiringSoon(epi.ca_expiration) && (
                          <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0">Vencendo</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{epi.manufacturer || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {epi.stock_quantity}
                        {isLowStock(epi.stock_quantity, epi.min_stock) && (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{epi.used_stock_quantity}</TableCell>
                    <TableCell>{epi.average_cost != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(epi.average_cost) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={epi.is_active ? "default" : "secondary"}>
                        {epi.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {isOrgAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setStockEpi(epi); setStockDialogOpen(true); }} title="Gerenciar estoque por CNPJ">
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(epi)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination currentPage={epiPag.currentPage} totalPages={epiPag.totalPages} totalItems={epiPag.totalItems} pageSize={epiPag.pageSize} onPageChange={epiPag.setCurrentPage} onPageSizeChange={epiPag.setPageSize} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar EPI" : "Novo EPI"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex: EPI-001" />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nº CA</Label>
                <Input value={form.ca_number} onChange={(e) => setForm({ ...form, ca_number: e.target.value })} />
                <CaepiValidationBadge
                  caNumber={form.ca_number}
                  onApply={(info) =>
                    setForm({
                      ...form,
                      ca_expiration: info.expiration_date || form.ca_expiration,
                      manufacturer: info.manufacturer_name || form.manufacturer,
                      name: form.name || info.equipment_name || "",
                    })
                  }
                />
              </div>
              <div>
                <Label>Validade CA</Label>
                <Input type="date" value={form.ca_expiration} onChange={(e) => setForm({ ...form, ca_expiration: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fabricante</Label>
                <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Custo Médio (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.average_cost} onChange={(e) => setForm({ ...form, average_cost: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.code.trim() || !form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock per CNPJ dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={(open) => { setStockDialogOpen(open); if (!open) setStockEpi(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Estoque por CNPJ — {stockEpi?.name}</DialogTitle>
          </DialogHeader>
          {loadingStock ? (
            <p className="text-muted-foreground py-4">Carregando...</p>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {orgCnpjs?.map((cnpj) => {
                const values = stockFormEdits[cnpj.id] || { stock_quantity: 0, used_stock_quantity: 0, min_stock: 0 };
                return (
                  <div key={cnpj.id} className="border rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium">{cnpj.company_name} <span className="text-muted-foreground">({formatCNPJ(cnpj.cnpj)})</span></p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Novo</Label>
                        <Input type="number" min={0} value={values.stock_quantity} onChange={(e) => setStockFormEdits(prev => ({ ...prev, [cnpj.id]: { ...values, stock_quantity: Number(e.target.value) } }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Usado</Label>
                        <Input type="number" min={0} value={values.used_stock_quantity} onChange={(e) => setStockFormEdits(prev => ({ ...prev, [cnpj.id]: { ...values, used_stock_quantity: Number(e.target.value) } }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Mínimo</Label>
                        <Input type="number" min={0} value={values.min_stock} onChange={(e) => setStockFormEdits(prev => ({ ...prev, [cnpj.id]: { ...values, min_stock: Number(e.target.value) } }))} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStockDialogOpen(false); setStockEpi(null); }}>Cancelar</Button>
            <Button onClick={() => saveStockMutation.mutate()} disabled={saveStockMutation.isPending}>
              {saveStockMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

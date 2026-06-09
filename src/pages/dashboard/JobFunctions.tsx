import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Briefcase, Download, Search } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import * as XLSX from "xlsx";
import JobFunctionImport from "@/components/dashboard/JobFunctionImport";
import { normalizeText } from "@/lib/utils";

interface JobFunction {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  sector_id: string | null;
  is_active: boolean;
  created_at: string;
  sectors?: { name: string } | null;
}

function nextSequentialCode(existing: { code: string }[]): string {
  let max = 0;
  for (const f of existing) {
    const m = /^FUN-(\d+)$/.exec(f.code || "");
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `FUN-${String(max + 1).padStart(4, "0")}`;
}

export default function JobFunctions() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = usePersistedState("job-functions:dialogOpen", false);
  const [editing, setEditing, resetEditing] = usePersistedState<JobFunction | null>("job-functions:editing", null);
  const [searchTerm, setSearchTerm] = useState("");
  const [code, setCode, resetCode] = usePersistedState("job-functions:code", "");
  const [name, setName, resetName] = usePersistedState("job-functions:name", "");
  const [description, setDescription, resetDescription] = usePersistedState("job-functions:description", "");
  const [sectorId, setSectorId, resetSectorId] = usePersistedState("job-functions:sectorId", "");
  const [isActive, setIsActive, resetIsActive] = usePersistedState("job-functions:isActive", true);

  const { data: jobFunctions, isLoading } = useQuery({
    queryKey: ["job-functions", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_functions")
        .select("*, sectors(name)")
        .eq("organization_id", organization!.id)
        .order("code");
      if (error) throw error;
      return data as JobFunction[];
    },
    enabled: !!organization?.id,
  });

  const filteredFunctions = jobFunctions?.filter(f => 
    normalizeText(f.name).includes(normalizeText(searchTerm)) ||
    normalizeText(f.code || "").includes(normalizeText(searchTerm)) ||
    (f.description && normalizeText(f.description).includes(normalizeText(searchTerm))) ||
    (f.sectors?.name && normalizeText(f.sectors.name).includes(normalizeText(searchTerm)))
  );

  const { sortedItems: sortedFunctions, sortField, sortDirection, handleSort } = useTableSort(filteredFunctions || []);
  const fnPag = usePagination(sortedFunctions);

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
    enabled: !!organization?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedCode = code.trim();
      if (!trimmedCode) throw new Error("Código obrigatório");
      const payload = {
        code: trimmedCode,
        name,
        description: description || null,
        sector_id: sectorId || null,
        is_active: isActive,
      };
      if (editing) {
        const { error } = await supabase.from("job_functions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("job_functions").insert({ ...payload, organization_id: organization!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-functions"] });
      toast.success(editing ? "Função atualizada!" : "Função criada!");
      closeDialog();
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("job_functions_org_code_uniq") || msg.includes("duplicate key")) {
        toast.error("Já existe uma função com este código.");
      } else {
        toast.error(msg || "Erro ao salvar função");
      }
    },
  });

  const openCreate = () => {
    setEditing(null);
    setCode(nextSequentialCode(jobFunctions || []));
    setName("");
    setDescription("");
    setSectorId("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (fn: JobFunction) => {
    setEditing(fn);
    setCode(fn.code || "");
    setName(fn.name);
    setDescription(fn.description || "");
    setSectorId(fn.sector_id || "");
    setIsActive(fn.is_active);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetEditing();
    resetCode();
    resetName();
    resetDescription();
    resetSectorId();
    resetIsActive();
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { CODIGO: "FUN-0001", NOME: "Operador de Máquinas", "NOME SETOR": "Produção", DESCRICAO: "Opera máquinas industriais", ATIVA: "SIM" },
    ], { header: ["CODIGO", "NOME", "NOME SETOR", "DESCRICAO", "ATIVA"] });
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_funcoes.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Funções</h1>
          <p className="text-muted-foreground">Gerencie as funções dos funcionários</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Baixar Template
          </Button>
          <JobFunctionImport />
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nova Função
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por código, nome, setor ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !jobFunctions?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma função cadastrada</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead field="code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Código</SortableTableHead>
                  <SortableTableHead field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Nome</SortableTableHead>
                  <SortableTableHead field="sectors.name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Setor</SortableTableHead>
                  <SortableTableHead field="description" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Descrição</SortableTableHead>
                  <SortableTableHead field="is_active" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fnPag.paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum resultado encontrado para sua pesquisa.
                    </TableCell>
                  </TableRow>
                ) : (
                  fnPag.paginatedItems.map((fn) => (
                    <TableRow key={fn.id}>
                      <TableCell className="font-mono text-xs">{fn.code}</TableCell>
                      <TableCell className="font-medium">{fn.name}</TableCell>
                      <TableCell>{fn.sectors?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{fn.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={fn.is_active ? "default" : "secondary"}>
                          {fn.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(fn)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination currentPage={fnPag.currentPage} totalPages={fnPag.totalPages} totalItems={fnPag.totalItems} pageSize={fnPag.pageSize} onPageChange={fnPag.setCurrentPage} onPageSizeChange={fnPag.setPageSize} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Função" : "Nova Função"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: FUN-0001" />
              <p className="text-xs text-muted-foreground mt-1">Identificador único da função (usado na importação de funcionários).</p>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Operador de Máquinas" />
            </div>
            <div>
              <Label>Setor</Label>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {sectors?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da função" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || !code.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

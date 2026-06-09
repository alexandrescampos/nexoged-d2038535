import { useState } from "react";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Building2, Search } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { normalizeText } from "@/lib/utils";

interface Sector {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Sectors() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = usePersistedState("sectors:dialogOpen", false);
  const [editing, setEditing, resetEditing] = usePersistedState<Sector | null>("sectors:editing", null);
  const [searchTerm, setSearchTerm] = useState("");
  const [name, setName, resetName] = usePersistedState("sectors:name", "");
  const [description, setDescription, resetDescription] = usePersistedState("sectors:description", "");
  const [isActive, setIsActive, resetIsActive] = usePersistedState("sectors:isActive", true);

  const { data: sectors, isLoading } = useQuery({
    queryKey: ["sectors", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("name");
      if (error) throw error;
      return data as Sector[];
    },
    enabled: !!organization?.id,
  });

  const filteredSectors = sectors?.filter(s => 
    normalizeText(s.name).includes(normalizeText(searchTerm)) ||
    (s.description && normalizeText(s.description).includes(normalizeText(searchTerm)))
  );

  const { sortedItems: sortedSectors, sortField, sortDirection, handleSort } = useTableSort(filteredSectors || []);
  const sectorsPag = usePagination(sortedSectors);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("sectors")
          .update({ name, description: description || null, is_active: isActive })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sectors")
          .insert({ name, description: description || null, is_active: isActive, organization_id: organization!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
      toast.success(editing ? "Setor atualizado!" : "Setor criado!");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar setor"),
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (sector: Sector) => {
    setEditing(sector);
    setName(sector.name);
    setDescription(sector.description || "");
    setIsActive(sector.is_active);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetEditing();
    resetName();
    resetDescription();
    resetIsActive();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Setores</h1>
          <p className="text-muted-foreground">Gerencie os setores da organização</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Setor
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !sectors?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum setor cadastrado</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Nome</SortableTableHead>
                  <SortableTableHead field="description" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Descrição</SortableTableHead>
                  <SortableTableHead field="is_active" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectorsPag.paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum resultado encontrado para sua pesquisa.
                    </TableCell>
                  </TableRow>
                ) : (
                  sectorsPag.paginatedItems.map((sector) => (
                    <TableRow key={sector.id}>
                      <TableCell className="font-medium">{sector.name}</TableCell>
                      <TableCell className="text-muted-foreground">{sector.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={sector.is_active ? "default" : "secondary"}>
                          {sector.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(sector)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination currentPage={sectorsPag.currentPage} totalPages={sectorsPag.totalPages} totalItems={sectorsPag.totalItems} pageSize={sectorsPag.pageSize} onPageChange={sectorsPag.setCurrentPage} onPageSizeChange={sectorsPag.setPageSize} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Setor" : "Novo Setor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Produção" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do setor" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

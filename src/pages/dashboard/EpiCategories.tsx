import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Tags } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";

interface EpiCategory {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function EpiCategories() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = usePersistedState("epi-categories:dialogOpen", false);
  const [editing, setEditing, resetEditing] = usePersistedState<EpiCategory | null>("epi-categories:editing", null);
  const [name, setName, resetName] = usePersistedState("epi-categories:name", "");
  const [description, setDescription, resetDescription] = usePersistedState("epi-categories:description", "");
  const [isActive, setIsActive, resetIsActive] = usePersistedState("epi-categories:isActive", true);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["epi-categories", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epi_categories")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("name");
      if (error) throw error;
      return data as EpiCategory[];
    },
    enabled: !!organization?.id,
  });

  const { sortedItems: sortedCategories, sortField, sortDirection, handleSort } = useTableSort(categories || []);
  const catPag = usePagination(sortedCategories);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("epi_categories")
          .update({ name, description: description || null, is_active: isActive })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("epi_categories")
          .insert({ name, description: description || null, is_active: isActive, organization_id: organization!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-categories"] });
      toast.success(editing ? "Categoria atualizada!" : "Categoria criada!");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar categoria"),
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (cat: EpiCategory) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description || "");
    setIsActive(cat.is_active);
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
          <h1 className="text-3xl font-bold text-foreground">Categorias de EPI</h1>
          <p className="text-muted-foreground">Gerencie as categorias de equipamentos</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !categories?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tags className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma categoria cadastrada</p>
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
                {catPag.paginatedItems.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-muted-foreground">{cat.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={cat.is_active ? "default" : "secondary"}>
                        {cat.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination currentPage={catPag.currentPage} totalPages={catPag.totalPages} totalItems={catPag.totalItems} pageSize={catPag.pageSize} onPageChange={catPag.setCurrentPage} onPageSizeChange={catPag.setPageSize} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Capacetes" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da categoria" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativa</Label>
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

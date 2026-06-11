import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, List as ListIcon, X } from "lucide-react";
import { toast } from "sonner";

export default function ListsPage() {
  const [isListDialogOpen, setIsListDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [selectedList, setSelectedList] = useState<any>(null);
  const [newItemValue, setNewItemValue] = useState("");
  const queryClient = useQueryClient();

  const { data: lists, isLoading } = useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists")
        .select(`*, list_items(*)`)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("lists").insert([{ name }]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setNewListName("");
      setIsListDialogOpen(false);
      toast.success("Lista criada com sucesso!");
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Lista excluída com sucesso!");
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ listId, value }: { listId: string; value: string }) => {
      const { data, error } = await supabase.from("list_items").insert([{ list_id: listId, value }]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setNewItemValue("");
      toast.success("Item adicionado com sucesso!");
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Item excluído com sucesso!");
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Listas de Cadastro</h1>
        <Dialog open={isListDialogOpen} onOpenChange={setIsListDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nova Lista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Lista</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Nome da lista (ex: Tipo de Licença)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsListDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => createListMutation.mutate(newListName)}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ListIcon className="mr-2 h-5 w-5" /> Listas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell className="text-center py-4 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : lists?.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-center py-4 text-muted-foreground">Nenhuma lista encontrada.</TableCell>
                  </TableRow>
                ) : (
                  lists?.map((list) => (
                    <TableRow
                      key={list.id}
                      className={`cursor-pointer transition-colors ${
                        selectedList?.id === list.id ? "bg-muted" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedList(list)}
                    >
                      <TableCell className="font-medium">{list.name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Deseja realmente excluir esta lista?")) {
                              deleteListMutation.mutate(list.id);
                              if (selectedList?.id === list.id) setSelectedList(null);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selectedList ? `Itens da Lista: ${selectedList.name}` : "Selecione uma lista"}</span>
              {selectedList && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Novo item..."
                    className="w-48 h-9"
                    value={newItemValue}
                    onChange={(e) => setNewItemValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newItemValue.trim()) {
                        addItemMutation.mutate({ listId: selectedList.id, value: newItemValue });
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newItemValue.trim()) {
                        addItemMutation.mutate({ listId: selectedList.id, value: newItemValue });
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {selectedList ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valor</TableHead>
                    <TableHead className="w-[80px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedList.list_items?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                        Nenhum item nesta lista.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...(lists?.find((l: any) => l.id === selectedList.id)?.list_items || [])]
                      .sort((a, b) => a.value.localeCompare(b.value))
                      .map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.value}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (confirm("Deseja realmente excluir este item?")) {
                                  deleteItemMutation.mutate(item.id);
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ListIcon className="h-12 w-12 mb-4 opacity-20" />
                <p>Escolha uma lista à esquerda para gerenciar seus itens.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Settings2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const FIELD_TYPES = [
  { value: "boolean", label: "Verdadeiro / Falso" },
  { value: "integer", label: "Número Inteiro" },
  { value: "decimal", label: "Número Decimal" },
  { value: "text", label: "Texto livre (255 caracteres)" },
  { value: "textarea", label: "Texto Longo (5000 caracteres)" },
  { value: "date", label: "Data" },
  { value: "list", label: "Lista" },
];

export default function CustomFieldsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    field_type: "text",
    list_id: "",
  });

  const queryClient = useQueryClient();

  const { data: customFields, isLoading: isFieldsLoading } = useQuery({
    queryKey: ["custom_fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_fields")
        .select(`*, lists(name)`)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: lists } = useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lists").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase
        .from("custom_fields")
        .insert([
          {
            name: payload.name,
            description: payload.description,
            field_type: payload.field_type,
            list_id: payload.field_type === "list" ? payload.list_id : null,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_fields"] });
      setFormData({ name: "", description: "", field_type: "text", list_id: "" });
      setIsDialogOpen(false);
      toast.success("Campo adicional criado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar campo: " + error.message);
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_fields"] });
      toast.success("Campo excluído com sucesso!");
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error("O nome do campo é obrigatório.");
      return;
    }
    if (formData.field_type === "list" && !formData.list_id) {
      toast.error("Selecione uma lista para o tipo Lista.");
      return;
    }
    createFieldMutation.mutate(formData);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campos Adicionais</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie campos personalizados para serem usados no sistema.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo Campo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Campo Adicional</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">Nome</label>
                <Input
                  id="name"
                  placeholder="Ex: Área Total, Responsável Técnico"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="description" className="text-sm font-medium">Descrição</label>
                <Textarea
                  id="description"
                  placeholder="Breve descrição sobre o uso deste campo"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Tipo do Campo</label>
                <Select
                  value={formData.field_type}
                  onValueChange={(value) => setFormData({ ...formData, field_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.field_type === "list" && (
                <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium">Lista Associada</label>
                  <Select
                    value={formData.list_id}
                    onValueChange={(value) => setFormData({ ...formData, list_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma lista" />
                    </SelectTrigger>
                    <SelectContent>
                      {lists?.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                      {lists?.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhuma lista cadastrada.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    As opções desta lista estarão disponíveis para seleção neste campo.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate}>Criar Campo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" /> Campos Configurados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Informações Extras</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFieldsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Carregando campos...
                  </TableCell>
                </TableRow>
              ) : customFields?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhum campo adicional configurado.
                  </TableCell>
                </TableRow>
              ) : (
                customFields?.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.name}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">
                      {field.description || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                        {FIELD_TYPES.find((t) => t.value === field.field_type)?.label || field.field_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      {field.field_type === "list" ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-muted-foreground">Lista:</span>
                          <span className="font-medium">{field.lists?.name || "Não encontrada"}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Deseja realmente excluir o campo "${field.name}"?`)) {
                            deleteFieldMutation.mutate(field.id);
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

      <div className="bg-muted/50 p-4 rounded-lg flex gap-3 items-start">
        <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">Sobre os Campos Adicionais</p>
          <p>
            Estes campos permitem que você estenda as informações dos seus documentos e cadastros.
            Uma vez criados, eles poderão ser preenchidos nos formulários correspondentes do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

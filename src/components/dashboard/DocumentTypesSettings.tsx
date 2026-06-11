import { useState } from "react";
import { useGEDSettings } from "@/hooks/useGEDSettings";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Loader2, FileText } from "lucide-react";

export default function DocumentTypesSettings() {
  const { documentTypes, customFields, isLoading, createType, updateType, deleteType, isCreating } = useGEDSettings();
  const { sortedItems, sortField, sortDirection, handleSort } = useTableSort(documentTypes || []);
  const [isOpen, setIsOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    initials: "",
    description: "",
    requires_expiration_date: false,
    requires_creation_date: false,
    associated_field_ids: [] as string[]
  });

  const toggleField = (fieldId: string) => {
    setFormData(prev => {
      const ids = [...prev.associated_field_ids];
      const idx = ids.indexOf(fieldId);
      if (idx === -1) {
        ids.push(fieldId);
      } else {
        ids.splice(idx, 1);
      }
      return { ...prev, associated_field_ids: ids };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingType) {
      updateType({ id: editingType.id, updates: formData, customFieldIds: formData.associated_field_ids }, {
        onSuccess: () => {
          setIsOpen(false);
          setEditingType(null);
        }
      });
    } else {
      createType({ type: formData, customFieldIds: formData.associated_field_ids }, {
        onSuccess: () => {
          setIsOpen(false);
          setFormData({
            name: "",
            initials: "",
            description: "",
            requires_expiration_date: false,
            requires_creation_date: false,
            associated_field_ids: []
          });
        }
      });
    }
  };

  const handleEdit = (type: any) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      initials: type.initials,
      description: type.description || "",
      requires_expiration_date: type.requires_expiration_date,
      requires_creation_date: type.requires_creation_date,
      associated_field_ids: (type.associated_fields || []).map((f: any) => f.id)
    });
    setIsOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Tipos de Documento
          </CardTitle>
          <CardDescription>
            Gerencie os tipos documentais e suas regras de negócio.
          </CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingType(null);
            setFormData({
              name: "",
              initials: "",
              description: "",
              requires_expiration_date: false,
              requires_creation_date: false,
              associated_field_ids: []
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo Tipo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingType ? "Editar Tipo" : "Novo Tipo de Documento"}</DialogTitle>
                <DialogDescription>
                  Defina o nome, sigla e requisitos para este tipo de documento.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input 
                      id="name" 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Ex: Contrato" 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="initials">Sigla</Label>
                    <Input 
                      id="initials" 
                      value={formData.initials} 
                      onChange={(e) => setFormData({...formData, initials: e.target.value})}
                      placeholder="Ex: CON" 
                      required 
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea 
                    id="description" 
                    value={formData.description} 
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Opcional..." 
                  />
                </div>
                <div className="flex items-center justify-between space-x-2 border rounded-lg p-3">
                  <Label htmlFor="req-creation" className="flex flex-col gap-1 cursor-pointer">
                    <span>Exigir Data de Criação</span>
                    <span className="font-normal text-xs text-muted-foreground">O usuário deverá informar quando o documento foi criado.</span>
                  </Label>
                  <Switch 
                    id="req-creation" 
                    checked={formData.requires_creation_date} 
                    onCheckedChange={(val) => setFormData({...formData, requires_creation_date: val})} 
                  />
                </div>
                <div className="flex items-center justify-between space-x-2 border rounded-lg p-3">
                  <Label htmlFor="req-exp" className="flex flex-col gap-1 cursor-pointer">
                    <span>Controlar Vencimento</span>
                    <span className="font-normal text-xs text-muted-foreground">O sistema alertará sobre a data de expiração deste documento.</span>
                  </Label>
                  <Switch 
                    id="req-exp" 
                    checked={formData.requires_expiration_date} 
                    onCheckedChange={(val) => setFormData({...formData, requires_expiration_date: val})} 
                  />
                </div>
                
                <div className="grid gap-2 border rounded-lg p-3">
                  <Label>Campos Adicionais Associados</Label>
                  <CardDescription className="mb-2">
                    Estes campos serão solicitados ao usuário durante o upload deste tipo de documento.
                  </CardDescription>
                  <ScrollArea className="h-[150px] border rounded-md p-2">
                    {customFields.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-4">
                        Nenhum campo adicional cadastrado.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {customFields.map((field) => (
                          <div key={field.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`field-${field.id}`} 
                              checked={formData.associated_field_ids.includes(field.id)}
                              onCheckedChange={() => toggleField(field.id)}
                            />
                            <Label 
                              htmlFor={`field-${field.id}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {field.name} <span className="text-[10px] text-muted-foreground uppercase">({field.field_type})</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingType ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead field="initials" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Sigla</SortableTableHead>
                <SortableTableHead field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Nome</SortableTableHead>
                <TableHead>Requisitos</TableHead>
                <TableHead>Campos Extras</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum tipo cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                sortedItems.map((type: any) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-mono font-bold text-xs">{type.initials}</TableCell>
                    <TableCell>{type.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {type.requires_creation_date && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Data Criação</span>}
                        {type.requires_expiration_date && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Vencimento</span>}
                        {!type.requires_creation_date && !type.requires_expiration_date && <span className="text-[10px] text-muted-foreground italic">Nenhum</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {type.associated_fields?.length > 0 ? (
                          type.associated_fields.map((f: any) => (
                            <Badge key={f.id} variant="outline" className="text-[10px] font-normal py-0">
                              {f.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Nenhum</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(type)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteType(type.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

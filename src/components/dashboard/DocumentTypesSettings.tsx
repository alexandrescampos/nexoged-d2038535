import { useEffect, useState } from "react";
import { useGEDSettings } from "@/hooks/useGEDSettings";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Loader2, FileText, ArrowUp, ArrowDown, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePolicies, useApprovalFlows, usePerfis } from "@/hooks/usePolicyFlow";
import { policyFlowRepository, TipoAssinatura, FluxoAssinatura } from "@/repository/policyFlowRepository";
import { toast } from "sonner";

const SIGILOS = ["PUBLICO", "INTERNO", "RESTRITO", "CONFIDENCIAL", "SIGILOSO"];

const emptyForm = {
  name: "",
  initials: "",
  description: "",
  requires_expiration_date: false,
  requires_creation_date: false,
  associated_field_ids: [] as string[],
  politica_assinatura_id: "" as string,
  fluxo_aprovacao_id: "" as string,
  nivel_sigilo_padrao: "INTERNO",
  ocr_obrigatorio: false,
  pdfa_obrigatorio: false,
  dias_retencao: "" as string | number,
};

type SignerRow = { perfil_assinante_id: string | null; assinatura_obrigatoria: boolean; tipo_assinatura: TipoAssinatura };

export default function DocumentTypesSettings() {
  const { documentTypes, customFields, isLoading, createType, updateType, deleteType, isCreating } = useGEDSettings();
  const { sortedItems, sortField, sortDirection, handleSort } = useTableSort(documentTypes || []);
  const { policies } = usePolicies();
  const { flows } = useApprovalFlows();
  const { data: perfis = [] } = usePerfis();

  const [isOpen, setIsOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [signers, setSigners] = useState<SignerRow[]>([]);
  const [savingSigners, setSavingSigners] = useState(false);

  useEffect(() => {
    if (editingType?.id) {
      policyFlowRepository.listSignersForType(editingType.id).then((rows) =>
        setSigners(rows.map((r) => ({
          perfil_assinante_id: r.perfil_assinante_id,
          assinatura_obrigatoria: r.assinatura_obrigatoria,
          tipo_assinatura: r.tipo_assinatura,
        })))
      );
    } else {
      setSigners([]);
    }
  }, [editingType?.id]);

  const toggleField = (fieldId: string) => {
    setFormData((prev) => {
      const ids = [...prev.associated_field_ids];
      const idx = ids.indexOf(fieldId);
      if (idx === -1) ids.push(fieldId); else ids.splice(idx, 1);
      return { ...prev, associated_field_ids: ids };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      politica_assinatura_id: formData.politica_assinatura_id || null,
      fluxo_aprovacao_id: formData.fluxo_aprovacao_id || null,
      dias_retencao: formData.dias_retencao === "" ? null : Number(formData.dias_retencao),
    };
    const persistSigners = async (typeId: string) => {
      try {
        setSavingSigners(true);
        await policyFlowRepository.replaceSignersForType(
          typeId,
          signers.map((s, idx) => ({ ...s, ordem: idx + 1 }))
        );
      } catch (e: any) {
        toast.error("Erro ao salvar assinantes: " + e.message);
      } finally {
        setSavingSigners(false);
      }
    };
    if (editingType) {
      updateType({ id: editingType.id, updates: payload, customFieldIds: formData.associated_field_ids }, {
        onSuccess: async () => { await persistSigners(editingType.id); setIsOpen(false); setEditingType(null); }
      });
    } else {
      createType({ type: payload, customFieldIds: formData.associated_field_ids }, {
        onSuccess: async (data: any) => {
          if (data?.id) await persistSigners(data.id);
          setIsOpen(false);
          setFormData(emptyForm);
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
      associated_field_ids: (type.associated_fields || []).map((f: any) => f.id),
      politica_assinatura_id: type.politica_assinatura_id || "",
      fluxo_aprovacao_id: type.fluxo_aprovacao_id || "",
      nivel_sigilo_padrao: type.nivel_sigilo_padrao || "INTERNO",
      ocr_obrigatorio: !!type.ocr_obrigatorio,
      pdfa_obrigatorio: !!type.pdfa_obrigatorio,
      dias_retencao: type.dias_retencao ?? "",
    });
    setIsOpen(true);
  };

  const addSigner = () => setSigners([...signers, { perfil_assinante_id: null, assinatura_obrigatoria: true, tipo_assinatura: "SIMPLES" }]);
  const updateSigner = (i: number, patch: Partial<SignerRow>) => setSigners(signers.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const removeSigner = (i: number) => setSigners(signers.filter((_, idx) => idx !== i));
  const moveSigner = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= signers.length) return;
    const arr = [...signers];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setSigners(arr);
  };

  const selectedPolicy = policies.find((p) => p.id === formData.politica_assinatura_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Tipos de Documento</CardTitle>
          <CardDescription>Gerencie os tipos documentais e suas regras de negócio.</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) { setEditingType(null); setFormData(emptyForm); setSigners([]); }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Tipo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingType ? "Editar Tipo" : "Novo Tipo de Documento"}</DialogTitle>
                <DialogDescription>O tipo controla automaticamente política, fluxo, assinaturas e regras documentais.</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="geral" className="py-4">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="politica">Política</TabsTrigger>
                  <TabsTrigger value="fluxo">Aprovação</TabsTrigger>
                  <TabsTrigger value="assinantes">Assinantes</TabsTrigger>
                  <TabsTrigger value="documental">Documental</TabsTrigger>
                </TabsList>

                {/* GERAL */}
                <TabsContent value="geral" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Nome</Label>
                      <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Sigla</Label>
                      <Input value={formData.initials} onChange={(e) => setFormData({ ...formData, initials: e.target.value })} required />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Descrição</Label>
                    <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <Label className="cursor-pointer">Exigir Data de Criação</Label>
                    <Switch checked={formData.requires_creation_date} onCheckedChange={(v) => setFormData({ ...formData, requires_creation_date: v })} />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <Label className="cursor-pointer">Controlar Vencimento</Label>
                    <Switch checked={formData.requires_expiration_date} onCheckedChange={(v) => setFormData({ ...formData, requires_expiration_date: v })} />
                  </div>
                  <div className="grid gap-2 border rounded-lg p-3">
                    <Label>Campos Adicionais Associados</Label>
                    <ScrollArea className="h-[150px] border rounded-md p-2">
                      {customFields.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum campo cadastrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {customFields.map((field) => (
                            <div key={field.id} className="flex items-center space-x-2">
                              <Checkbox checked={formData.associated_field_ids.includes(field.id)} onCheckedChange={() => toggleField(field.id)} />
                              <Label className="text-sm font-normal cursor-pointer flex-1" onClick={() => toggleField(field.id)}>
                                {field.name} <span className="text-[10px] text-muted-foreground uppercase">({field.field_type})</span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* POLÍTICA */}
                <TabsContent value="politica" className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Política de Assinatura</Label>
                    <Select value={formData.politica_assinatura_id || "none"} onValueChange={(v) => setFormData({ ...formData, politica_assinatura_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selectedPolicy && (
                      <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        Documentos deste tipo exigirão <b>{selectedPolicy.quantidade_minima_assinaturas}</b> assinatura(s){" "}
                        <b>{selectedPolicy.tipo_assinatura}</b>
                        {selectedPolicy.certificado_obrigatorio && ", com certificado obrigatório"}
                        {selectedPolicy.carimbo_tempo && ", com carimbo de tempo"}
                        {selectedPolicy.ordem_assinatura && ", em ordem definida"}.
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Cadastre políticas em "Políticas de Assinatura".</p>
                  </div>
                </TabsContent>

                {/* FLUXO APROVAÇÃO */}
                <TabsContent value="fluxo" className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Fluxo de Aprovação</Label>
                    <Select value={formData.fluxo_aprovacao_id || "none"} onValueChange={(v) => setFormData({ ...formData, fluxo_aprovacao_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {flows.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {formData.fluxo_aprovacao_id && (
                      <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                        {(flows.find((f) => f.id === formData.fluxo_aprovacao_id)?.etapas || []).map((e: any) => (
                          <div key={e.id}>• Etapa {e.ordem}: <b>{e.nome_etapa}</b> {e.aprovacao_obrigatoria && <span className="text-xs text-muted-foreground">(obrigatória)</span>}</div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Cadastre fluxos em "Fluxos de Aprovação".</p>
                  </div>
                </TabsContent>

                {/* ASSINANTES */}
                <TabsContent value="assinantes" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Assinantes por ordem</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addSigner}><Plus className="h-4 w-4 mr-1" />Assinante</Button>
                  </div>
                  {signers.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum assinante configurado.</p>}
                  {signers.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                      <div className="col-span-1 flex flex-col gap-1">
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveSigner(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveSigner(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                      </div>
                      <div className="col-span-5 grid gap-1">
                        <Label className="text-xs">Perfil #{i + 1}</Label>
                        <Select value={s.perfil_assinante_id || ""} onValueChange={(v) => updateSigner(i, { perfil_assinante_id: v || null })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {perfis.map((p: any) => <SelectItem key={p.perfil_id} value={p.perfil_id}>{p.perfil_nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3 grid gap-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select value={s.tipo_assinatura} onValueChange={(v) => updateSigner(i, { tipo_assinatura: v as TipoAssinatura })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SIMPLES">Simples</SelectItem>
                            <SelectItem value="AVANCADA">Avançada</SelectItem>
                            <SelectItem value="QUALIFICADA">Qualificada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 flex flex-col items-center gap-1">
                        <Label className="text-xs">Obrig.</Label>
                        <Switch checked={s.assinatura_obrigatoria} onCheckedChange={(v) => updateSigner(i, { assinatura_obrigatoria: v })} />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeSigner(i)}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                {/* DOCUMENTAL */}
                <TabsContent value="documental" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Nível de Sigilo padrão</Label>
                      <Select value={formData.nivel_sigilo_padrao} onValueChange={(v) => setFormData({ ...formData, nivel_sigilo_padrao: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SIGILOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Dias de retenção</Label>
                      <Input type="number" min={0} value={formData.dias_retencao}
                        onChange={(e) => setFormData({ ...formData, dias_retencao: e.target.value })}
                        placeholder="Indefinido" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <Label className="cursor-pointer">OCR obrigatório</Label>
                    <Switch checked={formData.ocr_obrigatorio} onCheckedChange={(v) => setFormData({ ...formData, ocr_obrigatorio: v })} />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <Label className="cursor-pointer">PDF/A obrigatório</Label>
                    <Switch checked={formData.pdfa_obrigatorio} onCheckedChange={(v) => setFormData({ ...formData, pdfa_obrigatorio: v })} />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isCreating || savingSigners}>
                  {(isCreating || savingSigners) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingType ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead field="initials" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Sigla</SortableTableHead>
                <SortableTableHead field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Nome</SortableTableHead>
                <TableHead>Política / Fluxo</TableHead>
                <TableHead>Documental</TableHead>
                <TableHead>Campos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum tipo cadastrado.</TableCell></TableRow>
              ) : sortedItems.map((type: any) => (
                <TableRow key={type.id}>
                  <TableCell className="font-mono font-bold text-xs">{type.initials}</TableCell>
                  <TableCell>{type.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {type.politica_assinatura_id && <Badge variant="outline" className="text-[10px]">Política</Badge>}
                      {type.fluxo_aprovacao_id && <Badge variant="outline" className="text-[10px]">Fluxo</Badge>}
                      {!type.politica_assinatura_id && !type.fluxo_aprovacao_id && <span className="text-[10px] text-muted-foreground italic">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {type.nivel_sigilo_padrao && <Badge variant="secondary" className="text-[10px]">{type.nivel_sigilo_padrao}</Badge>}
                      {type.ocr_obrigatorio && <Badge variant="outline" className="text-[10px]">OCR</Badge>}
                      {type.pdfa_obrigatorio && <Badge variant="outline" className="text-[10px]">PDF/A</Badge>}
                      {type.dias_retencao && <Badge variant="outline" className="text-[10px]">{type.dias_retencao}d</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {type.associated_fields?.length > 0 ? type.associated_fields.map((f: any) => (
                        <Badge key={f.id} variant="outline" className="text-[10px] font-normal py-0">{f.name}</Badge>
                      )) : <span className="text-[10px] text-muted-foreground italic">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(type)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteType(type.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Trash2, Loader2, Workflow, ArrowUp, ArrowDown, X } from "lucide-react";
import { useApprovalFlows, usePerfis } from "@/hooks/usePolicyFlow";

type Etapa = { ordem: number; nome_etapa: string; perfil_responsavel_id: string | null; aprovacao_obrigatoria: boolean };

const emptyFlow = { id: undefined as string | undefined, nome: "", descricao: "", ativo: true };
const emptyEtapa: Etapa = { ordem: 1, nome_etapa: "", perfil_responsavel_id: null, aprovacao_obrigatoria: true };

export default function ApprovalFlowsPage() {
  const { flows, isLoading, upsert, remove } = useApprovalFlows();
  const { data: perfis = [] } = usePerfis();
  const [open, setOpen] = useState(false);
  const [flow, setFlow] = useState(emptyFlow);
  const [etapas, setEtapas] = useState<Etapa[]>([]);

  const reset = () => { setFlow(emptyFlow); setEtapas([]); };

  const addEtapa = () => setEtapas([...etapas, { ...emptyEtapa, ordem: etapas.length + 1 }]);
  const updateEtapa = (i: number, patch: Partial<Etapa>) => setEtapas(etapas.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  const removeEtapa = (i: number) => setEtapas(etapas.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= etapas.length) return;
    const arr = [...etapas];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setEtapas(arr);
  };

  const edit = (f: any) => {
    setFlow({ id: f.id, nome: f.nome, descricao: f.descricao || "", ativo: f.ativo });
    setEtapas((f.etapas || []).map((e: any) => ({
      ordem: e.ordem, nome_etapa: e.nome_etapa,
      perfil_responsavel_id: e.perfil_responsavel_id, aprovacao_obrigatoria: e.aprovacao_obrigatoria
    })));
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    upsert.mutate({ flow, etapas }, { onSuccess: () => { setOpen(false); reset(); } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fluxos de Aprovação</h1>
        <p className="text-muted-foreground">Modelos de etapas aplicados aos Tipos de Documento.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5" />Fluxos cadastrados</CardTitle>
            <CardDescription>Sequência de aprovadores por etapa.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Novo Fluxo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>{flow.id ? "Editar Fluxo" : "Novo Fluxo de Aprovação"}</DialogTitle>
                  <DialogDescription>Configure etapas ordenadas e seus responsáveis.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2 col-span-2">
                      <Label>Nome</Label>
                      <Input value={flow.nome} onChange={(e) => setFlow({ ...flow, nome: e.target.value })} required />
                    </div>
                    <div className="flex items-end justify-end gap-2">
                      <Label>Ativo</Label>
                      <Switch checked={flow.ativo} onCheckedChange={(v) => setFlow({ ...flow, ativo: v })} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Descrição</Label>
                    <Textarea value={flow.descricao} onChange={(e) => setFlow({ ...flow, descricao: e.target.value })} />
                  </div>

                  <div className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Etapas</Label>
                      <Button type="button" size="sm" variant="outline" onClick={addEtapa}><Plus className="h-4 w-4 mr-1" />Etapa</Button>
                    </div>
                    {etapas.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">Nenhuma etapa adicionada.</p>}
                    {etapas.map((et, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                        <div className="col-span-1 flex flex-col gap-1">
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                        </div>
                        <div className="col-span-4 grid gap-1">
                          <Label className="text-xs">Etapa #{i + 1}</Label>
                          <Input value={et.nome_etapa} onChange={(e) => updateEtapa(i, { nome_etapa: e.target.value })} placeholder="Ex: Jurídico" required />
                        </div>
                        <div className="col-span-4 grid gap-1">
                          <Label className="text-xs">Perfil responsável</Label>
                          <Select value={et.perfil_responsavel_id || ""} onValueChange={(v) => updateEtapa(i, { perfil_responsavel_id: v || null })}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {perfis.map((p: any) => <SelectItem key={p.perfil_id} value={p.perfil_id}>{p.perfil_nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 flex flex-col items-center gap-1">
                          <Label className="text-xs">Obrig.</Label>
                          <Switch checked={et.aprovacao_obrigatoria} onCheckedChange={(v) => updateEtapa(i, { aprovacao_obrigatoria: v })} />
                        </div>
                        <div className="col-span-1">
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeEtapa(i)}><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={upsert.isPending}>
                    {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Etapas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum fluxo cadastrado.</TableCell></TableRow>
                ) : flows.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(f.etapas || []).map((e: any) => (
                          <Badge key={e.id} variant="outline" className="text-[10px]">{e.ordem}. {e.nome_etapa}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{f.ativo ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => edit(f)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                        if (confirm("Excluir fluxo?")) remove.mutate(f.id);
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

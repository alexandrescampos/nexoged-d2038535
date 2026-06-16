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
import { Plus, Edit2, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { usePolicies } from "@/hooks/usePolicyFlow";
import { TipoAssinatura } from "@/repository/policyFlowRepository";

const empty = {
  id: undefined as string | undefined,
  nome: "",
  descricao: "",
  assinatura_obrigatoria: true,
  tipo_assinatura: "SIMPLES" as TipoAssinatura,
  quantidade_minima_assinaturas: 1,
  permite_coassinatura: false,
  ordem_assinatura: false,
  carimbo_tempo: false,
  certificado_obrigatorio: false,
  ativo: true,
};

const TIPO_LABEL: Record<TipoAssinatura, string> = {
  NENHUMA: "Nenhuma",
  SIMPLES: "Simples (login/senha)",
  AVANCADA: "Avançada (Gov.br / MFA / OTP)",
  QUALIFICADA: "Qualificada (ICP-Brasil A1/A3)",
};

export default function SignaturePoliciesPage() {
  const { policies, isLoading, upsert, remove } = usePolicies();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    upsert.mutate(form, { onSuccess: () => { setOpen(false); setForm(empty); } });
  };

  const edit = (p: any) => {
    setForm({ ...empty, ...p });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Políticas de Assinatura</h1>
        <p className="text-muted-foreground">Modelos reutilizáveis aplicados aos Tipos de Documento.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Políticas cadastradas</CardTitle>
            <CardDescription>Defina tipo, quantidade e exigências de assinatura.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Nova Política</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>{form.id ? "Editar Política" : "Nova Política"}</DialogTitle>
                  <DialogDescription>Configurações herdadas pelos Tipos de Documento que usarem esta política.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Nome</Label>
                    <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Descrição</Label>
                    <Textarea value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Tipo de Assinatura</Label>
                      <Select value={form.tipo_assinatura} onValueChange={(v) => setForm({ ...form, tipo_assinatura: v as TipoAssinatura })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIPO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Qtd. mínima de assinaturas</Label>
                      <Input type="number" min={0} value={form.quantidade_minima_assinaturas}
                        onChange={(e) => setForm({ ...form, quantidade_minima_assinaturas: Number(e.target.value) })} />
                    </div>
                  </div>
                  {[
                    ["assinatura_obrigatoria", "Assinatura obrigatória"],
                    ["permite_coassinatura", "Permitir coassinatura"],
                    ["ordem_assinatura", "Exigir ordem entre assinantes"],
                    ["carimbo_tempo", "Carimbo de tempo"],
                    ["certificado_obrigatorio", "Certificado digital obrigatório"],
                    ["ativo", "Ativo"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between border rounded-lg p-3">
                      <Label className="cursor-pointer">{label}</Label>
                      <Switch checked={(form as any)[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v } as any)} />
                    </div>
                  ))}
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mín.</TableHead>
                  <TableHead>Exigências</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma política cadastrada.</TableCell></TableRow>
                ) : policies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}{!p.ativo && <Badge variant="outline" className="ml-2">Inativo</Badge>}</TableCell>
                    <TableCell><Badge variant="secondary">{p.tipo_assinatura}</Badge></TableCell>
                    <TableCell>{p.quantidade_minima_assinaturas}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.assinatura_obrigatoria && <Badge variant="outline" className="text-[10px]">Obrigatória</Badge>}
                        {p.certificado_obrigatorio && <Badge variant="outline" className="text-[10px]">Certificado</Badge>}
                        {p.carimbo_tempo && <Badge variant="outline" className="text-[10px]">Carimbo</Badge>}
                        {p.ordem_assinatura && <Badge variant="outline" className="text-[10px]">Ordem</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => edit(p)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                        if (confirm("Excluir política?")) remove.mutate(p.id);
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

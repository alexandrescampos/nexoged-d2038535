import { useState, useRef } from "react";
import { documentProcessor } from "@/lib/documentProcessor";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Upload, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { validateCNPJ, formatCNPJ, maskCNPJ, cleanCNPJ } from "@/lib/cnpj";

interface OrgCnpj {
  id: string;
  organization_id: string;
  cnpj: string;
  company_name: string;
  is_main: boolean;
  is_active: boolean;
  logo_url: string | null;
}

export default function OrganizationCnpjs() {
  const { organization, isOrgAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = usePersistedState("org-cnpjs:dialogOpen", false);
  const [editing, setEditing, resetEditing] = usePersistedState<OrgCnpj | null>("org-cnpjs:editing", null);
  const [form, setForm, resetForm] = usePersistedState("org-cnpjs:form", { cnpj: "", company_name: "", is_active: true });
  const [isUploading, setIsUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: cnpjs, isLoading } = useQuery({
    queryKey: ["organization-cnpjs", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_cnpjs")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("is_main", { ascending: false })
        .order("company_name");
      if (error) throw error;
      return data as OrgCnpj[];
    },
    enabled: !!organization?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleaned = cleanCNPJ(form.cnpj);
      if (!validateCNPJ(cleaned)) throw new Error("CNPJ inválido");
      if (!form.company_name.trim()) throw new Error("Razão social é obrigatória");

      const payload = {
        cnpj: cleaned,
        company_name: form.company_name.trim(),
        is_active: form.is_active,
      };

      if (editing) {
        const { error } = await supabase
          .from("organization_cnpjs")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_cnpjs")
          .insert({ ...payload, organization_id: organization!.id });
        if (error) {
          if (error.message?.includes("organization_cnpjs_cnpj_unique")) {
            throw new Error("Este CNPJ já está cadastrado em outra organização.");
          }
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-cnpjs"] });
      toast({ title: editing ? "CNPJ atualizado" : "CNPJ adicionado", description: "Operação realizada com sucesso." });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Tipo inválido", description: "Apenas JPG, PNG, WebP ou SVG.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 2MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `cnpj-logos/${editing.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("organization-logos")
        .getPublicUrl(filePath);

      const urlWithTs = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("organization_cnpjs")
        .update({ logo_url: urlWithTs } as any)
        .eq("id", editing.id);
      if (updateError) throw updateError;

      setLogoPreview(urlWithTs);
      setEditing({ ...editing, logo_url: urlWithTs });
      queryClient.invalidateQueries({ queryKey: ["organization-cnpjs"] });
      toast({ title: "Logo atualizado", description: "Logo do CNPJ salvo com sucesso." });
    } catch (err) {
      console.error("Logo upload error:", err);
      toast({ title: "Erro ao enviar logo", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    if (!editing) return;
    setIsUploading(true);
    try {
      const { error } = await supabase
        .from("organization_cnpjs")
        .update({ logo_url: null } as any)
        .eq("id", editing.id);
      if (error) throw error;

      setLogoPreview(null);
      setEditing({ ...editing, logo_url: null });
      queryClient.invalidateQueries({ queryKey: ["organization-cnpjs"] });
      toast({ title: "Logo removido" });
    } catch {
      toast({ title: "Erro ao remover logo", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ cnpj: "", company_name: "", is_active: true });
    setLogoPreview(null);
    setDialogOpen(true);
  };

  const openEdit = (item: OrgCnpj) => {
    setEditing(item);
    setForm({
      cnpj: formatCNPJ(item.cnpj),
      company_name: item.company_name,
      is_active: item.is_active,
    });
    setLogoPreview(item.logo_url || null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetEditing();
    resetForm();
    setLogoPreview(null);
  };

  if (!isOrgAdmin) return null;

  const currentLogo = logoPreview || editing?.logo_url;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                CNPJs do Grupo
              </CardTitle>
              <CardDescription>
                Gerencie os CNPJs das empresas do grupo econômico
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar CNPJ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : !cnpjs?.length ? (
            <p className="text-muted-foreground text-sm text-center py-6">Nenhum CNPJ cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>Logo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cnpjs.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {formatCNPJ(item.cnpj)}
                      {item.is_main && (
                        <Badge variant="outline" className="ml-2 text-xs">Principal</Badge>
                      )}
                    </TableCell>
                    <TableCell>{item.company_name}</TableCell>
                    <TableCell>
                      {item.logo_url ? (
                        <img src={item.logo_url} alt="Logo" className="h-8 w-8 object-contain rounded" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar CNPJ" : "Adicionar CNPJ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CNPJ *</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div>
              <Label>Razão Social *</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Nome da empresa"
                maxLength={200}
              />
            </div>
            {editing && !editing.is_main && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Ativo</Label>
              </div>
            )}
            {editing?.is_main && (
              <p className="text-xs text-muted-foreground">
                O CNPJ principal não pode ser desativado.
              </p>
            )}

            {/* Logo upload - only when editing */}
            {editing && (
              <div className="space-y-2">
                <Label>Logo do CNPJ</Label>
                <p className="text-xs text-muted-foreground">
                  Usado nos documentos gerados pelo sistema. Se não definido, será usado o logo da organização.
                </p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 rounded-lg">
                    <AvatarImage src={currentLogo || undefined} alt="Logo" className="object-contain" />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs rounded-lg">
                      {editing.company_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      {currentLogo ? "Alterar" : "Enviar"}
                    </Button>
                    {currentLogo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveLogo}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4 mr-1" /> Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.cnpj || !form.company_name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

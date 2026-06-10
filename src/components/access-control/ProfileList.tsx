import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, CheckCircle2, ShieldCheck, Loader2, FolderTree, Map, Building2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { accessControlRepository } from "@/repository/accessControlRepository";
import { Perfil, Permissao } from "@/types/ged";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ProfileList() {
  const { organization } = useAuth();
  const [profiles, setProfiles] = useState<Perfil[]>([]);
  const [permissions, setPermissions] = useState<Permissao[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [profileScopes, setProfileScopes] = useState<any[]>([]);
  const [isAddingScope, setIsAddingScope] = useState(false);
  const [newScope, setNewScope] = useState({
    tipo_escopo: "DEPARTAMENTO" as "DEPARTAMENTO" | "SETOR" | "PASTA",
    referencia_id: "",
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);

  const [selectedSigilos, setSelectedSigilos] = useState<string[]>([]);
  const [newProfile, setNewProfile] = useState({
    perfil_nome: "",
    perfil_descricao: "",
    niveis_sigilo_permitidos: ["PUBLICO", "INTERNO"],
  });

  const sigiloOptions = [
    { value: "PUBLICO", label: "Público" },
    { value: "INTERNO", label: "Interno" },
    { value: "RESTRITO", label: "Restrito" },
    { value: "CONFIDENCIAL", label: "Confidencial" },
    { value: "SIGILOSO", label: "Sigiloso" },
  ];

  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id]);

  useEffect(() => {
    if (selectedProfileId) {
      loadProfileData(selectedProfileId);
    }
  }, [selectedProfileId]);

  const loadData = async () => {
    try {
      const [profs, perms] = await Promise.all([
        accessControlRepository.getProfiles(organization!.id),
        accessControlRepository.getAllPermissions()
      ]);
      setProfiles(profs);
      setPermissions(perms);
    } catch (error) {
      console.error(error);
    }
  };

  const loadProfileData = async (id: string) => {
    try {
      const [perms, scopes] = await Promise.all([
        accessControlRepository.getProfilePermissions(id),
        accessControlRepository.getProfileScopes(id)
      ]);
      setSelectedPerms(perms);
      setProfileScopes(scopes);
    } catch (error) {
      console.error(error);
    }
  };

  const loadHierarchyData = async () => {
    if (!organization?.id) return;
    try {
      const { data: depts } = await supabase.from("departments").select("*").eq("organization_id", organization.id).eq("dept_in_ativo", true);
      const { data: sets } = await supabase.from("sectors").select("*").eq("organization_id", organization.id).eq("set_in_ativo", true);
      const { data: psts } = await supabase.from("folders").select("*").eq("organization_id", organization.id).eq("past_in_ativa", true);
      setDepartments(depts || []);
      setSectors(sets || []);
      setFolders(psts || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (organization?.id) {
      loadHierarchyData();
    }
  }, [organization?.id]);


  const handleTogglePerm = (id: string) => {
    setSelectedPerms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSavePerms = async () => {
    if (!selectedProfileId) return;
    setIsSaving(true);
    try {
      await accessControlRepository.setProfilePermissions(selectedProfileId, selectedPerms);
      toast.success("Permissões do perfil atualizadas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar permissões.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfile.perfil_nome || !organization?.id) return;
    setIsCreating(true);
    try {
      await accessControlRepository.createProfile({
        perfil_nome: newProfile.perfil_nome,
        perfil_descricao: newProfile.perfil_descricao,
        organization_id: organization.id,
        ativo: true,
      });
      toast.success("Perfil criado com sucesso!");
      setIsDialogOpen(false);
      setNewProfile({ perfil_nome: "", perfil_descricao: "", niveis_sigilo_permitidos: ["PUBLICO", "INTERNO"] });
      loadData();
      window.dispatchEvent(new CustomEvent("perfis-changed"));
    } catch (error) {
      toast.error("Erro ao criar perfil.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Perfis</CardTitle>
            <CardDescription>Gerencie os papéis de acesso da organização</CardDescription>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Novo Perfil</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Perfil de Acesso</DialogTitle>
                <DialogDescription>
                  Crie um novo papel para agrupar permissões de usuários.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Perfil</Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: Gestor Financeiro" 
                    value={newProfile.perfil_nome}
                    onChange={(e) => setNewProfile({ ...newProfile, perfil_nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Descreva as responsabilidades deste perfil..." 
                    value={newProfile.perfil_descricao}
                    onChange={(e) => setNewProfile({ ...newProfile, perfil_descricao: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateProfile} disabled={isCreating || !newProfile.perfil_nome}>
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar Perfil
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {profiles.map(profile => (
              <button
                key={profile.perfil_id}
                onClick={() => {
                  setSelectedProfileId(profile.perfil_id);
                  setSelectedSigilos(profile.niveis_sigilo_permitidos || ["PUBLICO", "INTERNO"]);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${selectedProfileId === profile.perfil_id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted'}`}
              >
                <div>
                  <p className="font-semibold text-sm">{profile.perfil_nome}</p>
                  <p className="text-xs text-muted-foreground">{profile.perfil_descricao}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(profile.niveis_sigilo_permitidos || ["PUBLICO", "INTERNO"]).map(s => (
                      <span key={s} className="text-[9px] px-1 bg-muted rounded border text-muted-foreground uppercase">{s}</span>
                    ))}
                  </div>
                </div>
                {selectedProfileId === profile.perfil_id && <ShieldCheck className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedProfileId && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader>
            <CardTitle className="text-lg">Configurações do Perfil</CardTitle>
            <CardDescription>Defina as permissões e níveis de acesso deste perfil</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Níveis de Sigilo Permitidos
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {sigiloOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2 p-2 rounded border bg-card/50 hover:bg-muted/30 transition-colors">
                    <Checkbox 
                      id={`sigilo-${option.value}`} 
                      checked={selectedSigilos.includes(option.value)}
                      onCheckedChange={() => {
                        setSelectedSigilos(prev => 
                          prev.includes(option.value) ? prev.filter(s => s !== option.value) : [...prev, option.value]
                        );
                      }}
                    />
                    <Label htmlFor={`sigilo-${option.value}`} className="text-[10px] font-medium cursor-pointer leading-none">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-primary" />
                Escopo de Hierarquia (Departamentos, Setores e Pastas)
              </h3>
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={newScope.tipo_escopo}
                    onValueChange={(val: any) => setNewScope({ ...newScope, tipo_escopo: val, referencia_id: "" })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tipo de Escopo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEPARTAMENTO">Departamento</SelectItem>
                      <SelectItem value="SETOR">Setor</SelectItem>
                      <SelectItem value="PASTA">Pasta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-[2]">
                  <Select
                    value={newScope.referencia_id}
                    onValueChange={(val) => setNewScope({ ...newScope, referencia_id: val })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione o item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {newScope.tipo_escopo === "DEPARTAMENTO" && departments.map(d => (
                        <SelectItem key={d.dept_id} value={d.dept_id}>{d.dept_nm_departamento}</SelectItem>
                      ))}
                      {newScope.tipo_escopo === "SETOR" && sectors.map(s => (
                        <SelectItem key={s.set_id} value={s.set_id}>{s.set_nm_setor}</SelectItem>
                      ))}
                      {newScope.tipo_escopo === "PASTA" && folders.map(f => (
                        <SelectItem key={f.past_id} value={f.past_id}>{f.past_nm_pasta}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  size="sm" 
                  className="h-9" 
                  onClick={async () => {
                    if (!newScope.referencia_id || !organization?.id) return;
                    setIsAddingScope(true);
                    try {
                      await accessControlRepository.addProfileScope({
                        perfil_id: selectedProfileId,
                        tipo_escopo: newScope.tipo_escopo,
                        referencia_id: newScope.referencia_id,
                        organization_id: organization.id
                      });
                      toast.success("Escopo adicionado com sucesso!");
                      loadProfileData(selectedProfileId);
                      setNewScope({ ...newScope, referencia_id: "" });
                    } catch (error) {
                      toast.error("Erro ao adicionar escopo.");
                    } finally {
                      setIsAddingScope(false);
                    }
                  }}
                  disabled={isAddingScope || !newScope.referencia_id}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {profileScopes.map(scope => {
                  let label = "Item desconhecido";
                  let Icon = Building2;
                  if (scope.tipo_escopo === "DEPARTAMENTO") {
                    label = departments.find(d => d.dept_id === scope.referencia_id)?.dept_nm_departamento || "Depto";
                    Icon = Building2;
                  } else if (scope.tipo_escopo === "SETOR") {
                    label = sectors.find(s => s.set_id === scope.referencia_id)?.set_nm_setor || "Setor";
                    Icon = Map;
                  } else if (scope.tipo_escopo === "PASTA") {
                    label = folders.find(f => f.past_id === scope.referencia_id)?.past_nm_pasta || "Pasta";
                    Icon = FolderTree;
                  }

                  return (
                    <Badge key={scope.id} variant="secondary" className="gap-2 py-1.5 pl-2 pr-1 h-auto">
                      <Icon className="h-3 w-3 opacity-70" />
                      <span className="text-[10px] font-medium max-w-[120px] truncate">{label}</span>
                      <button 
                        onClick={async () => {
                          try {
                            await accessControlRepository.removeProfileScope(scope.id);
                            loadProfileData(selectedProfileId);
                            toast.success("Escopo removido.");
                          } catch (error) {
                            toast.error("Erro ao remover escopo.");
                          }
                        }}
                        className="p-0.5 hover:bg-muted rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Ações Permitidas (Permissões)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                {permissions.map(perm => (
                  <div key={perm.perm_id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 transition-colors">
                    <Checkbox 
                      id={perm.perm_id} 
                      checked={selectedPerms.includes(perm.perm_id)}
                      onCheckedChange={() => handleTogglePerm(perm.perm_id)}
                    />
                    <Label htmlFor={perm.perm_id} className="text-xs cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      <span className="font-bold block">{perm.perm_nome}</span>
                      <span className="text-[10px] text-muted-foreground">{perm.perm_descricao}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={async () => {
                if (!selectedProfileId) return;
                setIsSaving(true);
                try {
                  await Promise.all([
                    accessControlRepository.setProfilePermissions(selectedProfileId, selectedPerms),
                    accessControlRepository.updateProfile(selectedProfileId, { niveis_sigilo_permitidos: selectedSigilos })
                  ]);
                  toast.success("Perfil atualizado com sucesso!");
                  loadData(); 
                } catch (error) {
                  toast.error("Erro ao salvar alterações.");
                } finally {
                  setIsSaving(false);
                }
              }} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

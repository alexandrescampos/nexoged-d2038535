import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Map, Search, Loader2, Plus, Trash2, ShieldCheck, TreePine, Folder } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { accessControlRepository } from "@/repository/accessControlRepository";
import { UsuarioEscopo, TipoEscopo } from "@/types/ged";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function UserScopeManager() {
  const { organization } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [userScopes, setUserScopes] = useState<UsuarioEscopo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [newScopeType, setNewScopeType] = useState<TipoEscopo>("DEPARTAMENTO");
  const [newScopeRefId, setNewScopeRefId] = useState("");
  const [newScopeInherit, setNewScopeInherit] = useState(true);

  const [availableReferences, setAvailableReferences] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (organization?.id) {
      loadUsers();
    }
  }, [organization?.id]);

  useEffect(() => {
    if (selectedUserId) {
      loadUserScopes(selectedUserId);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (organization?.id && newScopeType) {
      loadReferences(newScopeType);
    }
  }, [newScopeType, organization?.id]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("full_name");
      setUsers(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserScopes = async (userId: string) => {
    try {
      const scopes = await accessControlRepository.getUserScopes(userId);
      setUserScopes(scopes);
    } catch (error) {
      console.error(error);
    }
  };

  const loadReferences = async (type: TipoEscopo) => {
    try {
      if (type === "DEPARTAMENTO") {
        const { data } = await supabase.from("departments").select("dept_id, dept_nm_departamento").eq("organization_id", organization!.id);
        setAvailableReferences(data?.map(d => ({ id: d.dept_id, name: d.dept_nm_departamento })) || []);
      } else if (type === "SETOR") {
        const { data } = await supabase.from("sectors").select("set_id, set_nm_setor").eq("organization_id", organization!.id);
        setAvailableReferences(data?.map(d => ({ id: d.set_id, name: d.set_nm_setor })) || []);
      } else if (type === "PASTA") {
        const { data } = await supabase.from("folders").select("past_id, past_nm_pasta").eq("organization_id", organization!.id);
        setAvailableReferences(data?.map(d => ({ id: d.past_id, name: d.past_nm_pasta })) || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddScope = async () => {
    if (!selectedUserId || !newScopeRefId) return;
    setIsAdding(true);
    try {
      await accessControlRepository.addUserScope({
        usuario_id: selectedUserId,
        tipo_escopo: newScopeType,
        escopo_referencia_id: newScopeRefId,
        herda_permissoes: newScopeInherit,
        organization_id: organization!.id
      });
      loadUserScopes(selectedUserId);
      setNewScopeRefId("");
      toast.success("Escopo adicionado com sucesso!");
    } catch (error) {
      toast.error("Erro ao adicionar escopo.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveScope = async (id: string) => {
    try {
      await accessControlRepository.removeUserScope(id);
      setUserScopes(prev => prev.filter(s => s.escopo_id !== id));
      toast.success("Escopo removido.");
    } catch (error) {
      toast.error("Erro ao remover escopo.");
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Usuários
          </CardTitle>
          <div className="relative pt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground mt-1" />
            <Input
              placeholder="Buscar usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="px-2">
          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${selectedUserId === user.id ? 'bg-primary/10 border-l-4 border-primary' : 'hover:bg-muted'}`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                    {user.full_name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-8">
        <CardHeader>
          <CardTitle>Escopos Efetivos</CardTitle>
          <CardDescription>Defina ONDE o usuário pode atuar na estrutura organizacional</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedUserId ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
              <Map className="h-12 w-12 mb-4" />
              <p>Selecione um usuário para gerenciar seus escopos de acesso.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-xl border space-y-4">
                <p className="text-sm font-bold flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar Novo Escopo</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Tipo</label>
                    <Select value={newScopeType} onValueChange={(v: any) => setNewScopeType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEPARTAMENTO">Departamento</SelectItem>
                        <SelectItem value="SETOR">Setor</SelectItem>
                        <SelectItem value="PASTA">Pasta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Referência</label>
                    <Select value={newScopeRefId} onValueChange={setNewScopeRefId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {availableReferences.map(ref => (
                          <SelectItem key={ref.id} value={ref.id}>{ref.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full" onClick={handleAddScope} disabled={isAdding || !newScopeRefId}>
                      {isAdding ? "Adicionando..." : "Adicionar"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="inherit" checked={newScopeInherit} onCheckedChange={(v: any) => setNewScopeInherit(v)} />
                  <label htmlFor="inherit" className="text-xs font-medium cursor-pointer">Herança Automática (Propagar para filhos e subpastas)</label>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold">Escopos Atuais</p>
                {userScopes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum escopo definido para este usuário.</p>
                ) : (
                  <div className="space-y-2">
                    {userScopes.map(scope => (
                      <div key={scope.escopo_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                            {scope.tipo_escopo === 'DEPARTAMENTO' ? <TreePine className="h-4 w-4" /> : 
                             scope.tipo_escopo === 'SETOR' ? <Map className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold">{scope.tipo_escopo}</p>
                            <p className="text-[10px] text-muted-foreground">ID: {scope.escopo_referencia_id}</p>
                            {scope.herda_permissoes && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">HERANÇA ATIVA</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveScope(scope.escopo_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ShieldAlert, CheckCircle2, XCircle, TreePine, Map, Folder, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { accessControlRepository } from "@/repository/accessControlRepository";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function AccessSimulator() {
  const { organization } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [effectivePerms, setEffectivePerms] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      loadUsers();
    }
  }, [organization?.id]);

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

  const handleSimulate = async (userId: string) => {
    setSelectedUserId(userId);
    setIsSimulating(true);
    try {
      const data = await accessControlRepository.getEffectivePermissions(userId, organization!.id);
      setEffectivePerms(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSimulating(false);
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
            Selecionar Usuário
          </CardTitle>
          <div className="relative pt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground mt-1" />
            <Input
              placeholder="Buscar..."
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
                onClick={() => handleSimulate(user.id)}
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
          <CardTitle>Permissões Efetivas</CardTitle>
          <CardDescription>Resultado final das regras de segurança para este usuário</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedUserId ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
              <ShieldAlert className="h-12 w-12 mb-4" />
              <p>Selecione um usuário para visualizar suas permissões efetivas.</p>
            </div>
          ) : isSimulating ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Processando regras de herança e sigilo...</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Perfis Ativos</h3>
                  <div className="space-y-2">
                    {effectivePerms?.profiles?.map((p: any) => (
                      <div key={p.perfil_id} className="p-2 bg-green-50 border border-green-100 rounded text-xs font-semibold text-green-800">
                        {p.perfil_nome}
                      </div>
                    ))}
                    {effectivePerms?.profiles?.length === 0 && <p className="text-xs italic text-muted-foreground">Nenhum perfil atribuído.</p>}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2"><Map className="h-4 w-4 text-blue-500" /> Escopos de Atuação</h3>
                  <div className="space-y-2">
                    {effectivePerms?.scopes?.map((s: any) => (
                      <div key={s.escopo_id} className="p-2 bg-blue-50 border border-blue-100 rounded flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-800">{s.tipo_escopo}</span>
                        <span className="text-[10px] text-blue-600 font-bold">{s.herda_permissoes ? 'COM HERANÇA' : 'NÍVEL ÚNICO'}</span>
                      </div>
                    ))}
                    {effectivePerms?.scopes?.length === 0 && <p className="text-xs italic text-muted-foreground">Acesso restrito apenas a documentos próprios.</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold">Árvore de Acesso Simulado</h3>
                <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
                   <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                     <TreePine className="h-3 w-3" /> Estrutura Organizacional
                   </div>
                   <div className="pl-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> 
                        <span className="font-semibold">Departamentos Autorizados:</span> 
                        <span className="text-muted-foreground italic">Calculado via Escopo</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> 
                        <span className="font-semibold">Setores Autorizados:</span> 
                        <span className="text-muted-foreground italic">Herança de Departamento</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> 
                        <span className="font-semibold">Pastas de Documentos:</span> 
                        <span className="text-muted-foreground italic">Acesso Total (Exceto Restritas)</span>
                      </div>
                   </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                 <h4 className="text-xs font-bold text-amber-800 flex items-center gap-2 mb-2"><ShieldAlert className="h-3 w-3" /> Resumo de Segurança</h4>
                 <p className="text-[10px] text-amber-700 leading-relaxed">
                   Este usuário pode visualizar todos os documentos **PÚBLICOS** e **INTERNOS** da organização. Documentos **RESTRITOS** ou **SIGILOSOS** só serão visíveis se o usuário for o proprietário ou estiver na lista explícita de autorização. O acesso às pastas restritas segue a lista de permissão individual por pasta.
                 </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  Users, 
  Search, 
  Loader2, 
  CheckCircle2, 
  FileText, 
  Upload, 
  Edit, 
  Trash2, 
  RotateCcw, 
  PenTool, 
  Settings 
} from "lucide-react";
import { GedPermission } from "@/types/ged";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const AVAILABLE_PERMISSIONS: { id: GedPermission; label: string; icon: any; description: string }[] = [
  { id: 'visualizar_documento', label: 'Visualizar', icon: FileText, description: 'Permite visualizar e baixar documentos' },
  { id: 'inserir_documento', label: 'Inserir', icon: Upload, description: 'Permite fazer upload de novos documentos' },
  { id: 'editar_documento', label: 'Editar', icon: Edit, description: 'Permite alterar metadados e versões' },
  { id: 'excluir_documento', label: 'Excluir', icon: Trash2, description: 'Permite remover documentos (lixeira)' },
  { id: 'restaurar_documento', label: 'Restaurar', icon: RotateCcw, description: 'Permite restaurar itens da lixeira' },
  { id: 'assinar_documento', label: 'Assinar', icon: PenTool, description: 'Permite realizar assinatura digital' },
  { id: 'gerenciar_permissoes', label: 'Administrar', icon: Settings, description: 'Acesso total a configurações e usuários' },
];

export default function PermissionsPage() {
  const { organization } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { userPermissions, isLoading: isLoadingPerms, updatePermissions, isUpdating } = useUserPermissions(selectedUserId || undefined);

  const [localPermissions, setLocalPermissions] = useState<GedPermission[]>([]);

  useEffect(() => {
    if (organization?.id) {
      fetchUsers();
    }
  }, [organization?.id]);

  useEffect(() => {
    if (userPermissions) {
      setLocalPermissions(userPermissions);
    }
  }, [userPermissions]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", organization!.id)
      .eq("is_active", true)
      .order("full_name");
    
    if (!error) setUsers(data || []);
    setIsLoadingUsers(false);
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTogglePermission = (perm: GedPermission) => {
    setLocalPermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = () => {
    if (!selectedUserId) return;
    updatePermissions(localPermissions);
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Permissões</h1>
          <p className="text-muted-foreground">Configuração granular de acesso por usuário (RBAC)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna de Usuários */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários Ativos
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
              {isLoadingUsers ? (
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

        {/* Coluna de Permissões */}
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedUser ? `Permissões para ${selectedUser.full_name}` : "Selecione um usuário"}
            </CardTitle>
            <CardDescription>
              As permissões marcadas serão aplicadas imediatamente após salvar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedUserId ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Shield className="h-12 w-12 mb-4 opacity-20" />
                <p>Selecione um usuário à esquerda para gerenciar seus acessos.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <div 
                      key={perm.id}
                      className={`flex items-start space-x-3 p-4 rounded-xl border transition-all ${localPermissions.includes(perm.id) ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' : 'bg-card'}`}
                    >
                      <Checkbox 
                        id={perm.id} 
                        checked={localPermissions.includes(perm.id)}
                        onCheckedChange={() => handleTogglePermission(perm.id)}
                        className="mt-1"
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label 
                          htmlFor={perm.id}
                          className="text-sm font-bold flex items-center gap-2 cursor-pointer"
                        >
                          <perm.icon className={`h-4 w-4 ${localPermissions.includes(perm.id) ? 'text-primary' : 'text-muted-foreground'}`} />
                          {perm.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {perm.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => setLocalPermissions(userPermissions)}
                    disabled={isUpdating}
                  >
                    Descartar Alterações
                  </Button>
                  <Button 
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="min-w-[140px]"
                  >
                    {isUpdating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> Salvar Permissões</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Loader2, ShieldCheck, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { accessControlRepository } from "@/repository/accessControlRepository";
import { Perfil } from "@/types/ged";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export function UserProfileAssignment() {
  const { organization } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Perfil[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userProfileIds, setUserProfileIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id]);

  useEffect(() => {
    const handler = () => {
      if (organization?.id) loadData();
    };
    window.addEventListener("perfis-changed", handler);
    return () => window.removeEventListener("perfis-changed", handler);
  }, [organization?.id]);

  useEffect(() => {
    if (selectedUserId) {
      loadUserProfiles(selectedUserId);
    }
  }, [selectedUserId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("full_name");
      
      const profs = await accessControlRepository.getProfiles(organization!.id);
      
      setUsers(userData || []);
      setProfiles(profs);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserProfiles = async (userId: string) => {
    try {
      const userProfs = await accessControlRepository.getUserProfiles(userId);
      setUserProfileIds(userProfs.map(p => p.perfil_id));
    } catch (error) {
      console.error(error);
    }
  };

  const toggleProfile = (profileId: string) => {
    setUserProfileIds(prev => 
      prev.includes(profileId) ? prev.filter(id => id !== profileId) : [...prev, profileId]
    );
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setIsSaving(true);
    try {
      await accessControlRepository.setUserProfiles(selectedUserId, userProfileIds, organization!.id);
      toast.success("Perfis do usuário atualizados!");
    } catch (error) {
      toast.error("Erro ao salvar perfis.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários X Perfis</CardTitle>
        <CardDescription>Atribua perfis aos usuários da organização</CardDescription>
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
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 border rounded-md p-1">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${selectedUserId === user.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted'}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">
                    {user.full_name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{user.full_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {selectedUserId ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-bold mb-2">Selecione os Perfis:</p>
                  {profiles.map(profile => (
                    <div key={profile.perfil_id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/30">
                      <Checkbox 
                        id={`uprofile-${profile.perfil_id}`} 
                        checked={userProfileIds.includes(profile.perfil_id)}
                        onCheckedChange={() => toggleProfile(profile.perfil_id)}
                      />
                      <label htmlFor={`uprofile-${profile.perfil_id}`} className="text-xs cursor-pointer font-medium">
                        {profile.perfil_nome}
                      </label>
                    </div>
                  ))}
                </div>
                <Button size="sm" className="w-full" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Salvando..." : <><Check className="h-4 w-4 mr-2" /> Salvar Perfis</>}
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 p-4 text-center">
                <ShieldCheck className="h-10 w-10 mb-2" />
                <p className="text-xs">Selecione um usuário para atribuir perfis.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

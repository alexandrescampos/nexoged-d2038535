import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Cloud, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface GoogleDriveIntegrationSettingsProps {
  organizationId: string;
}

export default function GoogleDriveIntegrationSettings({ organizationId }: GoogleDriveIntegrationSettingsProps) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: integration, isLoading } = useQuery({
    queryKey: ["organization-integration", organizationId, "google_drive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_integrations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("provider", "google_drive")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Update local state when data is loaded
  useEffect(() => {
    if (integration) {
      const credentials = integration.credentials as any;
      setApiKey(credentials?.apiKey || "");
      setIsActive(integration.is_active);
    }
  }, [integration]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("organization_integrations")
        .upsert({
          organization_id: organizationId,
          provider: "google_drive",
          credentials: { apiKey },
          is_active: isActive,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "organization_id, provider"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-integration", organizationId, "google_drive"] });
      toast.success("Configurações do Google Drive salvas com sucesso!");
    },
    onError: (error: any) => {
      console.error("Error saving integration:", error);
      toast.error("Erro ao salvar as configurações.");
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-500" />
          Integração Google Drive
        </CardTitle>
        <CardDescription>
          Configure a chave de API do conector Google Drive para sua organização.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Status da Integração</Label>
              <p className="text-sm text-muted-foreground">Ative ou desative o acesso ao Google Drive</p>
            </div>
            <Switch 
              checked={isActive} 
              onCheckedChange={setIsActive} 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="drive-api-key">Chave de API do Conector</Label>
            <Input
              id="drive-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Sua GOOGLE_DRIVE_API_KEY"
            />
            <p className="text-[11px] text-muted-foreground">
              Esta chave é usada para autenticar as requisições ao Google Drive através do gateway de conectores.
            </p>
          </div>

          {integration ? (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded-md">
              <CheckCircle2 className="h-4 w-4" />
              Configurado e pronto para uso.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
              <AlertCircle className="h-4 w-4" />
              Aguardando configuração inicial.
            </div>
          )}
        </div>

        <Button 
          onClick={() => upsertMutation.mutate()} 
          disabled={upsertMutation.isPending}
          className="w-full"
        >
          {upsertMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
}

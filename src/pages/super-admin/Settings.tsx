import { useState, useRef, useEffect } from "react";
import { documentProcessor } from "@/lib/documentProcessor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Upload, Loader2, Image, Save, Server, Phone, FileSearch } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SuperAdminSettings() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [systemName, setSystemName] = useState("");
  const [systemVersion, setSystemVersion] = useState("");
  const [supportPhone, setSupportPhone] = useState("");

  const { data: systemSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*");
      if (error) throw error;
      const settings: Record<string, string> = {};
      data?.forEach((item) => {
        settings[item.key] = item.value || "";
      });
      return settings;
    },
  });

  useEffect(() => {
    if (systemSettings) {
      if (systemSettings.system_logo) setLogoUrl(systemSettings.system_logo);
      setSystemName(systemSettings.system_name || "");
      setSystemVersion(systemSettings.system_version || "");
      setSupportPhone(systemSettings.support_phone || "");
    }
  }, [systemSettings]);

  const handleSaveSystemInfo = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: "system_name", value: systemName },
        { key: "system_version", value: systemVersion },
        { key: "support_phone", value: supportPhone },
      ];

      for (const item of updates) {
        const { error } = await supabase
          .from("system_settings")
          .upsert({ key: item.key, value: item.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast({ title: "Configurações salvas", description: "As informações do sistema foram atualizadas." });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar as configurações.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Tipo de arquivo inválido", description: "Apenas imagens JPG, PNG, WebP ou SVG são permitidas.", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo permitido é 2MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const optimizedFile = await documentProcessor.optimizeDocument(file);
      const fileExt = (optimizedFile as File).name.split(".").pop();
      const filePath = `system-logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("system-assets")
        .upload(filePath, optimizedFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("system-assets")
        .getPublicUrl(filePath);

      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      setLogoUrl(urlWithTimestamp);

      const { error: upsertError } = await supabase
        .from("system_settings")
        .upsert({ key: "system_logo", value: urlWithTimestamp, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (upsertError) throw upsertError;

      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast({ title: "Logo atualizado", description: "O logo do sistema foi atualizado com sucesso." });
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({ title: "Erro ao enviar logo", description: "Não foi possível enviar o logo. Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configurações globais do sistema</p>
      </div>

      <div className="grid gap-6">
        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Logo do Sistema
            </CardTitle>
            <CardDescription>Logo exibido na tela de login e no cabeçalho</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 rounded-lg">
                <AvatarImage src={logoUrl || undefined} alt="Logo do sistema" className="object-contain" />
                <AvatarFallback className="bg-primary/10 text-primary text-xl rounded-lg">NW</AvatarFallback>
              </Avatar>
              <div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isLoadingSettings}>
                  {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {isUploading ? "Enviando..." : "Alterar Logo"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP ou SVG. Máx 2MB.</p>
              </div>
            </div>
            {logoUrl && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Preview</span>
                  <img src={logoUrl} alt="Preview do logo" className="h-8 object-contain" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Informações do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Informações do Sistema
            </CardTitle>
            <CardDescription>Nome, versão e telefone de suporte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="system-name">Nome do Sistema</Label>
                <Input id="system-name" value={systemName} onChange={(e) => setSystemName(e.target.value)} placeholder="Nexo GED" disabled={isLoadingSettings} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="system-version">Versão</Label>
                <Input id="system-version" value={systemVersion} onChange={(e) => setSystemVersion(e.target.value)} placeholder="1.0.0" disabled={isLoadingSettings} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone de Suporte
              </Label>
              <Input id="support-phone" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="(11) 99999-9999" disabled={isLoadingSettings} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveSystemInfo} disabled={isSaving || isLoadingSettings}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isSaving ? "Salvando..." : "Salvar Informações"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Configurações Gerais */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>Ajustes globais do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Permitir novos cadastros</Label>
                <p className="text-sm text-muted-foreground">Usuários podem se cadastrar no sistema</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Modo de manutenção</Label>
                <p className="text-sm text-muted-foreground">Bloqueia acesso de usuários não-admin</p>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificações por email</Label>
                <p className="text-sm text-muted-foreground">Enviar emails para eventos do sistema</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

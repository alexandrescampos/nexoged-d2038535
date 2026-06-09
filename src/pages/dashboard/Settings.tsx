import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Building2, Crown, Users, Shield, Upload, Loader2, Save, FileText } from "lucide-react";
import OrganizationCnpjs from "@/components/dashboard/OrganizationCnpjs";
import ApiIntegrationSettings from "@/components/dashboard/ApiIntegrationSettings";
import UserAuditLog from "@/components/dashboard/UserAuditLog";

export default function OrgSettingsPage() {
  const { organization, profile, isOrgAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [city, setCity] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  

  // Initialize form with organization data
  useEffect(() => {
    if (organization) {
      setName(organization.name || "");
      setCnpj(organization.cnpj || "");
      setCity(organization.city || "");
      setLogoUrl(organization.logo_url || null);
      
    }
  }, [organization]);

  const formatCNPJ = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, "");
    
    // Apply mask: XX.XXX.XXX/XXXX-XX
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    if (formatted.length <= 18) {
      setCnpj(formatted);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas imagens JPG, PNG ou WebP são permitidas.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 2MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${organization.id}/logo.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("organization-logos")
        .getPublicUrl(filePath);

      // Add timestamp to bust cache
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      setLogoUrl(urlWithTimestamp);

      toast({
        title: "Logo enviado",
        description: "O logo foi enviado com sucesso. Salve as alterações para aplicar.",
      });
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Erro ao enviar logo",
        description: "Não foi possível enviar o logo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!organization?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: name.trim(),
          cnpj: cnpj || null,
          city: city.trim() || null,
          logo_url: logoUrl,
          
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Alterações salvas",
        description: "Os dados da organização foram atualizados com sucesso.",
      });

      // Reload the page to refresh auth context
      window.location.reload();
    } catch (error) {
      console.error("Error saving organization:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanBadge = (plan: string | null) => {
    switch (plan) {
      case "enterprise":
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">Enterprise</Badge>;
      case "professional":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Professional</Badge>;
      default:
        return <Badge variant="secondary">Basic</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Ativa</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspensa</Badge>;
      case "trial":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Trial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getOrgInitials = () => {
    if (!organization?.name) return "ORG";
    return organization.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          {isOrgAdmin ? "Gerencie" : "Visualize"} as configurações da organização
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informações da Organização
            </CardTitle>
            <CardDescription>
              {isOrgAdmin ? "Edite os dados" : "Dados"} da sua organização
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Section */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={logoUrl || undefined} alt="Logo da organização" />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {getOrgInitials()}
                </AvatarFallback>
              </Avatar>
              {isOrgAdmin && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {isUploading ? "Enviando..." : "Alterar Logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG ou WebP. Máx 2MB.
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="org-name">Nome da Organização</Label>
              {isOrgAdmin ? (
                <Input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome da organização"
                />
              ) : (
                <p className="text-sm font-medium py-2">{organization?.name || "—"}</p>
              )}
            </div>

            {/* CNPJ Field */}
            <div className="space-y-2">
              <Label htmlFor="org-cnpj">CNPJ</Label>
              {isOrgAdmin ? (
                <Input
                  id="org-cnpj"
                  value={cnpj}
                  onChange={handleCNPJChange}
                  placeholder="00.000.000/0000-00"
                />
              ) : (
                <p className="text-sm font-medium py-2">{organization?.cnpj || "—"}</p>
              )}
            </div>

            {/* City Field */}
            <div className="space-y-2">
              <Label htmlFor="org-city">Cidade</Label>
              {isOrgAdmin ? (
                <Input
                  id="org-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Nome da cidade"
                />
              ) : (
                <p className="text-sm font-medium py-2">{organization?.city || "—"}</p>
              )}
            </div>

            <Separator />

            {/* Read-only fields */}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Slug</span>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {organization?.slug || "—"}
              </code>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              {getStatusBadge(organization?.status || "active")}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Criada em</span>
              <span className="text-sm">
                {organization?.created_at
                  ? new Date(organization.created_at).toLocaleDateString("pt-BR")
                  : "—"}
              </span>
            </div>

            {isOrgAdmin && (
              <>
                <Separator />
                <Button onClick={handleSave} disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isLoading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Plan Info - Apenas para Org Admin */}
        {isOrgAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Plano Atual
              </CardTitle>
              <CardDescription>
                Detalhes do seu plano e limites
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Plano</span>
                {getPlanBadge(organization?.plan || null)}
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Limite de Funcionários</span>
                <span className="font-medium">
                  {organization?.max_users === null ? "Ilimitado" : (organization?.max_users ?? 10)}
                </span>
              </div>
              <Separator />
              <div className="text-sm text-muted-foreground">
                Para upgrade de plano, entre em contato com o suporte.
              </div>
            </CardContent>
          </Card>
        )}


        {/* CNPJs do Grupo */}
        {isOrgAdmin && (
          <div className="md:col-span-2">
            <OrganizationCnpjs />
          </div>
        )}

        {isOrgAdmin && organization?.id && (
          <div className="md:col-span-2">
            <ApiIntegrationSettings organizationId={organization.id} organizationName={organization.name} />
          </div>
        )}


        {/* Audit Log - Apenas para Org Admin */}
        {isOrgAdmin && (
          <div className="md:col-span-2">
            <UserAuditLog />
          </div>
        )}

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Minha Conta
            </CardTitle>
            <CardDescription>
              Informações do seu perfil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{profile?.full_name || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Email</span>
              <span className="text-sm">{profile?.email || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Função</span>
              <Badge variant="outline">
                {isOrgAdmin ? "Administrador" : "Usuário"}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={profile?.is_active ? "default" : "secondary"}>
                {profile?.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

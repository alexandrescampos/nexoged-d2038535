import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, FileText, Shield, Eye } from "lucide-react";
import { toast } from "sonner";

export default function LegalPage() {
  const queryClient = useQueryClient();
  const [termsContent, setTermsContent] = useState("");
  const [privacyContent, setPrivacyContent] = useState("");
  const [termsVersion, setTermsVersion] = useState("");
  const [previewType, setPreviewType] = useState<"terms" | "privacy" | null>(null);

  // Fetch current legal content
  const { isLoading } = useQuery({
    queryKey: ["legal-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .in("key", ["terms_of_service", "privacy_policy", "terms_version"]);

      if (error) throw error;

      const settings: Record<string, string> = {};
      data?.forEach((item) => {
        if (item.value) settings[item.key] = item.value;
      });

      // Set initial values
      setTermsContent(settings.terms_of_service || "");
      setPrivacyContent(settings.privacy_policy || "");
      setTermsVersion(settings.terms_version || "1.0");

      return settings;
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "terms_of_service", value: termsContent },
        { key: "privacy_policy", value: privacyContent },
        { key: "terms_version", value: termsVersion },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("system_settings")
          .upsert(
            { key: update.key, value: update.value, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Configurações legais salvas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  // Simple markdown-like formatting for preview
  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mt-6 mb-4">{line.substring(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mt-5 mb-3">{line.substring(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-medium mt-4 mb-2">{line.substring(4)}</h3>;
        }
        if (line.startsWith('- ')) {
          const parts = line.substring(2).split(/(\*\*[^*]+\*\*)/g);
          return (
            <li key={index} className="ml-4 mb-1">
              {parts.map((part, i) => 
                part.startsWith('**') && part.endsWith('**') 
                  ? <strong key={i}>{part.slice(2, -2)}</strong> 
                  : part
              )}
            </li>
          );
        }
        if (line.startsWith('---')) {
          return <hr key={index} className="my-4 border-border" />;
        }
        if (line.trim() === '') {
          return <br key={index} />;
        }
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={index} className="mb-2">
            {parts.map((part, i) => 
              part.startsWith('**') && part.endsWith('**') 
                ? <strong key={i}>{part.slice(2, -2)}</strong> 
                : part
            )}
          </p>
        );
      });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentos Legais</h1>
          <p className="text-muted-foreground">
            Gerencie os Termos de Uso e Política de Privacidade do sistema
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar Alterações
        </Button>
      </div>

      {/* Version Control */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Controle de Versão</CardTitle>
          <CardDescription>
            Atualize a versão ao fazer alterações significativas nos documentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="version">Versão Atual</Label>
              <Input
                id="version"
                value={termsVersion}
                onChange={(e) => setTermsVersion(e.target.value)}
                placeholder="1.0"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              Exemplo: 1.0, 1.1, 2.0
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Document Editors */}
      <Tabs defaultValue="terms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="terms" className="gap-2">
            <FileText className="h-4 w-4" />
            Termos de Uso
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <Shield className="h-4 w-4" />
            Política de Privacidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Termos de Uso</CardTitle>
                  <CardDescription>
                    Use formatação Markdown: # Título, ## Subtítulo, - lista, **negrito**
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewType(previewType === "terms" ? null : "terms")}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {previewType === "terms" ? "Editar" : "Preview"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {previewType === "terms" ? (
                <ScrollArea className="h-[500px] border rounded-md p-4">
                  <div className="text-sm">
                    {formatContent(termsContent)}
                  </div>
                </ScrollArea>
              ) : (
                <Textarea
                  value={termsContent}
                  onChange={(e) => setTermsContent(e.target.value)}
                  placeholder="# Termos de Uso&#10;&#10;## 1. Aceitação dos Termos&#10;&#10;Seu texto aqui..."
                  className="min-h-[500px] font-mono text-sm"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Política de Privacidade (LGPD)</CardTitle>
                  <CardDescription>
                    Use formatação Markdown: # Título, ## Subtítulo, - lista, **negrito**
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewType(previewType === "privacy" ? null : "privacy")}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {previewType === "privacy" ? "Editar" : "Preview"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {previewType === "privacy" ? (
                <ScrollArea className="h-[500px] border rounded-md p-4">
                  <div className="text-sm">
                    {formatContent(privacyContent)}
                  </div>
                </ScrollArea>
              ) : (
                <Textarea
                  value={privacyContent}
                  onChange={(e) => setPrivacyContent(e.target.value)}
                  placeholder="# Política de Privacidade&#10;&#10;## 1. Coleta de Dados&#10;&#10;Seu texto aqui..."
                  className="min-h-[500px] font-mono text-sm"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

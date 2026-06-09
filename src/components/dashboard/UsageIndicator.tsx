import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, HardDrive, AlertCircle, PlusCircle } from "lucide-react";
import { useOrganizationUsage } from "@/hooks/useOrganizationUsage";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function UsageIndicator() {
  const { organization, isOrgAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: usage, isLoading } = useOrganizationUsage(organization?.id);

  const handleAddStorage = async () => {
    if (!organization?.id) return;
    
    const newLimit = (usage?.contracted_storage_gb || 10) + 5;
    
    const { error } = await supabase
      .from("organizations")
      .update({ contracted_storage_gb: newLimit })
      .eq("id", organization.id);
      
    if (error) {
      toast.error("Erro ao solicitar espaço: " + error.message);
    } else {
      toast.success("Mais 5GB de espaço adicionados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["organization-usage"] });
    }
  };

  if (isLoading || !usage) return null;

  const pagePercentage = Math.min((usage.used_pages / usage.contracted_pages) * 100, 100);
  const storagePercentage = Math.min((usage.used_storage_gb / usage.contracted_storage_gb) * 100, 100);

  const isPagesExceeded = usage.used_pages >= usage.contracted_pages;
  const isStorageExceeded = usage.used_storage_gb >= usage.contracted_storage_gb;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Páginas de Documentos</CardTitle>
            <FileText className={`h-4 w-4 ${isPagesExceeded ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage.used_pages.toLocaleString()} / {usage.contracted_pages.toLocaleString()}
            </div>
            <Progress value={pagePercentage} className={`mt-2 ${isPagesExceeded ? "bg-destructive/20" : ""}`} />
            <p className="text-xs text-muted-foreground mt-2">
              {usage.used_pages >= usage.contracted_pages 
                ? "Limite de páginas atingido!" 
                : `${(usage.contracted_pages - usage.used_pages).toLocaleString()} páginas restantes`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Espaço em Disco</CardTitle>
            <div className="flex items-center gap-2">
              {isOrgAdmin && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-primary" 
                  title="Contratar +5GB"
                  onClick={handleAddStorage}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              )}
              <HardDrive className={`h-4 w-4 ${isStorageExceeded ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage.used_storage_gb.toFixed(2)} GB / {usage.contracted_storage_gb} GB
            </div>
            <Progress value={storagePercentage} className={`mt-2 ${isStorageExceeded ? "bg-destructive/20" : ""}`} />
            <p className="text-xs text-muted-foreground mt-2">
              {usage.used_storage_gb >= usage.contracted_storage_gb 
                ? "Espaço em disco esgotado!" 
                : `${(usage.contracted_storage_gb - usage.used_storage_gb).toFixed(2)} GB disponíveis`}
            </p>
          </CardContent>
        </Card>
      </div>

      {(isPagesExceeded || isStorageExceeded) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Limite Atingido</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>Sua organização atingiu o limite contratado. {isStorageExceeded ? "Novos uploads requerem contratação de espaço adicional (5GB)." : "Considere fazer um upgrade do seu plano."}</p>
            {isStorageExceeded && isOrgAdmin && (
              <Button variant="outline" className="w-fit" onClick={handleAddStorage}>
                Contratar +5GB de Espaço
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

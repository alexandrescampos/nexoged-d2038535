import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, HardDrive, AlertCircle } from "lucide-react";
import { useOrganizationUsage } from "@/hooks/useOrganizationUsage";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function UsageIndicator() {
  const { organization } = useAuth();
  const { data: usage, isLoading } = useOrganizationUsage(organization?.id);

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
            <HardDrive className={`h-4 w-4 ${isStorageExceeded ? "text-destructive" : "text-muted-foreground"}`} />
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
          <AlertDescription>
            <p>
              Sua organização atingiu o limite contratado.{" "}
              {isStorageExceeded
                ? "Entre em contato com o suporte para ampliar seu espaço."
                : "Considere fazer um upgrade do seu plano."}
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

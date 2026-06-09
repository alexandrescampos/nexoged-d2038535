import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Info, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AboutPage() {
  const { data: settings, isLoading } = useSystemSettings();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sobre</h1>
        <p className="text-muted-foreground">Informações do sistema</p>
      </div>

      <Card className="max-w-md">
        <CardHeader className="items-center text-center">
          <Avatar className="h-20 w-20 rounded-lg mb-2">
            <AvatarImage src={settings?.system_logo || undefined} alt="Logo" className="object-contain" />
            <AvatarFallback className="bg-primary/10 text-primary text-xl rounded-lg">
              {(settings?.system_name || "NE").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-xl">{settings?.system_name || "Nexo GED"}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm">
            <div className="flex items-center gap-3">
              <Info className="h-4 w-4 text-muted-foreground" />
              <dt className="text-muted-foreground">Versão</dt>
              <dd className="ml-auto font-medium">{settings?.system_version || "—"}</dd>
            </div>
            {settings?.support_phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <dt className="text-muted-foreground">Suporte</dt>
                <dd className="ml-auto font-medium">{settings.support_phone}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

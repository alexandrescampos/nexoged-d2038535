import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface TopBrandBarProps {
  isSuperAdmin?: boolean;
  organizationLogo?: string | null;
  organizationName?: string;
}

export function TopBrandBar({ 
  isSuperAdmin = false, 
  organizationLogo, 
  organizationName 
}: TopBrandBarProps) {
  const { data: systemSettings } = useSystemSettings();
  const systemLogo = systemSettings?.system_logo;

  return (
    <div className="h-60 border-b border-border bg-card flex items-center justify-between px-6 shadow-md relative z-10">
      {/* Esquerda: Logo da Organização (apenas se não for SuperAdmin) */}
      <div className="flex-1 flex items-center">
        {!isSuperAdmin && (
          <Avatar className="h-56 w-56">
            <AvatarImage src={organizationLogo || undefined} alt={organizationName} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
              {organizationName?.slice(0, 2).toUpperCase() || "ORG"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Centro: vazio para manter alinhamento */}
      <div className="flex-1" />

      {/* Direita: Logo do Sistema */}
      <div className="flex-1 flex items-center justify-end">
        {systemLogo ? (
          <img 
            src={systemLogo} 
            alt="Logo do Sistema" 
            className="h-52 w-auto object-contain"
          />
        ) : (
          <div className="h-52 w-52 rounded bg-primary/10 flex items-center justify-center">
            <span className="text-4xl font-bold text-primary">NW</span>
          </div>
        )}
      </div>
    </div>
  );
}

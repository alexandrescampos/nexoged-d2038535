import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useManagerCnpjs } from "@/hooks/useManagerCnpjs";
import { Building2, Layers, ShieldCheck } from "lucide-react";

interface CnpjOption {
  id: string;
  company_name: string;
  cnpj: string;
}

interface SectorOption {
  id: string;
  name: string;
}

interface ScopeSummaryCardProps {
  selectedCnpjId: string | null;
  onSelectCnpj: (id: string | null) => void;
}

export function ScopeSummaryCard({ selectedCnpjId, onSelectCnpj }: ScopeSummaryCardProps) {
  const { organization, isSuperAdmin, isOrgAdmin, isManager } = useAuth();
  const { managerCnpjIds, managerSectorIds, isLoading } = useManagerCnpjs();
  const [cnpjs, setCnpjs] = useState<CnpjOption[]>([]);
  

  const hasFullAccess = isSuperAdmin || managerCnpjIds === null;

  useEffect(() => {
    if (!organization?.id) return;
    const load = async () => {
      // Load CNPJs the user can see
      let cnpjQuery = supabase
        .from("organization_cnpjs")
        .select("id, company_name, cnpj")
        .eq("organization_id", organization.id)
        .eq("is_active", true);
      if (!isSuperAdmin && managerCnpjIds && managerCnpjIds.length > 0) {
        cnpjQuery = cnpjQuery.in("id", managerCnpjIds);
      }
      const { data: cnpjData } = await cnpjQuery;
      setCnpjs((cnpjData as CnpjOption[]) || []);
    };
    load();
  }, [organization?.id, managerCnpjIds]);

  if (isLoading) return null;

  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : isOrgAdmin
    ? "Administrador"
    : isManager
    ? "Gestor"
    : "Usuário";

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Meu escopo de acesso</span>
            <Badge variant="outline">{roleLabel}</Badge>
            {hasFullAccess ? (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                Acesso total
              </Badge>
            ) : (
              <Badge variant="secondary">
                {cnpjs.length} CNPJ(s) autorizado(s)
              </Badge>
            )}
          </div>

          {!hasFullAccess && cnpjs.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtrar por CNPJ:</span>
              <Select
                value={selectedCnpjId ?? "all"}
                onValueChange={(v) => onSelectCnpj(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[260px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meus CNPJs</SelectItem>
                  {cnpjs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {hasFullAccess ? (
          <p className="text-xs text-muted-foreground">
            Você está visualizando dados de todos os CNPJs e setores da organização.
          </p>
        ) : (
          <div className="space-y-2">
            {cnpjs.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {cnpjs.map((c) => (
                  <Badge
                    key={c.id}
                    variant={selectedCnpjId === c.id ? "default" : "secondary"}
                    className="font-normal"
                  >
                    {c.company_name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

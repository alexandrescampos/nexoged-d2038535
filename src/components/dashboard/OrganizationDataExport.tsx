import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Props {
  organizationId: string;
  organizationName?: string;
}

export default function OrganizationDataExport({ organizationId, organizationName }: Props) {
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!isSuperAdmin) {
      toast.error("Apenas Super Admins podem exportar dados de organizações.");
      return;
    }
    setLoading(true);
    try {
      const [orgRes, cnpjsRes] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", organizationId).maybeSingle(),
        supabase.from("organization_cnpjs").select("*").eq("organization_id", organizationId),
      ]);

      const errors = [orgRes, cnpjsRes]
        .map((r) => r.error)
        .filter(Boolean);
      if (errors.length > 0) {
        throw new Error(errors[0]!.message);
      }

      // Strip sensitive/internal fields from organization
      const org = orgRes.data ?? null;
      const sanitizedOrg = org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
            cnpj: org.cnpj,
            email: org.email,
            phone: org.phone,
            address: org.address,
            address_number: org.address_number,
            address_complement: org.address_complement,
            neighborhood: org.neighborhood,
            city: org.city,
            state: org.state,
            zip_code: org.zip_code,
            logo_url: org.logo_url,
          }
        : null;

      const snapshot = {
        source: "nexo-ged",
        version: 1,
        exported_at: new Date().toISOString(),
        organization: sanitizedOrg,
        cnpjs: cnpjsRes.data ?? [],
      };

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = (organizationName || "organizacao")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .toLowerCase();
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `nexo-ged-${safeName}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Snapshot exportado com sucesso");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao exportar dados";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportar dados da organização
        </CardTitle>
        <CardDescription>
          Baixa um arquivo JSON com os dados cadastrais desta organização para importação em outro
          sistema. Inclui: organização e CNPJs. Não inclui usuários,
          estoque, documentos ou dados financeiros.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isSuperAdmin && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Apenas Super Admins podem exportar dados de organizações.</span>
          </div>
        )}
        <Button onClick={handleExport} disabled={loading || !isSuperAdmin}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Baixar snapshot (JSON)
        </Button>
      </CardContent>
    </Card>
  );
}

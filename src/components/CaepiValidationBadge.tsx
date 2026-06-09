import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Wand2 } from "lucide-react";

export interface CaepiInfo {
  ca_number: string;
  expiration_date: string | null;
  status: string | null;
  equipment_name: string | null;
  manufacturer_name: string | null;
}

interface Props {
  caNumber: string;
  onApply?: (info: CaepiInfo) => void;
}

function formatBR(ymd: string | null): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export function CaepiValidationBadge({ caNumber, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<CaepiInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const ca = caNumber.trim();
    if (!ca) {
      setInfo(null);
      setNotFound(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("caepi_certificates" as any)
        .select("ca_number, expiration_date, status, equipment_name, manufacturer_name")
        .eq("ca_number", ca)
        .maybeSingle();
      if (cancelled) return;
      setLoading(false);
      if (data) {
        setInfo(data as any);
        setNotFound(false);
      } else {
        setInfo(null);
        setNotFound(true);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [caNumber]);

  if (!caNumber.trim()) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Consultando base do MTE...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> CA não encontrado na base do MTE
        </Badge>
      </div>
    );
  }

  if (!info) return null;

  const today = new Date().toISOString().slice(0, 10);
  const expired = info.expiration_date && info.expiration_date < today;
  const statusUpper = (info.status || "").toUpperCase();
  const officiallyInvalid = statusUpper && statusUpper !== "VÁLIDO" && statusUpper !== "VALIDO";

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {expired || officiallyInvalid ? (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {expired ? `Vencido em ${formatBR(info.expiration_date)}` : info.status}
        </Badge>
      ) : (
        <Badge className="gap-1 bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="h-3 w-3" />
          CA válido até {formatBR(info.expiration_date)}
        </Badge>
      )}
      {info.equipment_name && (
        <span className="text-xs text-muted-foreground truncate max-w-[260px]">
          {info.equipment_name}
        </span>
      )}
      {onApply && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => onApply(info)}
        >
          <Wand2 className="mr-1 h-3 w-3" /> Preencher dados oficiais
        </Button>
      )}
    </div>
  );
}

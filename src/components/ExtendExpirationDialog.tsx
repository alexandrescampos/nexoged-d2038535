import { useState, useMemo } from "react";
import { format, parseISO, addMonths } from "date-fns";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nowBrasilia } from "@/lib/timezone";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface DeliveryInfo {
  id: string;
  epiName: string;
  expirationDate: string; // ISO date string (yyyy-MM-dd)
}

interface ExtendExpirationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: DeliveryInfo | null;
  onSuccess: (deliveryId: string) => void;
}

export function ExtendExpirationDialog({
  open,
  onOpenChange,
  delivery,
  onSuccess,
}: ExtendExpirationDialogProps) {
  const [mode, setMode] = useState<"months" | "date">("months");
  const [months, setMonths] = useState(6);
  const [specificDate, setSpecificDate] = useState("");
  const [saving, setSaving] = useState(false);

  const currentExpDate = delivery?.expirationDate
    ? parseISO(delivery.expirationDate)
    : null;

  const newDate = useMemo(() => {
    if (!currentExpDate) return null;
    if (mode === "months") {
      return months > 0 ? addMonths(currentExpDate, months) : null;
    }
    if (specificDate) {
      const d = parseISO(specificDate);
      return d > currentExpDate ? d : null;
    }
    return null;
  }, [mode, months, specificDate, currentExpDate]);

  const isValid = !!newDate;

  const dateError = useMemo(() => {
    if (mode === "date" && specificDate && currentExpDate) {
      const d = parseISO(specificDate);
      if (d <= currentExpDate) {
        return "A nova data deve ser posterior à data de vencimento atual.";
      }
    }
    return null;
  }, [mode, specificDate, currentExpDate]);

  const handleSave = async () => {
    if (!delivery || !newDate) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("epi_deliveries")
        .update({ 
          expiration_date: format(newDate, "yyyy-MM-dd"),
          status: "awaiting_signature",
          signed_term_id: null,
          delivery_date: nowBrasilia(),
          notes: `Validade estendida em ${format(new Date(), "dd/MM/yyyy")}.${delivery.expirationDate ? ` Vencimento original: ${format(parseISO(delivery.expirationDate), "dd/MM/yyyy")}` : ""}`
        })
        .eq("id", delivery.id);

      if (error) throw error;

      toast.success("Validade estendida com sucesso!");
      onSuccess(delivery.id);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao estender validade: " + (err.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMode("months");
      setMonths(6);
      setSpecificDate("");
    }
    onOpenChange(open);
  };

  if (!delivery) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Estender Validade
          </DialogTitle>
          <DialogDescription>
            Informe a extensão em meses ou uma nova data de vencimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* EPI info */}
          <div className="rounded-md border p-3 space-y-1 bg-muted/50">
            <p className="text-sm font-medium">{delivery.epiName}</p>
            <p className="text-sm text-muted-foreground">
              Vencimento atual:{" "}
              <span className="font-medium text-foreground">
                {currentExpDate ? format(currentExpDate, "dd/MM/yyyy") : "-"}
              </span>
            </p>
          </div>

          {/* Mode toggle */}
          <div className="space-y-2">
            <Label>Tipo de extensão</Label>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as "months" | "date")}
              className="justify-start"
            >
              <ToggleGroupItem value="months" className="text-xs">
                Por meses
              </ToggleGroupItem>
              <ToggleGroupItem value="date" className="text-xs">
                Data específica
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {mode === "months" ? (
            <div className="space-y-2">
              <Label>Meses de extensão</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={months}
                onChange={(e) => setMonths(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Nova data de vencimento</Label>
              <Input
                type="date"
                value={specificDate}
                min={currentExpDate ? format(addMonths(currentExpDate, 0), "yyyy-MM-dd") : undefined}
                onChange={(e) => setSpecificDate(e.target.value)}
              />
              {dateError && (
                <p className="text-sm text-destructive">{dateError}</p>
              )}
            </div>
          )}

          {/* Preview */}
          {newDate && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm">
                Nova data de vencimento:{" "}
                <span className="font-semibold text-primary">
                  {format(newDate, "dd/MM/yyyy")}
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

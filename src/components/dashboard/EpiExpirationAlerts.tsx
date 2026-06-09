import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";

export interface EpiAlertItem {
  id: string;
  name: string;
  code: string;
  ca_number: string | null;
  ca_expiration: string; // YYYY-MM-DD
}

export interface EpiDeliveryAlertItem {
  id: string;
  epi_name: string;
  employee_name: string;
  expiration_date: string; // YYYY-MM-DD
  employee_record_id: string;
  delivery_date: string;
  delivered_by: string;
  reason: string | null;
  notes: string | null;
}

interface Props {
  expired: EpiAlertItem[];
  expiringSoon: EpiAlertItem[];
  expiredDeliveries: EpiDeliveryAlertItem[];
  expiringSoonDeliveries: EpiDeliveryAlertItem[];
  isLoading?: boolean;
  error?: string | null;
}

const MAX_ITEMS = 10;

function formatDateBR(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function diffDays(ymd: string): number {
  // diff in days between ymd and today (positive = future)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = ymd.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function EpiExpirationAlerts({ expired, expiringSoon, expiredDeliveries, expiringSoonDeliveries, isLoading, error }: Props) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasAny = expired.length > 0 || expiringSoon.length > 0 || expiredDeliveries.length > 0 || expiringSoonDeliveries.length > 0;

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-muted-foreground">
            Nenhum EPI com CA vencido ou próximo do vencimento.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderList = (items: EpiAlertItem[], variant: "expired" | "soon") => {
    const shown = items.slice(0, MAX_ITEMS);
    const remaining = items.length - shown.length;
    const colorClass = variant === "expired" ? "text-destructive" : "text-warning";
    const Icon = variant === "expired" ? AlertTriangle : Clock;
    const title =
      variant === "expired"
        ? `CAs Vencidos (${items.length})`
        : `CAs Vencendo em até 30 dias (${items.length})`;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className={`h-5 w-5 ${colorClass}`} />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {shown.map((item) => {
            const days = diffDays(item.ca_expiration);
            const label =
              variant === "expired"
                ? `Venceu há ${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"}`
                : days === 0
                ? "Vence hoje"
                : `Vence em ${days} ${days === 1 ? "dia" : "dias"}`;

            return (
              <button
                key={item.id}
                onClick={() => navigate("/dashboard/epi-expiring-report")}
                className="w-full flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.name}
                    <span className="text-muted-foreground font-normal"> · {item.code}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CA {item.ca_number || "—"} · Vencimento {formatDateBR(item.ca_expiration)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={variant === "expired" ? "destructive" : "secondary"}>
                    {label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}

          {remaining > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => navigate("/dashboard/epi-expiring-report")}
            >
              Ver todos ({remaining} restantes)
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderDeliveryList = (items: EpiDeliveryAlertItem[], variant: "expired" | "soon") => {
    const shown = items.slice(0, MAX_ITEMS);
    const remaining = items.length - shown.length;
    const colorClass = variant === "expired" ? "text-destructive" : "text-warning";
    const Icon = variant === "expired" ? AlertTriangle : Clock;
    const title =
      variant === "expired"
        ? `EPIs Vencidos em uso (${items.length})`
        : `EPIs Vencendo em uso (${items.length})`;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className={`h-5 w-5 ${colorClass}`} />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {shown.map((item) => {
            const days = diffDays(item.expiration_date);
            const label =
              variant === "expired"
                ? `Venceu há ${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"}`
                : days === 0
                ? "Vence hoje"
                : `Vence em ${days} ${days === 1 ? "dia" : "dias"}`;

            const handleDeliveryClick = () => {
              // Salvar o estado para o componente EpiDeliveries abrir o diálogo de detalhes
              const groupKey = `${item.employee_record_id || ""}|${item.delivery_date}|${item.delivered_by}|${item.reason || ""}|${item.notes || ""}`;
              localStorage.setItem("epi-deliveries:detailsGroupKey", groupKey);
              navigate("/dashboard/epi-deliveries");
            };

            return (
              <button
                key={item.id}
                onClick={handleDeliveryClick}
                className="w-full flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.epi_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Funcionário: {item.employee_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento do EPI: {formatDateBR(item.expiration_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={variant === "expired" ? "destructive" : "secondary"}>
                    {label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}

          {remaining > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => navigate("/dashboard/epi-deliveries")}
            >
              Ver todas ({remaining} restantes)
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {expired.length > 0 && renderList(expired, "expired")}
        {expiringSoon.length > 0 && renderList(expiringSoon, "soon")}
      </div>
      
      {(expiredDeliveries.length > 0 || expiringSoonDeliveries.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2 pt-2">
          {expiredDeliveries.length > 0 && renderDeliveryList(expiredDeliveries, "expired")}
          {expiringSoonDeliveries.length > 0 && renderDeliveryList(expiringSoonDeliveries, "soon")}
        </div>
      )}
    </div>
  );
}

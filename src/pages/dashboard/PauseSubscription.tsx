import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Pause, Calendar, CheckCircle2, Info } from "lucide-react";

interface SubscriptionInfo {
  subscribed: boolean;
  subscription_status: string | null;
  current_period_end: string | null;
  plan_name: string | null;
  cancel_at_period_end?: boolean;
}

const PAUSE_OPTIONS = [
  { months: 1, label: "1 mês" },
  { months: 2, label: "2 meses" },
  { months: 3, label: "3 meses" },
];

export default function PauseSubscription() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pausing, setPausing] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const [pauseSuccess, setPauseSuccess] = useState(false);
  const [resumeDate, setResumeDate] = useState<string | null>(null);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setSubscription(data);

      // Redirect if not subscribed or already cancelled
      if (!data.subscribed || data.cancel_at_period_end) {
        toast({
          title: "Assinatura não disponível",
          description: "Sua assinatura não pode ser pausada no momento.",
          variant: "destructive",
        });
        navigate("/dashboard/billing");
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
      toast({
        title: "Erro",
        description: "Não foi possível verificar sua assinatura.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateResumeDate = (months: number): string => {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const handlePause = async () => {
    if (!selectedMonths) return;

    setPausing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const { data, error } = await supabase.functions.invoke("pause-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { pause_months: selectedMonths },
      });

      if (error) throw error;

      setPauseSuccess(true);
      setResumeDate(data.resumes_at);

      toast({
        title: "Assinatura pausada",
        description: `Sua assinatura foi pausada por ${selectedMonths} ${selectedMonths === 1 ? "mês" : "meses"}.`,
      });
    } catch (error: any) {
      console.error("Error pausing subscription:", error);
      toast({
        title: "Erro ao pausar",
        description: error.message || "Não foi possível pausar sua assinatura.",
        variant: "destructive",
      });
    } finally {
      setPausing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pauseSuccess) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Assinatura Pausada</CardTitle>
            <CardDescription>
              Sua assinatura foi pausada com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium">{subscription?.plan_name || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Retomada automática</span>
                <span className="font-medium">{formatDate(resumeDate)}</span>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Durante a pausa, você mantém acesso aos seus dados, mas não será cobrado. 
                Você pode retomar sua assinatura a qualquer momento.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/dashboard/billing")}
              >
                Ver Cobrança
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate("/dashboard")}
              >
                Ir para Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Pause className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Pausar Assinatura</CardTitle>
              <CardDescription>
                Pause sua assinatura temporariamente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current subscription info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plano atual</span>
              <span className="font-medium">{subscription?.plan_name || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Próxima cobrança</span>
              <span className="font-medium">{formatDate(subscription?.current_period_end)}</span>
            </div>
          </div>

          {/* Pause duration selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Por quanto tempo deseja pausar?</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PAUSE_OPTIONS.map((option) => (
                <button
                  key={option.months}
                  type="button"
                  onClick={() => setSelectedMonths(option.months)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedMonths === option.months
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">{option.label}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    Retoma: {calculateResumeDate(option.months)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info about pause */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Durante a pausa:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Você mantém acesso aos seus dados</li>
                <li>Não haverá cobranças</li>
                <li>Pode retomar a qualquer momento</li>
                <li>A assinatura retomará automaticamente na data selecionada</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/dashboard/billing")}
              disabled={pausing}
            >
              Manter Assinatura Ativa
            </Button>
            <Button
              className="flex-1"
              onClick={handlePause}
              disabled={!selectedMonths || pausing}
            >
              {pausing ? "Pausando..." : "Confirmar Pausa"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

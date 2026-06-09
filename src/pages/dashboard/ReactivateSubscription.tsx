import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Crown, Loader2, RefreshCcw, Sparkles } from "lucide-react";

interface SubscriptionInfo {
  subscribed: boolean;
  subscription_status: string | null;
  current_period_end: string | null;
  plan_name: string | null;
  cancel_at_period_end: boolean;
}

export default function ReactivateSubscription() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [reactivating, setReactivating] = useState(false);
  const [reactivated, setReactivated] = useState(false);
  const [reactivationResult, setReactivationResult] = useState<{
    next_billing_date: string | null;
    plan_name: string | null;
  } | null>(null);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      setSubscription(data);

      // If not scheduled for cancellation, redirect back
      if (!data?.cancel_at_period_end) {
        toast({
          title: "Assinatura ativa",
          description: "Sua assinatura não está agendada para cancelamento.",
        });
        navigate("/dashboard/billing");
      }
    } catch (error: any) {
      console.error("Error checking subscription:", error);
      toast({
        title: "Erro ao verificar assinatura",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("reactivate-subscription");

      if (error) throw error;

      setReactivated(true);
      setReactivationResult(data);
      toast({
        title: "Assinatura reativada!",
        description: "Sua assinatura foi reativada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao reativar assinatura",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setReactivating(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="container max-w-2xl py-8">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (reactivated && reactivationResult) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="border-green-500/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Assinatura Reativada!</CardTitle>
            <CardDescription>
              Sua assinatura foi reativada com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="grid gap-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-medium">{reactivationResult.plan_name || "Seu plano"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Próxima cobrança</span>
                  <span className="font-medium">{formatDate(reactivationResult.next_billing_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-green-600">Ativa</span>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => navigate("/dashboard/billing")}>
              Voltar para Planos
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate("/dashboard/billing")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Planos
      </Button>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <RefreshCcw className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Reativar Assinatura</CardTitle>
          <CardDescription>
            Sua assinatura está agendada para cancelamento. Deseja reativá-la?
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Subscription Details */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Crown className="h-4 w-4 text-primary" />
              Detalhes do Plano
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plano atual</span>
                <span className="font-medium">{subscription?.plan_name || "Seu plano"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data de cancelamento</span>
                <span className="font-medium text-destructive">
                  {formatDate(subscription?.current_period_end)}
                </span>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <Alert className="border-primary/50 bg-primary/5">
            <Sparkles className="h-4 w-4 text-primary" />
            <AlertTitle>Ao reativar você mantém:</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Todos os seus dados e configurações</li>
                <li>• Acesso contínuo a todas as funcionalidades premium</li>
                <li>• Histórico de uso e relatórios</li>
                <li>• Mesmas condições de pagamento</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/dashboard/billing")}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleReactivate}
            disabled={reactivating}
          >
            {reactivating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reativando...
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reativar Assinatura
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

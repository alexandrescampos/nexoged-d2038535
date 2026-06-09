import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, ArrowRight, Calendar, CreditCard, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SubscriptionData {
  subscribed: boolean;
  plan_name: string | null;
  current_period_end: string | null;
  subscription_status: string | null;
}

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        console.log("Fetching subscription details after payment success...");
        const { data, error } = await supabase.functions.invoke('check-subscription');
        
        if (error) {
          console.error("Error fetching subscription:", error);
          return;
        }
        
        console.log("Subscription data:", data);
        setSubscription(data);
      } catch (err) {
        console.error("Failed to fetch subscription:", err);
      } finally {
        setLoading(false);
      }
    };

    // Small delay to allow Stripe webhook to process
    const timer = setTimeout(fetchSubscription, 1500);
    return () => clearTimeout(timer);
  }, [sessionId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return null;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Ativa</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Período de Teste</Badge>;
      default:
        return <Badge variant="secondary">Processando</Badge>;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 animate-in zoom-in duration-500">
            <CheckCircle2 className="h-10 w-10 text-green-500 animate-in spin-in-180 duration-700" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
            <CardTitle className="text-2xl">Pagamento Confirmado!</CardTitle>
            <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
          </div>
          <CardDescription>
            Sua assinatura foi ativada com sucesso. Você já pode aproveitar todos os recursos do seu novo plano.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <Skeleton className="h-4 w-3/4 mx-auto" />
              <Skeleton className="h-4 w-1/2 mx-auto" />
              <Skeleton className="h-4 w-2/3 mx-auto" />
            </div>
          ) : subscription?.subscribed ? (
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Detalhes da Assinatura
              </h4>
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Plano:</span>
                </div>
                <span className="font-medium">{subscription.plan_name || "Profissional"}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                </div>
                {getStatusBadge(subscription.subscription_status)}
              </div>
              
              {subscription.current_period_end && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Próxima cobrança:</span>
                  </div>
                  <span className="font-medium text-sm">
                    {formatDate(subscription.current_period_end)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Um email de confirmação foi enviado para você com os detalhes da sua assinatura.
            </p>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={() => navigate("/dashboard/billing")} className="w-full">
            Ver Detalhes da Assinatura
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
            Ir para o Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

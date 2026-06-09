import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, CreditCard, Crown, Loader2, RefreshCw, ExternalLink, XCircle, RefreshCcw, Pause, Play, FileText, HardDrive } from "lucide-react";
import { UsageIndicator } from "@/components/dashboard/UsageIndicator";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  max_users: number | null;
  max_pages: number | null;
  max_storage_gb: number | null;
  features: string[];
  is_highlighted: boolean;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  stripe_product_id: string | null;
}

interface SubscriptionInfo {
  subscribed: boolean;
  subscription_status: string | null;
  current_period_end: string | null;
  product_id: string | null;
  price_id: string | null;
  plan_name: string | null;
  cancel_at_period_end: boolean;
  pause_collection: {
    behavior: string;
    resumes_at: string | null;
  } | null;
}

export default function Billing() {
  const navigate = useNavigate();
  const { organization, isOrgAdmin } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetchPlans();
    checkSubscription();
  }, []);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar planos", description: error.message, variant: "destructive" });
      return;
    }

    const parsedPlans = data.map((plan) => ({
      ...plan,
      features: Array.isArray(plan.features) ? plan.features.filter((f): f is string => typeof f === "string") : [],
    })) as Plan[];

    setPlans(parsedPlans);
    setLoading(false);
  };

  const checkSubscription = async () => {
    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      setSubscription(data);
    } catch (error: any) {
      console.error("Error checking subscription:", error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleCheckout = async (plan: Plan) => {
    const priceId = isYearly ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;

    if (!priceId) {
      toast({
        title: "Plano não configurado",
        description: "Este plano ainda não foi sincronizado com o Stripe. Contate o administrador.",
        variant: "destructive",
      });
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, billingPeriod: isYearly ? "yearly" : "monthly" },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar checkout",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao abrir portal",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "Grátis";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price / 100);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const isCurrentPlan = (plan: Plan) => {
    if (!subscription?.price_id) return false;
    return (
      plan.stripe_price_id_monthly === subscription.price_id || plan.stripe_price_id_yearly === subscription.price_id
    );
  };

  const getStatusBadge = (status: string | null, isPaused: boolean) => {
    if (isPaused) {
      return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">Pausada</Badge>;
    }
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Ativa</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">Período de Teste</Badge>;
      case "past_due":
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Pagamento Pendente</Badge>;
      case "canceled":
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">Sem Assinatura</Badge>;
    }
  };

  const isPaused = !!subscription?.pause_collection;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assinatura e Uso</h1>
        <p className="text-muted-foreground">Gerencie seu plano e acompanhe o consumo de recursos</p>
      </div>

      <UsageIndicator />

      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Status da Assinatura
              </CardTitle>
              <CardDescription>Informações sobre seu plano atual</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={checkSubscription} disabled={checkingSubscription}>
              {checkingSubscription ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Atualizar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">{getStatusBadge(subscription?.subscription_status, isPaused)}</div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plano Atual</p>
              <p className="mt-1 font-medium">{subscription?.plan_name || organization?.plan || "Nenhum"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {isPaused ? "Retomada Automática" : subscription?.cancel_at_period_end ? "Cancela em" : "Próxima Cobrança"}
              </p>
              <p className="mt-1 font-medium">
                {isPaused
                  ? formatDate(subscription?.pause_collection?.resumes_at)
                  : subscription?.cancel_at_period_end
                    ? formatDate(subscription.current_period_end)
                    : formatDate(subscription?.current_period_end)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Organização</p>
              <p className="mt-1 font-medium">{organization?.name}</p>
            </div>
          </div>
        </CardContent>
        {subscription?.subscribed && isOrgAdmin && (
          <CardFooter className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleManageSubscription} disabled={portalLoading}>
              {portalLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Gerenciar Assinatura
            </Button>
            {isPaused ? (
              <Button 
                variant="default"
                onClick={() => navigate("/dashboard/resume-from-pause")}
              >
                <Play className="mr-2 h-4 w-4" />
                Retomar Assinatura
              </Button>
            ) : subscription?.cancel_at_period_end ? (
              <Button 
                variant="default"
                onClick={() => navigate("/dashboard/reactivate-subscription")}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reativar Assinatura
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline"
                  onClick={() => navigate("/dashboard/pause-subscription")}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar Assinatura
                </Button>
                <Button 
                  variant="ghost" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => navigate("/dashboard/cancel-subscription")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar Assinatura
                </Button>
              </>
            )}
          </CardFooter>
        )}
      </Card>


      {/* Managed Plan Card */}
      {organization?.is_plan_managed ? (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-primary/20 p-4">
              <Crown className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Plano Gerenciado pelo Administrador</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Sua organização possui um plano especial atribuído manualmente pelo administrador do sistema.
              Para alterar seu plano, entre em contato com o administrador.
            </p>
            <Badge variant="secondary" className="text-base px-4 py-1.5">
              <Crown className="mr-2 h-4 w-4" />
              {plans.find(p => p.slug === organization?.plan)?.name || organization?.plan || "Plano Especial"}
            </Badge>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Billing Period Toggle */}
          <div className="flex items-center justify-center gap-4">
            <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
              Mensal
            </Label>
            <Switch id="billing-toggle" checked={isYearly} onCheckedChange={setIsYearly} />
            <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold" : "text-muted-foreground"}>
              Anual
              <Badge variant="secondary" className="ml-2">
                Economize 20%
              </Badge>
            </Label>
          </div>

          {/* Plans Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = isCurrentPlan(plan);
              const price = isYearly ? plan.price_yearly : plan.price_monthly;
              const priceId = isYearly ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;
              const hasStripePrice = !!priceId;

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${
                    plan.is_highlighted ? "border-primary shadow-lg ring-2 ring-primary/20" : ""
                  } ${isCurrent ? "border-green-500 ring-2 ring-green-500/20" : ""}`}
                >
                  {plan.is_highlighted && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        <Crown className="mr-1 h-3 w-3" />
                        Mais Popular
                      </Badge>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-green-500 text-white">
                        <Check className="mr-1 h-3 w-3" />
                        Seu Plano
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">{formatPrice(price)}</span>
                      {price !== null && <span className="text-muted-foreground">/{isYearly ? "ano" : "mês"}</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3">
                      {plan.max_pages && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Até {plan.max_pages.toLocaleString()} páginas</span>
                        </li>
                      )}
                      {plan.max_storage_gb && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{plan.max_storage_gb}GB de armazenamento</span>
                        </li>
                      )}
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    {isCurrent ? (
                      <Button className="w-full" variant="outline" disabled>
                        Plano Atual
                      </Button>
                    ) : isOrgAdmin ? (
                      <Button
                        className="w-full"
                        variant={plan.is_highlighted ? "default" : "outline"}
                        onClick={() => handleCheckout(plan)}
                        disabled={checkoutLoading === plan.id || !hasStripePrice}
                      >
                        {checkoutLoading === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {!hasStripePrice ? "Em breve" : subscription?.subscribed ? "Alterar Plano" : "Assinar"}
                      </Button>
                    ) : (
                      <Button className="w-full" variant="outline" disabled>
                        Contate o Admin
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {plans.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">Nenhum plano disponível no momento.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  ArrowLeft, 
  CheckCircle2, 
  CreditCard, 
  Loader2,
  Calendar,
  XCircle,
  Pause
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SubscriptionInfo {
  subscribed: boolean;
  subscription_status: string | null;
  current_period_end: string | null;
  plan_name: string | null;
  cancel_at_period_end: boolean;
}

const CANCELLATION_REASONS = [
  { value: "price_too_high", label: "O preço está muito alto" },
  { value: "not_using_enough", label: "Não estou usando o suficiente" },
  { value: "found_alternative", label: "Encontrei uma alternativa melhor" },
  { value: "missing_features", label: "Faltam funcionalidades que preciso" },
  { value: "technical_issues", label: "Problemas técnicos" },
  { value: "temporary_pause", label: "Vou pausar temporariamente" },
  { value: "other", label: "Outro motivo" },
];

export default function CancelSubscription() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOrgAdmin } = useAuth();
  
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [cancelDate, setCancelDate] = useState<string | null>(null);
  
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      setSubscription(data);
      
      // If already set to cancel, show canceled state
      if (data?.cancel_at_period_end) {
        setCanceled(true);
        setCancelDate(data.current_period_end);
      }
    } catch (error: any) {
      console.error("Error checking subscription:", error);
      toast({
        title: "Erro ao carregar assinatura",
        description: "Não foi possível carregar os dados da assinatura.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedReason) {
      toast({
        title: "Selecione um motivo",
        description: "Por favor, selecione um motivo para o cancelamento.",
        variant: "destructive",
      });
      return;
    }

    setCanceling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { 
          reason: CANCELLATION_REASONS.find(r => r.value === selectedReason)?.label || selectedReason,
          feedback: feedback || null 
        },
      });

      if (error) throw error;

      setCanceled(true);
      setCancelDate(data.cancel_at);
      toast({
        title: "Assinatura cancelada",
        description: "Sua assinatura foi agendada para cancelamento.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Não foi possível cancelar a assinatura.",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!subscription?.subscribed) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhuma assinatura ativa</h2>
            <p className="text-muted-foreground mb-4">
              Você não possui uma assinatura ativa para cancelar.
            </p>
            <Button variant="outline" onClick={() => navigate("/dashboard/billing")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Planos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (canceled) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-orange-100 p-3 mb-4">
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Cancelamento Agendado</h2>
            <p className="text-muted-foreground text-center mb-4">
              Sua assinatura do plano <span className="font-medium">{subscription?.plan_name}</span> será 
              encerrada em <span className="font-medium">{formatDate(cancelDate)}</span>.
            </p>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Você continuará tendo acesso a todos os recursos até essa data.
              Se mudar de ideia, você pode reativar sua assinatura a qualquer momento.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/dashboard/billing")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Planos
              </Button>
              <Button onClick={() => navigate("/dashboard")}>
                Ir para o Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/billing")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cancelar Assinatura</h1>
          <p className="text-muted-foreground">Sentimos muito em ver você partir</p>
        </div>
      </div>

      {/* Current Plan Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Seu Plano Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Plano</p>
              <p className="font-medium">{subscription?.plan_name || "Plano Atual"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Próxima cobrança</p>
              <p className="font-medium">{formatDate(subscription?.current_period_end)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Por que você está cancelando?</CardTitle>
          <CardDescription>
            Seu feedback nos ajuda a melhorar nosso serviço
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            {CANCELLATION_REASONS.map((reason) => (
              <div key={reason.value} className="flex items-center space-x-3">
                <RadioGroupItem value={reason.value} id={reason.value} />
                <Label htmlFor={reason.value} className="cursor-pointer">
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {/* Pause option when "temporary_pause" is selected */}
          {selectedReason === "temporary_pause" && (
            <Alert className="bg-primary/5 border-primary/20">
              <Pause className="h-4 w-4 text-primary" />
              <AlertTitle>Prefere pausar em vez de cancelar?</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Você pode pausar sua assinatura por 1-3 meses sem perder seus dados. 
                  Nenhuma cobrança será feita durante a pausa.
                </p>
                <Button 
                  variant="outline" 
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={() => navigate("/dashboard/pause-subscription")}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar em vez de Cancelar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="feedback">Quer nos contar mais? (opcional)</Label>
            <Textarea
              id="feedback"
              placeholder="Compartilhe mais detalhes sobre sua experiência..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
          </div>

          <Separator />

          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Ao cancelar sua assinatura:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Você perderá acesso aos recursos premium após {formatDate(subscription?.current_period_end)}</li>
                <li>Seus dados serão mantidos, mas com limitações do plano gratuito</li>
                <li>Você pode reativar sua assinatura a qualquer momento</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-between gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/dashboard/billing")}
            className="flex-1"
          >
            Manter Assinatura
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCancel}
            disabled={canceling || !selectedReason}
            className="flex-1"
          >
            {canceling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              "Confirmar Cancelamento"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

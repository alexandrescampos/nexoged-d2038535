import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Play, Calendar, CheckCircle2, Info } from "lucide-react";

interface PauseInfo {
  pause_collection_behavior: string | null;
  pause_collection_resumes_at: string | null;
}

export default function ResumeFromPause() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pauseInfo, setPauseInfo] = useState<PauseInfo | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState(false);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);

  useEffect(() => {
    checkPauseStatus();
  }, []);

  const checkPauseStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Get profile to get organization_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        throw new Error("Organização não encontrada");
      }

      // Get stripe_config for pause info
      const { data: stripeConfig, error: configError } = await supabase
        .from("stripe_config")
        .select("pause_collection_behavior, pause_collection_resumes_at")
        .eq("organization_id", profile.organization_id)
        .maybeSingle();

      if (configError) throw configError;

      // Check if subscription is actually paused
      if (!stripeConfig?.pause_collection_behavior) {
        toast({
          title: "Assinatura não pausada",
          description: "Sua assinatura não está pausada.",
        });
        navigate("/dashboard/billing");
        return;
      }

      setPauseInfo(stripeConfig);

      // Get subscription info for plan name
      const { data: subscriptionData } = await supabase.functions.invoke("check-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (subscriptionData?.plan_name) {
        setPlanName(subscriptionData.plan_name);
      }
    } catch (error) {
      console.error("Error checking pause status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível verificar o status da pausa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const { data, error } = await supabase.functions.invoke("resume-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setResumeSuccess(true);
      setNextBillingDate(data.next_billing_date);

      toast({
        title: "Assinatura retomada",
        description: "Sua assinatura foi retomada com sucesso!",
      });
    } catch (error: any) {
      console.error("Error resuming subscription:", error);
      toast({
        title: "Erro ao retomar",
        description: error.message || "Não foi possível retomar sua assinatura.",
        variant: "destructive",
      });
    } finally {
      setResuming(false);
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
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resumeSuccess) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Assinatura Retomada!</CardTitle>
            <CardDescription>
              Sua assinatura está ativa novamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium">{planName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Próxima cobrança</span>
                <span className="font-medium">{formatDate(nextBillingDate)}</span>
              </div>
            </div>

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
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Retomar Assinatura</CardTitle>
              <CardDescription>
                Reative sua assinatura pausada
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pause info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plano</span>
              <span className="font-medium">{planName || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Retomada automática</span>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {formatDate(pauseInfo?.pause_collection_resumes_at)}
                </span>
              </div>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Se você retomar agora, a cobrança será feita imediatamente e seu acesso 
              completo será restaurado. Caso contrário, sua assinatura retomará 
              automaticamente na data programada.
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/dashboard/billing")}
              disabled={resuming}
            >
              Manter Pausada
            </Button>
            <Button
              className="flex-1"
              onClick={handleResume}
              disabled={resuming}
            >
              <Play className="mr-2 h-4 w-4" />
              {resuming ? "Retomando..." : "Retomar Agora"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

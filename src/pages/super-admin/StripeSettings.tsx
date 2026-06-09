import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, CreditCard, CheckCircle, XCircle, Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StripeConfig {
  id: string;
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  organization?: {
    name: string;
    slug: string;
  };
}

interface Plan {
  id: string;
  name: string;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  is_active: boolean;
}

export default function StripeSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stripeConfigs, setStripeConfigs] = useState<StripeConfig[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const { toast } = useToast();

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch stripe configs with organization info
      const { data: configs, error: configError } = await supabase
        .from("stripe_config")
        .select(`
          *,
          organization:organizations(name, slug)
        `);

      if (configError) throw configError;

      // Fetch plans
      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("id, name, stripe_product_id, stripe_price_id_monthly, stripe_price_id_yearly, is_active")
        .order("display_order");

      if (plansError) throw plansError;

      setStripeConfigs(configs || []);
      setPlans(plansData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAllPlans = async () => {
    try {
      setSyncing(true);

      const { data, error } = await supabase.functions.invoke("stripe-sync", {
        body: { syncAll: true },
      });

      if (error) throw error;

      toast({
        title: "Sincronização concluída!",
        description: `${data.results?.length || 0} planos sincronizados com Stripe.`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado para a área de transferência!" });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Ativa</Badge>;
      case "past_due":
        return <Badge variant="destructive">Pagamento Pendente</Badge>;
      case "canceled":
        return <Badge variant="secondary">Cancelada</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500">Trial</Badge>;
      default:
        return <Badge variant="outline">{status || "N/A"}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const syncedPlans = plans.filter((p) => p.stripe_product_id);
  const unsyncedPlans = plans.filter((p) => !p.stripe_product_id && p.is_active);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações Stripe</h1>
        <p className="text-muted-foreground">Gerencie a integração com o Stripe</p>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Sincronizados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncedPlans.length}</div>
            <p className="text-xs text-muted-foreground">de {plans.length} planos totais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Sync</CardTitle>
            <XCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unsyncedPlans.length}</div>
            <p className="text-xs text-muted-foreground">planos ativos sem produto Stripe</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stripeConfigs.filter((c) => c.subscription_status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">organizações pagantes</p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Sincronização de Planos</CardTitle>
          <CardDescription>
            Sincronize todos os planos ativos com o Stripe para criar produtos e preços.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button onClick={handleSyncAllPlans} disabled={syncing || loading}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar Todos os Planos
          </Button>

          {unsyncedPlans.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {unsyncedPlans.length} plano(s) ativo(s) aguardando sincronização
            </p>
          )}
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração do Webhook</CardTitle>
          <CardDescription>
            Configure este endpoint no painel do Stripe para receber eventos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Eventos a configurar</Label>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <code className="bg-muted px-2 py-1 rounded">customer.subscription.created</code>
              <code className="bg-muted px-2 py-1 rounded">customer.subscription.updated</code>
              <code className="bg-muted px-2 py-1 rounded">customer.subscription.deleted</code>
              <code className="bg-muted px-2 py-1 rounded">invoice.paid</code>
              <code className="bg-muted px-2 py-1 rounded">invoice.payment_failed</code>
              <code className="bg-muted px-2 py-1 rounded">checkout.session.completed</code>
            </div>
          </div>

          <Button variant="outline" asChild>
            <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir Painel Stripe
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Active Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Assinaturas por Organização</CardTitle>
          <CardDescription>Organizações com configuração de cobrança Stripe.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stripeConfigs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma organização com configuração Stripe ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Válido até</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stripeConfigs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">
                      {config.organization?.name || "Organização não encontrada"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {config.stripe_customer_id || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(config.subscription_status)}</TableCell>
                    <TableCell>{formatDate(config.current_period_end)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

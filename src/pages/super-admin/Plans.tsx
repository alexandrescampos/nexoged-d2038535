import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Plus, MoreHorizontal, Pencil, Trash2, Loader2, Star, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  max_users: number | null;
  features: string[];
  is_active: boolean;
  is_highlighted: boolean;
  display_order: number;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  created_at: string;
  updated_at: string;
}

interface PlanFormData {
  name: string;
  slug: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  max_users: string;
  features: string[];
  is_active: boolean;
  is_highlighted: boolean;
  display_order: string;
}

const initialFormData: PlanFormData = {
  name: "",
  slug: "",
  description: "",
  price_monthly: "",
  price_yearly: "",
  max_users: "",
  features: [],
  is_active: true,
  is_highlighted: false,
  display_order: "0",
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(initialFormData);
  const [newFeature, setNewFeature] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;

      const plansWithFeatures = (data || []).map((plan) => ({
        ...plan,
        features: Array.isArray(plan.features) 
          ? plan.features.map((f: unknown) => String(f)) 
          : [],
      })) as Plan[];

      setPlans(plansWithFeatures);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar planos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingPlan ? prev.slug : generateSlug(name),
    }));
  };

  const openCreateDialog = () => {
    setEditingPlan(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      price_monthly: plan.price_monthly?.toString() || "",
      price_yearly: plan.price_yearly?.toString() || "",
      max_users: plan.max_users?.toString() || "",
      features: plan.features,
      is_active: plan.is_active,
      is_highlighted: plan.is_highlighted,
      display_order: plan.display_order?.toString() || "0",
    });
    setDialogOpen(true);
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, newFeature.trim()],
      }));
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e slug são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const planData = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        price_monthly: formData.price_monthly ? parseInt(formData.price_monthly) : null,
        price_yearly: formData.price_yearly ? parseInt(formData.price_yearly) : null,
        max_users: formData.max_users ? parseInt(formData.max_users) : null,
        features: formData.features,
        is_active: formData.is_active,
        is_highlighted: formData.is_highlighted,
        display_order: parseInt(formData.display_order) || 0,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("plans")
          .update(planData)
          .eq("id", editingPlan.id);

        if (error) throw error;

        toast({ title: "Plano atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("plans").insert([planData]);

        if (error) throw error;

        toast({ title: "Plano criado com sucesso!" });
      }

      setDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar plano",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from("plans")
        .update({ is_active: !plan.is_active })
        .eq("id", plan.id);

      if (error) throw error;

      toast({
        title: plan.is_active ? "Plano desativado" : "Plano ativado",
      });
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar plano",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Tem certeza que deseja excluir o plano "${plan.name}"?`)) return;

    try {
      const { error } = await supabase.from("plans").delete().eq("id", plan.id);

      if (error) throw error;

      toast({ title: "Plano excluído com sucesso!" });
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir plano",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSyncStripe = async (plan: Plan) => {
    try {
      setSyncing(true);
      
      const { data, error } = await supabase.functions.invoke("stripe-sync", {
        body: { planId: plan.id },
      });

      if (error) throw error;

      toast({ title: "Plano sincronizado com Stripe!" });
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Erro ao sincronizar com Stripe",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const formatPrice = (cents: number | null) => {
    if (!cents) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Planos</h1>
          <p className="text-muted-foreground">Gerencie os planos de assinatura por número de funcionários</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Planos</CardTitle>
          <CardDescription>
            Todos os planos disponíveis no sistema. Preços em centavos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum plano cadastrado. Clique em "Novo Plano" para criar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Mensal</TableHead>
                  <TableHead>Anual</TableHead>
                  <TableHead>Funcionários</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stripe</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {plan.name}
                        {plan.is_highlighted && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{plan.slug}</TableCell>
                    <TableCell>{formatPrice(plan.price_monthly)}</TableCell>
                    <TableCell>{formatPrice(plan.price_yearly)}</TableCell>
                    <TableCell>{plan.max_users ?? "∞"}</TableCell>
                    <TableCell>
                      <Badge variant={plan.is_active ? "default" : "secondary"}>
                        {plan.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {plan.stripe_product_id ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Sincronizado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Não sincronizado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(plan)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(plan)}>
                            {plan.is_active ? "Desativar" : "Ativar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleSyncStripe(plan)}
                            disabled={syncing}
                          >
                            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                            Sincronizar Stripe
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(plan)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar Plano" : "Novo Plano"}</DialogTitle>
            <DialogDescription>
              {editingPlan
                ? "Atualize as informações do plano."
                : "Preencha os dados para criar um novo plano."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Profissional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="Ex: professional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Descrição curta do plano"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_monthly">Preço Mensal (centavos)</Label>
                <Input
                  id="price_monthly"
                  type="number"
                  value={formData.price_monthly}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price_monthly: e.target.value }))
                  }
                  placeholder="9900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_yearly">Preço Anual (centavos)</Label>
                <Input
                  id="price_yearly"
                  type="number"
                  value={formData.price_yearly}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price_yearly: e.target.value }))
                  }
                  placeholder="99900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_users">Max Funcionários</Label>
                <Input
                  id="max_users"
                  type="number"
                  value={formData.max_users}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, max_users: e.target.value }))
                  }
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Features</Label>
              <div className="flex gap-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="Ex: Suporte prioritário"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                />
                <Button type="button" variant="outline" onClick={addFeature}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.features.map((feature, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {feature}
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_order">Ordem de Exibição</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, display_order: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_active: checked }))
                  }
                />
                <Label htmlFor="is_active">Plano Ativo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_highlighted"
                  checked={formData.is_highlighted}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_highlighted: checked }))
                  }
                />
                <Label htmlFor="is_highlighted">Plano Destacado</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPlan ? "Salvar Alterações" : "Criar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

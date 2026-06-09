import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, MoreHorizontal, Building2, Search, Loader2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { validateCNPJ, maskCNPJ, cleanCNPJ, formatCNPJ } from "@/lib/cnpj";
import type { Organization, OrgStatus } from "@/types/auth";
import ApiIntegrationSettings from "@/components/dashboard/ApiIntegrationSettings";
import OrganizationDataExport from "@/components/dashboard/OrganizationDataExport";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const statusLabels: Record<OrgStatus, string> = {
  active: "Ativa",
  suspended: "Suspensa",
  trial: "Trial",
};

const statusColors: Record<OrgStatus, string> = {
  active: "bg-success/10 text-success border-success/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
  trial: "bg-warning/10 text-warning border-warning/20",
};

interface OrgFormData {
  name: string;
  slug: string;
  plan: string;
  max_users: number;
  is_plan_managed: boolean;
  cnpj: string;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  max_users: number | null;
  is_active: boolean;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [apiDialogOrg, setApiDialogOrg] = useState<Organization | null>(null);
  const [exportDialogOrg, setExportDialogOrg] = useState<Organization | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [formData, setFormData] = useState<OrgFormData>({
    name: "",
    slug: "",
    plan: "",
    max_users: 10,
    is_plan_managed: false,
    cnpj: "",
  });
  const { toast } = useToast();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    let query = supabase
      .from("organizations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (debouncedSearch) {
      query = query.or(`name.ilike.%${debouncedSearch}%,slug.ilike.%${debouncedSearch}%`);
    }

    const { data: orgsData, error: orgsError, count } = await query.range(from, to);

    if (orgsError) {
      toast({ variant: "destructive", title: "Erro ao carregar organizações", description: orgsError.message });
      setIsLoading(false);
      return;
    }

    const orgs = (orgsData || []) as Organization[];
    setOrganizations(orgs);
    setTotalCount(count || 0);

    // Fetch user counts for organizations on current page
    if (orgs.length > 0) {
      setEmployeeCounts({});
    }

    setIsLoading(false);
  };

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, slug, max_users, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!error && data) {
      setPlans(data);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [currentPage, debouncedSearch, itemsPerPage]);

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: editingOrg ? formData.slug : generateSlug(name),
    });
  };

  const resetForm = () => {
    const defaultPlan = plans[0];
    setFormData({ 
      name: "", 
      slug: "", 
      plan: defaultPlan?.slug || "", 
      max_users: defaultPlan?.max_users ?? 10,
      is_plan_managed: false,
      cnpj: "",
    });
    setEditingOrg(null);
    setLogoUrl(null);
    setPendingLogoFile(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (org: Organization) => {
    setEditingOrg(org);
    const orgPlan = plans.find(p => p.slug === org.plan);
    setFormData({
      name: org.name,
      slug: org.slug,
      plan: org.plan || plans[0]?.slug || "",
      max_users: org.max_users ?? orgPlan?.max_users ?? 10,
      is_plan_managed: org.is_plan_managed ?? false,
      cnpj: org.cnpj ? formatCNPJ(org.cnpj) : "",
    });
    setLogoUrl(org.logo_url ?? null);
    setPendingLogoFile(null);
    setIsDialogOpen(true);
  };

  const validateLogoFile = (file: File): boolean => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas imagens JPG, PNG ou WebP são permitidas.",
        variant: "destructive",
      });
      return false;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 2MB.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const uploadLogoForOrg = async (orgId: string, file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const filePath = `${orgId}/logo.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("organization-logos")
      .upload(filePath, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage
      .from("organization-logos")
      .getPublicUrl(filePath);
    return `${publicUrl}?t=${Date.now()}`;
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!validateLogoFile(file)) return;

    // Em edição: faz upload imediato. Em criação: guarda em memória.
    if (editingOrg) {
      setIsUploadingLogo(true);
      try {
        const url = await uploadLogoForOrg(editingOrg.id, file);
        setLogoUrl(url);
        toast({ title: "Logo enviado", description: "Salve as alterações para aplicar." });
      } catch (error) {
        console.error("Error uploading logo:", error);
        toast({ title: "Erro ao enviar logo", description: "Tente novamente.", variant: "destructive" });
      } finally {
        setIsUploadingLogo(false);
      }
    } else {
      setPendingLogoFile(file);
      setLogoUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }

    const cnpjCleaned = cleanCNPJ(formData.cnpj);
    if (cnpjCleaned && !validateCNPJ(cnpjCleaned)) {
      toast({ variant: "destructive", title: "CNPJ inválido", description: "Verifique o CNPJ informado" });
      return;
    }

    setIsSaving(true);

    if (editingOrg) {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: formData.name,
          slug: formData.slug,
          plan: formData.plan,
          max_users: formData.max_users,
          is_plan_managed: formData.is_plan_managed,
          cnpj: cnpjCleaned || null,
          logo_url: logoUrl,
        })
        .eq("id", editingOrg.id);

      if (error) {
        toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
      } else {
        toast({ title: "Organização atualizada com sucesso" });
        setIsDialogOpen(false);
        fetchOrganizations();
      }
    } else {
      const { data: created, error } = await supabase
        .from("organizations")
        .insert({
          name: formData.name,
          slug: formData.slug,
          plan: formData.plan,
          max_users: formData.max_users,
          is_plan_managed: formData.is_plan_managed,
          cnpj: cnpjCleaned || null,
          status: "active",
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes("duplicate")) {
          toast({ variant: "destructive", title: "Slug já existe", description: "Escolha outro identificador" });
        } else {
          toast({ variant: "destructive", title: "Erro ao criar", description: error.message });
        }
      } else {
        // Upload do logo (se houver) após criar a organização
        if (created && pendingLogoFile) {
          try {
            const url = await uploadLogoForOrg(created.id, pendingLogoFile);
            if (url) {
              await supabase
                .from("organizations")
                .update({ logo_url: url })
                .eq("id", created.id);
            }
          } catch (uploadErr) {
            console.error("Error uploading logo after create:", uploadErr);
            toast({
              title: "Organização criada, mas o logo falhou",
              description: "Edite a organização para tentar novamente.",
              variant: "destructive",
            });
          }
        }
        toast({ title: "Organização criada com sucesso" });
        setIsDialogOpen(false);
        resetForm();
        fetchOrganizations();
      }
    }
    setIsSaving(false);
  };

  const handleStatusChange = async (org: Organization, newStatus: OrgStatus) => {
    const { error } = await supabase
      .from("organizations")
      .update({ status: newStatus })
      .eq("id", org.id);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao alterar status", description: error.message });
    } else {
      toast({ title: `Organização ${statusLabels[newStatus].toLowerCase()}` });
      fetchOrganizations();
    }
  };

  const getPlanName = (planSlug: string | null | undefined): string => {
    if (!planSlug) return "Sem plano";
    const plan = plans.find(p => p.slug === planSlug);
    return plan?.name || planSlug;
  };

  const saOrgSort = useTableSort(organizations);
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const getVisiblePages = () => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (Math.abs(i - currentPage) <= 2 || i === 1 || i === totalPages) {
        pages.push(i);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Organizações</h1>
          <p className="text-muted-foreground">Gerencie as organizações do sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Organização
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingOrg ? "Editar Organização" : "Nova Organização"}</DialogTitle>
              <DialogDescription>
                {editingOrg ? "Atualize os dados da organização" : "Preencha os dados para criar uma nova organização"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 rounded-md">
                  {logoUrl ? (
                    <AvatarImage src={logoUrl} alt="Logo" className="object-contain" />
                  ) : null}
                  <AvatarFallback className="rounded-md bg-muted">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="logo-upload">Logo da empresa</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleLogoChange}
                      disabled={isUploadingLogo}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("logo-upload")?.click()}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {logoUrl ? "Trocar logo" : "Selecionar logo"}
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setLogoUrl(null); setPendingLogoFile(null); }}
                        disabled={isUploadingLogo}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG ou WebP até 2MB</p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Nome da organização"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Identificador (slug) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="identificador-unico"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan">Plano</Label>
                <Select 
                  value={formData.plan} 
                  onValueChange={(v) => {
                    const selectedPlan = plans.find(p => p.slug === v);
                    setFormData({ 
                      ...formData, 
                      plan: v,
                      max_users: selectedPlan?.max_users ?? 999999,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                <SelectContent>
                    {plans.length === 0 ? (
                      <div className="py-2 px-3 text-sm text-muted-foreground">Nenhum plano cadastrado</div>
                    ) : (
                      plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.slug}>
                          {plan.name} ({plan.max_users ? `${plan.max_users} funcionários` : "ilimitado"})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const selectedPlan = plans.find(p => p.slug === formData.plan);
                const isUnlimited = selectedPlan?.max_users === null;
                return (
                  <div className="grid gap-2">
                    <Label htmlFor="max_users">Máx. Funcionários</Label>
                    <Input
                      id="max_users"
                      type="number"
                      value={isUnlimited ? "" : formData.max_users}
                      onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 10 })}
                      disabled={isUnlimited}
                      placeholder={isUnlimited ? "Ilimitado" : undefined}
                    />
                    {isUnlimited && (
                      <p className="text-xs text-muted-foreground">Ilimitado neste plano</p>
                    )}
                  </div>
                );
              })()}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_plan_managed">Plano Gerenciado</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, o admin da org não pode alterar o plano
                  </p>
                </div>
                <Switch
                  id="is_plan_managed"
                  checked={formData.is_plan_managed}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_plan_managed: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingOrg ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!apiDialogOrg} onOpenChange={(open) => !open && setApiDialogOrg(null)}>
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>Integração por API</DialogTitle>
              <DialogDescription>
                Gere, regenere ou revogue a X-API-Key da organização selecionada.
              </DialogDescription>
            </DialogHeader>
            {apiDialogOrg && (
              <ApiIntegrationSettings
                organizationId={apiDialogOrg.id}
                organizationName={apiDialogOrg.name}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!exportDialogOrg} onOpenChange={(open) => !open && setExportDialogOrg(null)}>
          <DialogContent className="sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle>Exportar dados da organização</DialogTitle>
              <DialogDescription>
                Baixe um snapshot JSON com os dados cadastrais desta organização.
              </DialogDescription>
            </DialogHeader>
            {exportDialogOrg && (
              <OrganizationDataExport
                organizationId={exportDialogOrg.id}
                organizationName={exportDialogOrg.name}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar organizações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {totalCount} organização(ões)
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhuma organização encontrada</h3>
              <p className="text-sm text-muted-foreground">Crie a primeira organização para começar</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead field="name" sortField={saOrgSort.sortField} sortDirection={saOrgSort.sortDirection} onSort={saOrgSort.handleSort}>Nome</SortableTableHead>
                    <SortableTableHead field="cnpj" sortField={saOrgSort.sortField} sortDirection={saOrgSort.sortDirection} onSort={saOrgSort.handleSort}>CNPJ</SortableTableHead>
                    <SortableTableHead field="slug" sortField={saOrgSort.sortField} sortDirection={saOrgSort.sortDirection} onSort={saOrgSort.handleSort}>Slug</SortableTableHead>
                    <SortableTableHead field="plan" sortField={saOrgSort.sortField} sortDirection={saOrgSort.sortDirection} onSort={saOrgSort.handleSort}>Plano</SortableTableHead>
                    <SortableTableHead field="status" sortField={saOrgSort.sortField} sortDirection={saOrgSort.sortDirection} onSort={saOrgSort.handleSort}>Status</SortableTableHead>
                    <TableHead>Limites</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saOrgSort.sortedItems.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-md">
                            {org.logo_url ? (
                              <AvatarImage src={org.logo_url} alt={org.name} className="object-contain" />
                            ) : null}
                            <AvatarFallback className="rounded-md bg-muted">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <span>{org.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{org.cnpj ? formatCNPJ(org.cnpj) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                      <TableCell>{getPlanName(org.plan)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[org.status]}>
                          {statusLabels[org.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">
                          {org.max_users === null || org.max_users >= 999999 ? "∞" : org.max_users}
                        </span>
                        <span className="text-muted-foreground ml-1">usuários</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(org)}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setApiDialogOrg(org)}>
                              Gerenciar API
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setExportDialogOrg(org)}>
                              Exportar dados
                            </DropdownMenuItem>
                            {org.status !== "active" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(org, "active")}>
                                Ativar
                              </DropdownMenuItem>
                            )}
                            {org.status !== "suspended" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(org, "suspended")}
                                className="text-destructive"
                              >
                                Suspender
                              </DropdownMenuItem>
                            )}
                            {org.status !== "trial" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(org, "trial")}>
                                Definir como Trial
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalCount > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Itens por página:</span>
                      <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {getVisiblePages().map((page, idx, arr) => (
                          <PaginationItem key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="px-2">...</span>
                            )}
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useManagerCnpjs } from "@/hooks/useManagerCnpjs";
import { 
  Users, 
  HardHat, 
  PackageCheck, 
  AlertTriangle,
  RotateCcw,
  Archive,
  Building2,
  UserCheck,
  Clock,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EpiExpirationAlerts, type EpiAlertItem, type EpiDeliveryAlertItem } from "@/components/dashboard/EpiExpirationAlerts";
import { ScopeSummaryCard } from "@/components/dashboard/ScopeSummaryCard";

interface OrgStats {
  totalEpis: number;
  deliveriesThisMonth: number;
  pendingReturns: number;
  expiredCAs: number;
  expiringSoonCAs: number;
  lowStock: number;
  totalEmployees: number;
  totalSectors: number;
  pendingRequests: number;
}

export default function Dashboard() {
  const { organization, isOrgAdmin, profile } = useAuth();
  const { managerCnpjIds, managerSectorIds, isLoading: isLoadingManager } = useManagerCnpjs();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.must_reset_password) {
      navigate("/reset-password");
    }
  }, [profile, navigate]);
  const [stats, setStats] = useState<OrgStats>({
    totalEpis: 0, deliveriesThisMonth: 0, pendingReturns: 0,
    expiredCAs: 0, expiringSoonCAs: 0, lowStock: 0, totalEmployees: 0, totalSectors: 0, pendingRequests: 0,
  });
  const [rawEmployees, setRawEmployees] = useState<any[]>([]);
  const [rawDeliveries, setRawDeliveries] = useState<any[]>([]);
  const [rawPendingDeliveries, setRawPendingDeliveries] = useState<any[]>([]);
  const [rawRequests, setRawRequests] = useState<any[]>([]);
  const [rawEpis, setRawEpis] = useState<any[]>([]);
  const [rawCnpjStock, setRawCnpjStock] = useState<any[]>([]);
  const [rawSectors, setRawSectors] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedCnpjId, setSelectedCnpjId] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!organization?.id) return;
      setIsLoadingStats(true);
      setFetchError(null);

      try {
        const now = new Date();
        const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        const [episRes, deliveriesRes, pendingRes, employeesRes, sectorsRes, requestsRes, cnpjStockRes, allDeliveriesRes] = await Promise.all([
          supabase.from("epis").select("id, name, code, ca_number, ca_expiration").eq("organization_id", organization.id).eq("is_active", true),
          supabase.from("epi_deliveries").select("id, employee_record_id").eq("organization_id", organization.id).gte("delivery_date", firstOfMonth),
          supabase.from("epi_deliveries").select("id, employee_record_id").eq("organization_id", organization.id).eq("status", "delivered" as any),
          supabase.from("employees").select("id, name, organization_cnpj_id, sector_id").eq("organization_id", organization.id).eq("is_active", true),
          supabase.from("sectors").select("id").eq("organization_id", organization.id).eq("is_active", true),
          supabase.from("epi_requests").select("id, employee_id").eq("organization_id", organization.id).eq("status", "pending"),
          supabase.from("epi_cnpj_stock").select("id, organization_cnpj_id, stock_quantity, min_stock").eq("organization_id", organization.id),
          supabase.from("epi_deliveries").select("*, epis(name)").eq("organization_id", organization.id).eq("status", "delivered" as any),
        ]);

        const errors = [episRes, deliveriesRes, pendingRes, employeesRes, sectorsRes, requestsRes, cnpjStockRes, allDeliveriesRes]
          .filter(r => r.error)
          .map(r => r.error?.message)
          .filter(Boolean);

        if (errors.length > 0) {
          setFetchError("Erro ao carregar dados. Tente novamente.");
        }

        setRawEpis(episRes.data || []);
        setRawDeliveries(deliveriesRes.data || []);
        setRawPendingDeliveries(allDeliveriesRes.data || []); // Use all active deliveries for expiration checks
        setRawEmployees(employeesRes.data || []);
        setRawSectors(sectorsRes.data || []);
        setRawRequests(requestsRes.data || []);
        setRawCnpjStock(cnpjStockRes.data || []);
      } catch (err) {
        setFetchError("Erro ao carregar dados. Tente novamente.");
      } finally {
        setIsLoadingStats(false);
      }
    };
    fetchStats();
  }, [organization?.id]);

  // Apply manager filtering
  const computedStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const in30days = new Date();
    in30days.setDate(in30days.getDate() + 30);
    const in30str = in30days.toISOString().split("T")[0];

    // Filter employees by manager visibility
    let visibleEmployees = rawEmployees;
    if (managerCnpjIds !== null) {
      visibleEmployees = visibleEmployees.filter(e => e.organization_cnpj_id && managerCnpjIds.includes(e.organization_cnpj_id));
      if (managerSectorIds !== null) {
        visibleEmployees = visibleEmployees.filter(e => e.sector_id && managerSectorIds.includes(e.sector_id));
      }
    }
    if (selectedCnpjId) {
      visibleEmployees = visibleEmployees.filter(e => e.organization_cnpj_id === selectedCnpjId);
    }
    const visibleEmpIds = new Set(visibleEmployees.map(e => e.id));

    // Filter deliveries and requests by visible employees
    const needsEmpFilter = managerCnpjIds !== null || selectedCnpjId !== null;
    const filteredDeliveries = !needsEmpFilter ? rawDeliveries : rawDeliveries.filter(d => d.employee_record_id && visibleEmpIds.has(d.employee_record_id));
    const filteredPending = !needsEmpFilter ? rawPendingDeliveries : rawPendingDeliveries.filter(d => d.employee_record_id && visibleEmpIds.has(d.employee_record_id));
    const filteredRequests = !needsEmpFilter ? rawRequests : rawRequests.filter(r => visibleEmpIds.has(r.employee_id));

    // Filter sectors by manager visibility
    let visibleSectors = rawSectors;
    if (managerSectorIds !== null) {
      visibleSectors = visibleSectors.filter(s => managerSectorIds.includes(s.id));
    }

    const episData = rawEpis;
    const expiredList: EpiAlertItem[] = episData
      .filter(e => e.ca_expiration && e.ca_expiration < today)
      .sort((a, b) => (a.ca_expiration < b.ca_expiration ? -1 : 1))
      .map(e => ({ id: e.id, name: e.name, code: e.code, ca_number: e.ca_number, ca_expiration: e.ca_expiration }));
    const expiringSoonList: EpiAlertItem[] = episData
      .filter(e => e.ca_expiration && e.ca_expiration >= today && e.ca_expiration <= in30str)
      .sort((a, b) => (a.ca_expiration < b.ca_expiration ? -1 : 1))
      .map(e => ({ id: e.id, name: e.name, code: e.code, ca_number: e.ca_number, ca_expiration: e.ca_expiration }));

    // Low stock: calculated from epi_cnpj_stock, filtered by manager CNPJs
    let stockRecords = rawCnpjStock;
    if (managerCnpjIds !== null) {
      stockRecords = stockRecords.filter(s => managerCnpjIds.includes(s.organization_cnpj_id));
    }
    if (selectedCnpjId) {
      stockRecords = stockRecords.filter(s => s.organization_cnpj_id === selectedCnpjId);
    }
    const lowStock = stockRecords.filter(s => s.stock_quantity <= s.min_stock).length;


    return {
      totalEpis: episData.length,
      deliveriesThisMonth: filteredDeliveries.length,
      pendingReturns: filteredPending.length,
      expiredCAs: expiredList.length,
      expiringSoonCAs: expiringSoonList.length,
      expiredList,
      expiringSoonList,
      expiredDeliveries: rawPendingDeliveries
        .filter(d => d.expiration_date && d.expiration_date < today)
        .sort((a, b) => (a.expiration_date < b.expiration_date ? -1 : 1))
        .map(d => {
          const emp = rawEmployees.find(e => e.id === d.employee_record_id);
          return {
            id: d.id,
            epi_name: (d.epis as any)?.name || "EPI",
            employee_name: emp?.name || "Desconhecido",
            expiration_date: d.expiration_date,
            employee_record_id: d.employee_record_id,
            delivery_date: d.delivery_date,
            delivered_by: d.delivered_by,
            reason: d.reason,
            notes: d.notes
          };
        }),
      expiringSoonDeliveries: rawPendingDeliveries
        .filter(d => d.expiration_date && d.expiration_date >= today && d.expiration_date <= in30str)
        .sort((a, b) => (a.expiration_date < b.expiration_date ? -1 : 1))
        .map(d => {
          const emp = rawEmployees.find(e => e.id === d.employee_record_id);
          return {
            id: d.id,
            epi_name: (d.epis as any)?.name || "EPI",
            employee_name: emp?.name || "Desconhecido",
            expiration_date: d.expiration_date,
            employee_record_id: d.employee_record_id,
            delivery_date: d.delivery_date,
            delivered_by: d.delivered_by,
            reason: d.reason,
            notes: d.notes
          };
        }),
      lowStock,
      totalEmployees: visibleEmployees.length,
      totalSectors: visibleSectors.length,
      pendingRequests: filteredRequests.length,
    };
  }, [rawEmployees, rawDeliveries, rawPendingDeliveries, rawRequests, rawEpis, rawSectors, rawCnpjStock, managerCnpjIds, managerSectorIds, selectedCnpjId]);

  const cards = [
    { title: "EPIs Cadastrados", value: computedStats.totalEpis, icon: HardHat, color: "text-blue-500", description: "Equipamentos ativos" },
    { title: "Entregas no Mês", value: computedStats.deliveriesThisMonth, icon: PackageCheck, color: "text-green-500", description: "Entregas realizadas" },
    { title: "Devoluções Pendentes", value: computedStats.pendingReturns, icon: RotateCcw, color: "text-warning", description: "Aguardando devolução" },
    { title: "CAs Vencidos", value: computedStats.expiredCAs, icon: AlertTriangle, color: "text-destructive", description: "Certificados expirados" },
    { title: "CAs Vencendo", value: computedStats.expiringSoonCAs, icon: Clock, color: "text-warning", description: "Vencem em 30 dias" },
    { title: "Estoque Baixo", value: computedStats.lowStock, icon: Archive, color: "text-orange-500", description: "Abaixo do mínimo" },
    { title: "Funcionários", value: computedStats.totalEmployees, icon: UserCheck, color: "text-purple-500", description: "Funcionários ativos" },
    { title: "Setores", value: computedStats.totalSectors, icon: Building2, color: "text-teal-500", description: "Setores ativos" },
    ...(isOrgAdmin ? [{ title: "Solicitações Pendentes", value: computedStats.pendingRequests, icon: FileText, color: computedStats.pendingRequests > 0 ? "text-orange-500" : "text-muted-foreground", description: computedStats.pendingRequests > 0 ? "Aguardando aprovação" : "Nenhuma pendência", onClick: () => navigate("/dashboard/epi-requests") }] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao painel de {organization?.name || "sua organização"}
        </p>
      </div>

      <ScopeSummaryCard
        selectedCnpjId={selectedCnpjId}
        onSelectCnpj={setSelectedCnpjId}
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className={(card as any).onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={(card as any).onClick}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? "..." : card.value}
              </div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isOrgAdmin && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Alertas de Vencimento de CA</h2>
          <EpiExpirationAlerts
            expired={computedStats.expiredList}
            expiringSoon={computedStats.expiringSoonList}
            expiredDeliveries={computedStats.expiredDeliveries}
            expiringSoonDeliveries={computedStats.expiringSoonDeliveries}
            isLoading={isLoadingStats}
            error={fetchError}
          />
        </div>
      )}
    </div>
  );
}

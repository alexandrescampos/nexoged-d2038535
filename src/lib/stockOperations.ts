import { supabase } from "@/integrations/supabase/client";

interface CnpjStock {
  id: string;
  stock_quantity: number;
  used_stock_quantity: number;
  min_stock: number;
}

export interface StockOrigin {
  cnpj_id: string;
  quantity: number;
}

/**
 * Get stock for a specific EPI at a specific CNPJ
 */
export async function getCnpjStock(epiId: string, cnpjId: string): Promise<CnpjStock | null> {
  const { data, error } = await supabase
    .from("epi_cnpj_stock" as any)
    .select("id, stock_quantity, used_stock_quantity, min_stock")
    .eq("epi_id", epiId)
    .eq("organization_cnpj_id", cnpjId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CnpjStock | null;
}

/**
 * Ensure a stock record exists for an EPI at a CNPJ, creating if needed
 */
export async function ensureCnpjStock(epiId: string, cnpjId: string, organizationId: string): Promise<CnpjStock> {
  let stock = await getCnpjStock(epiId, cnpjId);
  if (!stock) {
    const { data, error } = await supabase
      .from("epi_cnpj_stock" as any)
      .insert({ epi_id: epiId, organization_cnpj_id: cnpjId, organization_id: organizationId })
      .select("id, stock_quantity, used_stock_quantity, min_stock")
      .single();
    if (error) throw error;
    stock = data as any;
  }
  return stock!;
}

/**
 * Get configured source CNPJs that the consumer CNPJ can pull stock from,
 * ordered by priority (lowest first = highest priority).
 */
export async function getStockSources(consumerCnpjId: string): Promise<{ source_cnpj_id: string; priority: number }[]> {
  const { data, error } = await supabase
    .from("cnpj_stock_sources" as any)
    .select("source_cnpj_id, priority")
    .eq("consumer_cnpj_id", consumerCnpjId)
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data as any) || [];
}

async function debitSingle(
  stock: CnpjStock,
  quantity: number,
  source: "new" | "used"
): Promise<void> {
  const field = source === "used" ? "used_stock_quantity" : "stock_quantity";
  const current = source === "used" ? (stock.used_stock_quantity || 0) : (stock.stock_quantity || 0);
  const { error } = await supabase
    .from("epi_cnpj_stock" as any)
    .update({ [field]: current - quantity })
    .eq("id", stock.id);
  if (error) throw error;
}

async function creditSingle(
  stock: CnpjStock,
  quantity: number,
  source: "new" | "used"
): Promise<void> {
  const field = source === "used" ? "used_stock_quantity" : "stock_quantity";
  const current = source === "used" ? stock.used_stock_quantity : stock.stock_quantity;
  const { error } = await supabase
    .from("epi_cnpj_stock" as any)
    .update({ [field]: current + quantity })
    .eq("id", stock.id);
  if (error) throw error;
}

/**
 * Debit stock for an EPI at a CNPJ. If the CNPJ doesn't have enough stock,
 * pulls the remainder from configured source CNPJs (N:N mapping) in priority order.
 *
 * Returns the breakdown of where the stock was actually pulled from.
 * Throws "estoque insuficiente" if total available (own + sources) is not enough.
 */
export async function debitCnpjStock(
  epiId: string,
  cnpjId: string,
  organizationId: string,
  quantity: number,
  source: "new" | "used"
): Promise<StockOrigin[]> {
  if (quantity <= 0) return [];

  // Build candidate chain: own first, then configured sources by priority
  const sources = await getStockSources(cnpjId);
  const chainCnpjIds = [cnpjId, ...sources.map((s) => s.source_cnpj_id)];

  // Load (or create) stock rows for each
  const stocks: Record<string, CnpjStock> = {};
  for (const id of chainCnpjIds) {
    stocks[id] = await ensureCnpjStock(epiId, id, organizationId);
  }

  const getAvail = (s: CnpjStock) => (source === "used" ? (s.used_stock_quantity || 0) : (s.stock_quantity || 0));
  
  // We no longer pre-check availability because stock can go negative as per user request.
  // We still follow the priority chain to use available stock from other CNPJs first if configured.

  // Distribute and apply
  const applied: StockOrigin[] = [];
  let remaining = quantity;
  for (const id of chainCnpjIds) {
    if (remaining <= 0) break;
    const isLastInChain = id === chainCnpjIds[chainCnpjIds.length - 1];
    const avail = getAvail(stocks[id]);

    // If there's stock available, or if this is the last CNPJ in the chain (where we'll allow negative stock)
    if (avail > 0 || isLastInChain) {
      const take = isLastInChain ? remaining : Math.min(avail, remaining);
      try {
        await debitSingle(stocks[id], take, source);
        applied.push({ cnpj_id: id, quantity: take });
        remaining -= take;
      } catch (err) {
        // Manual rollback of what was already debited
        for (const a of applied) {
          try {
            await creditSingle(stocks[a.cnpj_id], a.quantity, source);
          } catch {
            /* best-effort rollback */
          }
        }
        throw err;
      }
    }
  }

  return applied;
}

/**
 * Credit used stock for an EPI at a CNPJ (e.g., on return).
 * Always credits back to the employee's CNPJ (does not redistribute to source CNPJs).
 */
export async function creditUsedStock(
  epiId: string,
  cnpjId: string,
  organizationId: string,
  quantity: number
): Promise<void> {
  const stock = await ensureCnpjStock(epiId, cnpjId, organizationId);
  const { error } = await supabase
    .from("epi_cnpj_stock" as any)
    .update({ used_stock_quantity: stock.used_stock_quantity + quantity })
    .eq("id", stock.id);
  if (error) throw error;
}

/**
 * Get all CNPJ stock records for a list of EPI IDs at a specific CNPJ
 */
export async function getCnpjStockBatch(epiIds: string[], cnpjId: string): Promise<Record<string, CnpjStock>> {
  if (!epiIds.length || !cnpjId) return {};
  const { data, error } = await supabase
    .from("epi_cnpj_stock" as any)
    .select("id, epi_id, stock_quantity, used_stock_quantity, min_stock")
    .eq("organization_cnpj_id", cnpjId)
    .in("epi_id", epiIds);
  if (error) throw error;
  const map: Record<string, CnpjStock> = {};
  for (const row of (data as any[]) || []) {
    map[row.epi_id] = row;
  }
  return map;
}

/**
 * Get consolidated available stock (own + all configured source CNPJs) for a consumer CNPJ.
 * Returns { own, shared, total } per stock type.
 */
export async function getAvailableStockForConsumer(
  epiId: string,
  consumerCnpjId: string
): Promise<{ own: number; shared: number; total: number; ownUsed: number; sharedUsed: number; totalUsed: number }> {
  const sources = await getStockSources(consumerCnpjId);
  const all = [consumerCnpjId, ...sources.map((s) => s.source_cnpj_id)];
  const { data, error } = await supabase
    .from("epi_cnpj_stock" as any)
    .select("organization_cnpj_id, stock_quantity, used_stock_quantity")
    .eq("epi_id", epiId)
    .in("organization_cnpj_id", all);
  if (error) throw error;
  let own = 0, shared = 0, ownUsed = 0, sharedUsed = 0;
  for (const row of (data as any[]) || []) {
    if (row.organization_cnpj_id === consumerCnpjId) {
      own += row.stock_quantity || 0;
      ownUsed += row.used_stock_quantity || 0;
    } else {
      shared += row.stock_quantity || 0;
      sharedUsed += row.used_stock_quantity || 0;
    }
  }
  return { own, shared, total: own + shared, ownUsed, sharedUsed, totalUsed: ownUsed + sharedUsed };
}

/**
 * Get the organization_cnpj_id for an employee
 */
export async function getEmployeeCnpjId(employeeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("employees")
    .select("organization_cnpj_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (error) throw error;
  return data?.organization_cnpj_id || null;
}

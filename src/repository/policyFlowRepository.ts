import { supabase } from "@/integrations/supabase/client";

export type TipoAssinatura = "NENHUMA" | "SIMPLES" | "AVANCADA" | "QUALIFICADA";

export interface PoliticaAssinatura {
  id: string;
  organization_id: string;
  nome: string;
  descricao: string | null;
  assinatura_obrigatoria: boolean;
  tipo_assinatura: TipoAssinatura;
  quantidade_minima_assinaturas: number;
  permite_coassinatura: boolean;
  ordem_assinatura: boolean;
  carimbo_tempo: boolean;
  certificado_obrigatorio: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FluxoAprovacao {
  id: string;
  organization_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  etapas?: FluxoAprovacaoEtapa[];
}

export interface FluxoAprovacaoEtapa {
  id: string;
  fluxo_id: string;
  ordem: number;
  nome_etapa: string;
  perfil_responsavel_id: string | null;
  aprovacao_obrigatoria: boolean;
}

export interface FluxoAssinatura {
  id: string;
  tipo_documento_id: string;
  ordem: number;
  perfil_assinante_id: string | null;
  assinatura_obrigatoria: boolean;
  tipo_assinatura: TipoAssinatura;
}

export const policyFlowRepository = {
  // ============ POLÍTICA DE ASSINATURA ============
  async listPolicies(orgId: string) {
    const { data, error } = await supabase
      .from("politica_assinatura")
      .select("*")
      .eq("organization_id", orgId)
      .order("nome");
    if (error) throw error;
    return (data || []) as PoliticaAssinatura[];
  },

  async upsertPolicy(p: Partial<PoliticaAssinatura> & { organization_id: string; nome: string }) {
    const { id, ...rest } = p;
    if (id) {
      const { data, error } = await supabase.from("politica_assinatura").update(rest).eq("id", id).select().single();
      if (error) throw error;
      return data as PoliticaAssinatura;
    }
    const { data, error } = await supabase.from("politica_assinatura").insert([rest as any]).select().single();
    if (error) throw error;
    return data as PoliticaAssinatura;
  },

  async deletePolicy(id: string) {
    const { error } = await supabase.from("politica_assinatura").delete().eq("id", id);
    if (error) throw error;
  },

  // ============ FLUXO APROVAÇÃO ============
  async listFlows(orgId: string) {
    const { data, error } = await supabase
      .from("fluxo_aprovacao")
      .select("*, etapas:fluxo_aprovacao_etapa(*)")
      .eq("organization_id", orgId)
      .order("nome");
    if (error) throw error;
    return (data || []).map((f: any) => ({
      ...f,
      etapas: (f.etapas || []).sort((a: any, b: any) => a.ordem - b.ordem),
    })) as FluxoAprovacao[];
  },

  async upsertFlow(f: Partial<FluxoAprovacao> & { organization_id: string; nome: string }, etapas: Omit<FluxoAprovacaoEtapa, "id" | "fluxo_id">[]) {
    const { id, etapas: _e, ...rest } = f as any;
    let flowId = id;
    if (flowId) {
      const { error } = await supabase.from("fluxo_aprovacao").update(rest).eq("id", flowId);
      if (error) throw error;
      await supabase.from("fluxo_aprovacao_etapa").delete().eq("fluxo_id", flowId);
    } else {
      const { data, error } = await supabase.from("fluxo_aprovacao").insert([rest as any]).select().single();
      if (error) throw error;
      flowId = data.id;
    }
    if (etapas.length > 0) {
      const rows = etapas.map((e, idx) => ({ ...e, ordem: idx + 1, fluxo_id: flowId }));
      const { error } = await supabase.from("fluxo_aprovacao_etapa").insert(rows as any);
      if (error) throw error;
    }
    return flowId as string;
  },

  async deleteFlow(id: string) {
    const { error } = await supabase.from("fluxo_aprovacao").delete().eq("id", id);
    if (error) throw error;
  },

  // ============ FLUXO ASSINATURA (por tipo doc) ============
  async listSignersForType(tipoId: string) {
    const { data, error } = await supabase
      .from("fluxo_assinatura")
      .select("*")
      .eq("tipo_documento_id", tipoId)
      .order("ordem");
    if (error) throw error;
    return (data || []) as FluxoAssinatura[];
  },

  async replaceSignersForType(tipoId: string, signers: Omit<FluxoAssinatura, "id" | "tipo_documento_id">[]) {
    await supabase.from("fluxo_assinatura").delete().eq("tipo_documento_id", tipoId);
    if (signers.length === 0) return;
    const rows = signers.map((s, idx) => ({ ...s, ordem: idx + 1, tipo_documento_id: tipoId }));
    const { error } = await supabase.from("fluxo_assinatura").insert(rows as any);
    if (error) throw error;
  },
};

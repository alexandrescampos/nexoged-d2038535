import { supabase } from "@/integrations/supabase/client";
import type { TipoAssinatura } from "./policyFlowRepository";

export type StatusEtapaAprovacao = "PENDENTE" | "APROVADA" | "REPROVADA";
export type StatusAssinatura = "PENDENTE" | "ASSINADA" | "RECUSADA";

export interface DocumentoAprovacao {
  id: string;
  documento_id: string;
  fluxo_id: string | null;
  etapa_id: string | null;
  ordem: number;
  nome_etapa: string;
  perfil_responsavel_id: string | null;
  perfil_nome?: string;
  status: StatusEtapaAprovacao;
  aprovador_id: string | null;
  aprovador_nome?: string;
  decidido_em: string | null;
  comentario: string | null;
  organization_id: string;
  created_at: string;
}

export interface DocumentoAssinatura {
  id: string;
  documento_id: string;
  versao_id: string | null;
  ordem: number;
  perfil_assinante_id: string | null;
  perfil_nome?: string;
  assinatura_obrigatoria: boolean;
  tipo_assinatura: TipoAssinatura;
  status: StatusAssinatura;
  assinante_id: string | null;
  assinante_nome?: string;
  assinado_em: string | null;
  hash_evidencia: string | null;
  certificado_info: any;
  organization_id: string;
}

async function getPerfilNameMap(perfilIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(perfilIds.filter(Boolean))) as string[];
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("perfil").select("perfil_id, perfil_nome").in("perfil_id", ids);
  return new Map((data || []).map((r: any) => [r.perfil_id, r.perfil_nome]));
}

async function getUserNameMap(userIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean))) as string[];
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return new Map((data || []).map((r: any) => [r.id, r.full_name]));
}

async function getDocumentMap(docIds: (string | null | undefined)[]): Promise<Map<string, any>> {
  const ids = Array.from(new Set(docIds.filter(Boolean))) as string[];
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("ged_documents")
    .select("id, title, status, organization_id")
    .in("id", ids);
  return new Map(
    (data || []).map((r: any) => [r.id, { id: r.id, nome: r.title, codigo: null, status: r.status, organization_id: r.organization_id }])
  );
}

export const policyExecutionRepository = {
  async listApprovals(documentId: string): Promise<DocumentoAprovacao[]> {
    const { data, error } = await supabase
      .from("documento_aprovacao")
      .select("*")
      .eq("documento_id", documentId)
      .order("ordem");
    if (error) throw error;
    const rows = (data || []) as any[];
    const [perfilMap, userMap] = await Promise.all([
      getPerfilNameMap(rows.map((r) => r.perfil_responsavel_id)),
      getUserNameMap(rows.map((r) => r.aprovador_id)),
    ]);
    return rows.map((r) => ({
      ...r,
      perfil_nome: r.perfil_responsavel_id ? perfilMap.get(r.perfil_responsavel_id) : undefined,
      aprovador_nome: r.aprovador_id ? userMap.get(r.aprovador_id) : undefined,
    }));
  },

  async listSignatures(documentId: string): Promise<DocumentoAssinatura[]> {
    const { data, error } = await supabase
      .from("documento_assinatura")
      .select("*")
      .eq("documento_id", documentId)
      .order("ordem");
    if (error) throw error;
    const rows = (data || []) as any[];
    const [perfilMap, userMap] = await Promise.all([
      getPerfilNameMap(rows.map((r) => r.perfil_assinante_id)),
      getUserNameMap(rows.map((r) => r.assinante_id)),
    ]);
    return rows.map((r) => ({
      ...r,
      perfil_nome: r.perfil_assinante_id ? perfilMap.get(r.perfil_assinante_id) : undefined,
      assinante_nome: r.assinante_id ? userMap.get(r.assinante_id) : undefined,
    }));
  },

  async submitForApproval(documentId: string) {
    const { error } = await supabase.rpc("submit_for_approval", { p_document_id: documentId });
    if (error) throw error;
  },

  async applyPolicy(documentId: string) {
    const { error } = await supabase.rpc("apply_document_type_policy", { p_document_id: documentId });
    if (error) throw error;
  },

  async approveStep(etapaId: string, comentario?: string) {
    const { error } = await supabase.rpc("approve_step", {
      p_etapa_instancia_id: etapaId,
      p_comentario: comentario ?? null,
    });
    if (error) throw error;
  },

  async rejectStep(etapaId: string, comentario: string) {
    const { error } = await supabase.rpc("reject_step", {
      p_etapa_instancia_id: etapaId,
      p_comentario: comentario,
    });
    if (error) throw error;
  },

  async signDocument(
    assinaturaId: string,
    tipo: TipoAssinatura,
    hashEvidencia?: string | null,
    certificado?: any,
  ) {
    const { error } = await supabase.rpc("sign_document", {
      p_assinatura_id: assinaturaId,
      p_tipo: tipo,
      p_hash_evidencia: hashEvidencia ?? null,
      p_certificado: certificado ?? null,
    });
    if (error) throw error;
  },

  async archiveDocument(documentId: string) {
    const { error } = await supabase.rpc("archive_document", { p_document_id: documentId });
    if (error) throw error;
  },

  async getUserPerfilIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("usuario_perfil")
      .select("perfil_id")
      .eq("usuario_id", userId);
    if (error) throw error;
    return (data || []).map((r: any) => r.perfil_id);
  },

  async listMyPendingApprovals(perfilIds: string[]) {
    if (perfilIds.length === 0) return [];
    const { data, error } = await supabase
      .from("documento_aprovacao")
      .select("id, documento_id, ordem, nome_etapa, created_at, perfil_responsavel_id")
      .eq("status", "PENDENTE")
      .in("perfil_responsavel_id", perfilIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data || []) as any[];
    const docMap = await getDocumentMap(rows.map((r) => r.documento_id));
    return rows.map((r) => ({ ...r, documento: docMap.get(r.documento_id) || null }));
  },

  async listMyPendingSignatures(perfilIds: string[]) {
    if (perfilIds.length === 0) return [];
    const { data, error } = await supabase
      .from("documento_assinatura")
      .select("id, documento_id, ordem, tipo_assinatura, created_at, perfil_assinante_id")
      .eq("status", "PENDENTE")
      .in("perfil_assinante_id", perfilIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data || []) as any[];
    const docMap = await getDocumentMap(rows.map((r) => r.documento_id));
    return rows.map((r) => ({ ...r, documento: docMap.get(r.documento_id) || null }));
  },

  async listAllWorkflowApprovals(orgId: string, from?: string, to?: string) {
    let q = supabase
      .from("documento_aprovacao")
      .select("id, documento_id, ordem, nome_etapa, status, comentario, decidido_em, created_at, aprovador_id, perfil_responsavel_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []) as any[];
    const [perfilMap, userMap, docMap] = await Promise.all([
      getPerfilNameMap(rows.map((r) => r.perfil_responsavel_id)),
      getUserNameMap(rows.map((r) => r.aprovador_id)),
      getDocumentMap(rows.map((r) => r.documento_id)),
    ]);
    return rows.map((r) => ({
      ...r,
      perfil: r.perfil_responsavel_id ? { perfil_nome: perfilMap.get(r.perfil_responsavel_id) } : null,
      aprovador: r.aprovador_id ? { full_name: userMap.get(r.aprovador_id) } : null,
      documento: docMap.get(r.documento_id) || null,
    }));
  },

  async listAllWorkflowSignatures(orgId: string, from?: string, to?: string) {
    let q = supabase
      .from("documento_assinatura")
      .select("id, documento_id, ordem, tipo_assinatura, status, assinado_em, created_at, assinante_id, perfil_assinante_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []) as any[];
    const [perfilMap, userMap, docMap] = await Promise.all([
      getPerfilNameMap(rows.map((r) => r.perfil_assinante_id)),
      getUserNameMap(rows.map((r) => r.assinante_id)),
      getDocumentMap(rows.map((r) => r.documento_id)),
    ]);
    return rows.map((r) => ({
      ...r,
      perfil: r.perfil_assinante_id ? { perfil_nome: perfilMap.get(r.perfil_assinante_id) } : null,
      assinante: r.assinante_id ? { full_name: userMap.get(r.assinante_id) } : null,
      documento: docMap.get(r.documento_id) || null,
    }));
  },
};

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

export const policyExecutionRepository = {
  async listApprovals(documentId: string): Promise<DocumentoAprovacao[]> {
    const { data, error } = await supabase
      .from("documento_aprovacao")
      .select("*, perfil:perfil_responsavel_id(perfil_nome), aprovador:aprovador_id(full_name)")
      .eq("documento_id", documentId)
      .order("ordem");
    if (error) throw error;
    return (data || []).map((r: any) => ({
      ...r,
      perfil_nome: r.perfil?.perfil_nome,
      aprovador_nome: r.aprovador?.full_name,
    }));
  },

  async listSignatures(documentId: string): Promise<DocumentoAssinatura[]> {
    const { data, error } = await supabase
      .from("documento_assinatura")
      .select("*, perfil:perfil_assinante_id(perfil_nome), assinante:assinante_id(full_name)")
      .eq("documento_id", documentId)
      .order("ordem");
    if (error) throw error;
    return (data || []).map((r: any) => ({
      ...r,
      perfil_nome: r.perfil?.perfil_nome,
      assinante_nome: r.assinante?.full_name,
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
};

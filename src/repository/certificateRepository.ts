import { supabase } from "@/integrations/supabase/client";

export type CertificateScope = "USUARIO" | "ORGANIZACAO";
export type CertificateStatus = "valido" | "vencido" | "revogado";

export interface DigitalCertificate {
  id: string;
  owner_type: CertificateScope;
  titular_nome: string;
  titular_documento: string | null;
  emissor: string | null;
  valido_de: string | null;
  valido_ate: string;
  status: CertificateStatus;
  organization_id: string;
}

export interface SignResultItem {
  documentId: string;
  ok: boolean;
  error?: string;
}

/** Converte um File em base64 puro (sem o prefixo data:). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

const UPLOAD_ERRORS: Record<string, string> = {
  senha_incorreta: "Senha do certificado incorreta.",
  certificado_nao_encontrado: "Não foi possível localizar um certificado válido no arquivo.",
  arquivo_muito_grande: "O arquivo excede o limite de 2 MB.",
  sem_organizacao: "Seu usuário não está vinculado a uma organização.",
  forbidden: "Você não tem permissão para cadastrar o certificado da organização.",
};

const SIGN_ERRORS: Record<string, string> = {
  certificado_indisponivel: "Certificado indisponível para o seu usuário.",
  certificado_vencido: "Certificado vencido.",
  documento_nao_encontrado: "Documento não encontrado.",
  versao_nao_encontrada: "Versão ativa não encontrada.",
  apenas_pdf: "Apenas arquivos PDF podem ser assinados.",
  falha_download: "Falha ao baixar o arquivo do documento.",
  falha_upload: "Falha ao gravar o documento assinado.",
  falha_versao: "Falha ao criar a nova versão assinada.",
  falha_registro_assinatura: "Falha ao registrar a assinatura.",
};

export function describeSignError(code?: string): string {
  if (!code) return "Erro desconhecido";
  return SIGN_ERRORS[code] || code;
}

export const certificateRepository = {
  /** Certificados que o usuário atual pode usar para assinar (e-CPF e/ou e-CNPJ). */
  async listAvailable(): Promise<DigitalCertificate[]> {
    const { data, error } = await (supabase.rpc as any)("cert_list_available");
    if (error) throw error;
    return (data || []) as DigitalCertificate[];
  },

  async upload(params: { scope: CertificateScope; file: File; password: string }): Promise<void> {
    const base64Pfx = await fileToBase64(params.file);
    const { data, error } = await supabase.functions.invoke("certificate-upload", {
      body: { scope: params.scope, base64Pfx, password: params.password },
    });

    if (error) {
      // Tenta extrair o código de erro devolvido pela função
      let code = "";
      try {
        const ctx = (error as any)?.context;
        const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
        code = typeof body?.error === "string" ? body.error : "";
      } catch {
        code = "";
      }
      throw new Error(UPLOAD_ERRORS[code] || "Não foi possível salvar o certificado.");
    }
    if ((data as any)?.error) {
      const code = String((data as any).error);
      throw new Error(UPLOAD_ERRORS[code] || "Não foi possível salvar o certificado.");
    }
  },

  async remove(id: string): Promise<void> {
    const { error } = await (supabase.from("digital_certificates" as any) as any).delete().eq("id", id);
    if (error) throw error;
  },

  /** Assina um ou mais PDFs no servidor. */
  async signDocuments(params: {
    certificateId: string;
    documentIds: string[];
    intent?: string;
    assinaturaId?: string;
    tipo?: string;
  }): Promise<SignResultItem[]> {
    const { data, error } = await supabase.functions.invoke("sign-document-pdf", {
      body: {
        certificateId: params.certificateId,
        documentIds: params.documentIds,
        intent: params.intent || undefined,
        assinaturaId: params.assinaturaId || undefined,
        tipo: params.tipo || undefined,
      },
    });
    if (error) throw new Error("Falha ao assinar o documento.");
    if ((data as any)?.error) throw new Error(describeSignError(String((data as any).error)));
    return ((data as any)?.results || []) as SignResultItem[];
  },
};

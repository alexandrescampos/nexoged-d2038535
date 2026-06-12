// Support chatbot edge function for Nexo GED
// Streams responses from Lovable AI Gateway (Gemini) and answers questions
// about all system functionalities.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface UserContext {
  name?: string;
  role?: string;
  organization?: string;
  organization_id?: string;
  user_id?: string;
}

const SYSTEM_PROMPT = `Você é o assistente virtual do **Nexo GED**, um Sistema Avançado de Gestão Eletrônica de Documentos (GED). Responda sempre em português do Brasil, de forma clara, objetiva e cordial. Use markdown (listas, **negrito**, títulos curtos) quando ajudar a leitura.

# Sobre o Nexo GED
Plataforma SaaS multiempresa para digitalização, organização, busca e controle do ciclo de vida de documentos corporativos, com OCR, versionamento, RBAC, auditoria e integrações.

# Funcionalidades do sistema

## 1. Dashboard
- Visão geral de uso: páginas processadas, espaço em disco utilizado, documentos recentes e indicadores de vencimento.
- Indicador de **Páginas de Documentos** e **Espaço em Disco** (em GB) consumidos vs. contratados.
- Apenas Super Admin altera limites contratados; usuários comuns visualizam o consumo.

## 2. Documentos (GED)
- Hierarquia: **Organização → Departamentos → Setores → Pastas → Documentos**.
- Upload simples e em lote (Multi-File Uploader), com seleção de tipo de documento e pasta de destino.
- **Versionamento automático**: cada novo upload do mesmo documento gera uma nova versão, mantendo histórico.
- **Exclusão lógica (lixeira)**: documentos excluídos podem ser restaurados.
- **Campos adicionais** (custom fields) por tipo de documento: texto, número, data, lista, etc.
- **Listas de cadastro** reutilizáveis para preencher campos do tipo "select".
- **Favoritos** e **Últimos Acessos** para acesso rápido.
- **Pesquisa Avançada**: por nome, tipo, pasta, campos adicionais, datas, conteúdo OCR e usuário.
- **Vencimentos**: relatório dos documentos com data de validade próxima/expirada.

## 3. OCR e processamento
- Processamento automático de PDFs e imagens para extração de texto pesquisável.
- Auditoria do OCR (páginas processadas, falhas, fila de processamento).
- Permite busca pelo conteúdo dos documentos.

## 4. Tipos de Documento
- Cadastro de tipos com prazo de validade, campos adicionais obrigatórios/opcionais e permissões por perfil.
- Vinculação de tipos a pastas (folder_document_types) para padronização.

## 5. Controle de Acesso (RBAC)
- **Papéis**: Super Admin, Org Admin (Administrador), Manager (Gestor) e Usuário.
- **Perfis de permissão** (perfil/perfil_permissao) configuráveis pelo Administrador.
- **Escopo do usuário** (user_scope / usuario_escopo): limita o que cada usuário enxerga (por departamento, setor ou pasta).
- **Simulador de Acesso**: permite verificar o que um usuário consegue acessar antes de aplicar.
- **Dashboard de Segurança**: indicadores de configuração e exposição de permissões.
- **Auditoria de Usuários** (user_audit_log): login, criação, alteração e remoção.

## 6. Usuários
- Convite/criação de usuários pelo Admin da organização.
- Definição de papel, perfis de permissão e escopo.
- Ativação/desativação de contas.
- Reset de senha via edge function (sem expor service role).
- Validação de telefone com regex (sem SMS).

## 7. Pastas e Setores
- Criação de pastas dentro de departamentos/setores.
- Permissões por pasta e por usuário autorizado (folder_authorized_users).
- Documentos autorizados por usuário (documento_usuario_autorizado) para casos sensíveis.

## 8. Integrações
- **Google Drive**: conexão OAuth da organização, listagem e importação de arquivos via Picker.
- **API Keys da organização**: integração externa para movimentos e consultas.
- **Stripe** (quando habilitado): assinatura, pausas, cancelamento, reativação.

## 9. Assinatura e cobrança
- Plano com limites de **páginas contratadas** e **espaço em disco (GB)**.
- Páginas de billing: ativar/pausar/retomar/cancelar assinatura.
- Histórico de uso por organização (organization_usage).

## 10. Configurações
- Configurações da organização (logo, nome, CNPJs vinculados).
- Configurações de GED (geração de nome, regras de versionamento).
- Termos de Uso e Política de Privacidade (LGPD) gerenciados pelo Super Admin.
- Sobre: versão do sistema e informações institucionais.

## 11. Super Admin
- Gestão multiempresa: organizações, planos, usuários globais.
- Auditoria do sistema (system_audit_log) e analytics do chatbot.
- Configuração de Stripe, termos legais e parâmetros globais.

# Como você deve responder
1. Se a pergunta for sobre **como fazer** algo, explique o caminho passo a passo no menu (ex.: "Vá em **Gestão → Documentos**, clique em **Novo Documento**...").
2. Se a pergunta envolver **permissões**, lembre o usuário do papel necessário (Administrador, Gestor, Super Admin).
3. Se a pergunta estiver fora do escopo do Nexo GED (assuntos pessoais, política, etc.), recuse educadamente e ofereça ajuda com o sistema.
4. Para problemas técnicos críticos (faturamento, dados perdidos, contrato), oriente a abrir um chamado com o suporte humano.
5. Nunca invente funcionalidades que não estão na lista acima. Se não souber, diga que não tem essa informação e sugira contatar o Administrador da organização.
6. Não exponha IDs internos, tokens, chaves ou estrutura técnica do banco.

Mantenha respostas concisas (em geral, até 8 linhas) e use listas quando houver mais de 2 itens.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: "Payload inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages: ChatMessage[] = body.messages;
    const userContext: UserContext = body.userContext || {};

    const contextLine =
      `Contexto do usuário atual:\n` +
      `- Nome: ${userContext.name || "Não informado"}\n` +
      `- Papel: ${userContext.role || "Não informado"}\n` +
      `- Organização: ${userContext.organization || "Não informada"}`;

    const fullMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextLine },
      ...messages.filter((m) => m.role === "user" || m.role === "assistant"),
    ];

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: fullMessages,
      }),
    });

    if (!upstream.ok) {
      const status = upstream.status;
      let errorMsg = "Erro ao consultar a IA.";
      if (status === 429) errorMsg = "Limite de requisições atingido. Tente novamente em instantes.";
      if (status === 402) errorMsg = "Créditos de IA esgotados. Avise o administrador da workspace.";
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Erro inesperado." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

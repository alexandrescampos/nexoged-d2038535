import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_documents",
  title: "Buscar documentos",
  description:
    "Busca documentos do GED visíveis para o usuário autenticado, por texto no título/descrição, status ou tipo.",
  inputSchema: {
    query: z.string().trim().optional().describe("Texto para buscar no título ou descrição."),
    status: z.string().trim().optional().describe("Filtra pelo status do documento (ex.: ATIVO)."),
    document_type: z.string().trim().optional().describe("Filtra pelo tipo de documento (texto)."),
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de resultados (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, status, document_type, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }

    const supabase = supabaseForUser(ctx);
    let request = supabase
      .from("ged_documents")
      .select(
        "id, title, description, document_type, status, tags, expiration_date, document_creation_date, created_at, updated_at",
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);

    if (query) {
      const escaped = query.replace(/[%,()]/g, " ").trim();
      if (escaped) request = request.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }
    if (status) request = request.eq("status", status);
    if (document_type) request = request.eq("document_type", document_type);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { documents: data ?? [] },
    };
  },
});

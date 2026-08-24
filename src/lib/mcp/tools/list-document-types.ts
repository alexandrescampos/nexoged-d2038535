import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_document_types",
  title: "Listar tipos de documento",
  description: "Lista os tipos de documento configurados na organização do usuário autenticado.",
  inputSchema: {
    only_active: z.boolean().optional().describe("Retorna apenas os tipos ativos (padrão true)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_active }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }

    const supabase = supabaseForUser(ctx);
    let request = supabase
      .from("ged_document_types")
      .select("id, name, initials, description, requires_expiration_date, requires_creation_date, ativo")
      .order("name", { ascending: true });

    if (only_active !== false) request = request.eq("ativo", true);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { document_types: data ?? [] },
    };
  },
});

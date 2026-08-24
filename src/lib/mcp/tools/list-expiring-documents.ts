import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_expiring_documents",
  title: "Documentos a vencer",
  description:
    "Lista documentos com data de validade dentro dos próximos N dias (inclui os já vencidos, se solicitado).",
  inputSchema: {
    days: z.number().int().min(1).max(365).optional().describe("Janela em dias (padrão 30)."),
    include_expired: z.boolean().optional().describe("Inclui documentos já vencidos (padrão true)."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, include_expired, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }

    const windowDays = days ?? 30;
    const today = new Date();
    const until = new Date(today.getTime() + windowDays * 24 * 60 * 60 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const supabase = supabaseForUser(ctx);
    let request = supabase
      .from("ged_documents")
      .select("id, title, document_type, status, expiration_date")
      .is("deleted_at", null)
      .not("expiration_date", "is", null)
      .lte("expiration_date", iso(until))
      .order("expiration_date", { ascending: true })
      .limit(limit ?? 50);

    if (include_expired === false) request = request.gte("expiration_date", iso(today));

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { documents: data ?? [], window_days: windowDays },
    };
  },
});

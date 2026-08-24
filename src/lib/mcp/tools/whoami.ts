import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Usuário conectado",
  description: "Retorna o usuário autenticado e a organização à qual ele pertence.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }

    const supabase = supabaseForUser(ctx);
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, organization_id")
      .eq("id", ctx.getUserId() ?? "")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    let organization: unknown = null;
    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name, plan, status")
        .eq("id", profile.organization_id)
        .maybeSingle();
      organization = org ?? null;
    }

    const payload = { user: profile ?? { id: ctx.getUserId(), email: ctx.getUserEmail() }, organization };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

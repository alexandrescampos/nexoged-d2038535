import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchDocumentsTool from "./tools/search-documents";
import getDocumentTool from "./tools/get-document";
import listExpiringDocumentsTool from "./tools/list-expiring-documents";
import listDocumentTypesTool from "./tools/list-document-types";
import whoamiTool from "./tools/whoami";

// O issuer OAuth precisa ser o host direto do Supabase, construído a partir do
// project ref (inlineado pelo Vite no build) — nunca a partir de SUPABASE_URL.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "nexo-ged",
  title: "Nexo GED",
  version: "0.1.0",
  instructions:
    "Ferramentas do Nexo GED (gestão eletrônica de documentos). Use `whoami` para identificar o usuário e a organização, `search_documents` e `get_document` para consultar documentos, `list_expiring_documents` para vencimentos e `list_document_types` para os tipos configurados. Todos os dados respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    searchDocumentsTool,
    getDocumentTool,
    listExpiringDocumentsTool,
    listDocumentTypesTool,
  ],
});

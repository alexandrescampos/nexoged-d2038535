import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

type PublicEndpoint = "epi-movements" | "stock-update" | "employee-upsert";

type UserContext = {
  userId: string;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  organizationId: string | null;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const parseDdMmYyyy = (input: string | null) => {
  if (!input || !/^\d{2}\/\d{2}\/\d{4}$/.test(input)) return null;

  const [dayString, monthString, yearString] = input.split("/");
  const day = Number(dayString);
  const month = Number(monthString);
  const year = Number(yearString);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearString}-${monthString}-${dayString}`;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  return toHex(await crypto.subtle.digest("SHA-256", data));
};

const generateApiKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const random = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `nexo_${random}`;
};

const resolvePublicEndpoint = (url: URL): PublicEndpoint | null => {
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments.at(-1);

  if (lastSegment === "epi-movements" || lastSegment === "stock-update" || lastSegment === "employee-upsert") {
    return lastSegment;
  }

  return null;
};

const resolveRequestMode = (url: URL) => {
  return resolvePublicEndpoint(url) ? "public" : "management";
};

const unauthorized = () =>
  new Response(JSON.stringify({ error: "Não autorizado" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const validateApiKey = async (req: Request, supabaseAdmin: ReturnType<typeof createClient>) => {
  const apiKey = req.headers.get("X-API-Key")?.trim();
  if (!apiKey) {
    throw jsonResponse({ error: "X-API-Key é obrigatório" }, 401);
  }

  const keyHash = await sha256(apiKey);
  const { data: apiKeyRow, error: apiKeyError } = await supabaseAdmin
    .from("organization_api_keys")
    .select("id, organization_id, is_active")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (apiKeyError) {
    console.error("organization-api key lookup error", apiKeyError);
    throw jsonResponse({ error: "Erro ao validar chave" }, 500);
  }

  if (!apiKeyRow || !apiKeyRow.is_active) {
    throw jsonResponse({ error: "Chave inválida ou revogada" }, 401);
  }

  return apiKeyRow;
};

const logApiUsage = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    organizationId: string;
    apiKeyId: string | null;
    endpoint: string;
    method: string;
    statusCode: number;
    success: boolean;
    errorMessage?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) => {
  try {
    await supabaseAdmin.from("organization_api_usage_log").insert({
      organization_id: params.organizationId,
      api_key_id: params.apiKeyId,
      endpoint: params.endpoint,
      method: params.method,
      status_code: params.statusCode,
      success: params.success,
      error_message: params.errorMessage ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    });

    // Best-effort cleanup: 5% chance of pruning records older than 30 days
    if (Math.random() < 0.05) {
      await supabaseAdmin.rpc("cleanup_api_usage_log");
    }
  } catch (err) {
    console.error("organization-api log error", err);
  }
};

const extractClientIp = (req: Request): string | null => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
};

const touchApiKey = async (supabaseAdmin: ReturnType<typeof createClient>, apiKeyId: string) => {
  const { error } = await supabaseAdmin
    .from("organization_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKeyId);

  if (error) {
    console.error("organization-api update last_used_at error", error);
  }
};

const getAuthenticatedUser = async (
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw unauthorized();
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    throw unauthorized();
  }

  const userId = userData.user.id;

  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("organization_id").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (profileError || rolesError) {
    throw jsonResponse({ error: "Erro ao validar usuário" }, 500);
  }

  const roleList = roles?.map((item) => item.role) ?? [];

  return {
    userId,
    organizationId: profile?.organization_id ?? null,
    isSuperAdmin: roleList.includes("super_admin"),
    isOrgAdmin: roleList.includes("org_admin"),
  } satisfies UserContext;
};

const resolveTargetOrganization = (requestOrganizationId: string | null, user: UserContext) => {
  if (!user.isSuperAdmin && !user.isOrgAdmin) {
    throw jsonResponse({ error: "Apenas administradores podem gerenciar a integração" }, 403);
  }

  if (user.isSuperAdmin) {
    if (!requestOrganizationId) {
      throw jsonResponse({ error: "organizationId é obrigatório para super admin" }, 400);
    }

    return requestOrganizationId;
  }

  if (!user.organizationId) {
    throw jsonResponse({ error: "Usuário sem organização vinculada" }, 403);
  }

  if (requestOrganizationId && requestOrganizationId !== user.organizationId) {
    throw jsonResponse({ error: "Acesso negado para esta organização" }, 403);
  }

  return user.organizationId;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: "Credenciais do backend não configuradas" }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const url = new URL(req.url);
    const mode = resolveRequestMode(url);

    if (mode === "public") {
      const publicEndpoint = resolvePublicEndpoint(url);
      const ipAddress = extractClientIp(req);
      const userAgent = req.headers.get("user-agent");
      let logApiKeyId: string | null = null;
      let logOrganizationId: string | null = null;

      const runPublic = async (): Promise<Response> => {
        if (publicEndpoint === "epi-movements") {
          if (req.method !== "GET") {
            return jsonResponse({ error: "Método não suportado" }, 405);
          }

          const apiKeyRow = await validateApiKey(req, supabaseAdmin);
          logApiKeyId = apiKeyRow.id;
          logOrganizationId = apiKeyRow.organization_id;

          const referenceDate = url.searchParams.get("date");
          const parsedDate = parseDdMmYyyy(referenceDate);
          if (!parsedDate || !referenceDate) {
            return jsonResponse({ error: "A data deve estar no formato dd/mm/yyyy" }, 400);
          }

          const dateObj = new Date(`${parsedDate}T00:00:00Z`);
          dateObj.setUTCDate(dateObj.getUTCDate() + 1);
          const nextDay = dateObj.toISOString().slice(0, 10);

          const cnpjFilter = url.searchParams.get("cnpj")?.replace(/\D/g, "").trim() || "";
          let employeeIdsForCnpj: string[] | null = null;

          if (cnpjFilter) {
            const { data: cnpjRow } = await supabaseAdmin
              .from("organization_cnpjs")
              .select("id")
              .eq("organization_id", apiKeyRow.organization_id)
              .eq("cnpj", cnpjFilter)
              .eq("is_active", true)
              .maybeSingle();

            if (!cnpjRow) {
              return jsonResponse({ error: "CNPJ não encontrado para esta organização" }, 404);
            }

            const { data: employees } = await supabaseAdmin
              .from("employees")
              .select("id")
              .eq("organization_id", apiKeyRow.organization_id)
              .eq("organization_cnpj_id", cnpjRow.id);

            employeeIdsForCnpj = (employees ?? []).map((e) => e.id);
          }

          let query = supabaseAdmin
            .from("epi_deliveries")
            .select("delivery_date, quantity, stock_source, notes, epis(code), employee_record_id, employees!epi_deliveries_employee_record_id_fkey(organization_cnpj_id, organization_cnpjs(cnpj, company_name))")
            .eq("organization_id", apiKeyRow.organization_id)
            .gte("delivery_date", `${parsedDate}T00:00:00.000Z`)
            .lt("delivery_date", `${nextDay}T00:00:00.000Z`)
            .order("created_at", { ascending: true });

          if (employeeIdsForCnpj !== null) {
            if (employeeIdsForCnpj.length === 0) {
              await touchApiKey(supabaseAdmin, apiKeyRow.id);
              return jsonResponse({ date: referenceDate, organization_id: apiKeyRow.organization_id, total: 0, items: [] });
            }
            query = query.in("employee_record_id", employeeIdsForCnpj);
          }

          const { data: deliveries, error: deliveriesError } = await query;

          if (deliveriesError) {
            console.error("organization-api deliveries error", deliveriesError);
            return jsonResponse({ error: "Erro ao buscar movimentações" }, 500);
          }

          await touchApiKey(supabaseAdmin, apiKeyRow.id);

          const items = (deliveries ?? []).map((delivery) => {
            const emp = delivery.employees as { organization_cnpj_id?: string; organization_cnpjs?: { cnpj?: string; company_name?: string } | null } | null;
            return {
              type: (delivery.notes || "").includes("[Troca]") ? "troca" : "entrega",
              delivery_date: delivery.delivery_date,
              epi_code: (delivery.epis as { code?: string } | null)?.code ?? "",
              quantity: delivery.quantity,
              stock_source: delivery.stock_source,
              cnpj: emp?.organization_cnpjs?.cnpj ?? null,
              cnpj_company_name: emp?.organization_cnpjs?.company_name ?? null,
            };
          });

          return jsonResponse({
            date: referenceDate,
            organization_id: apiKeyRow.organization_id,
            total: items.length,
            items,
          });
        }

        if (publicEndpoint === "stock-update") {
          if (req.method !== "POST") {
            return jsonResponse({ error: "Método não suportado" }, 405);
          }

          const apiKeyRow = await validateApiKey(req, supabaseAdmin);
          logApiKeyId = apiKeyRow.id;
          logOrganizationId = apiKeyRow.organization_id;

          const body = await req.json();
          const epiCode = typeof body?.epi_code === "string" ? body.epi_code.trim() : "";
          const stockQuantity = body?.stock_quantity;
          const cnpjInput = typeof body?.cnpj === "string" ? body.cnpj.replace(/\D/g, "").trim() : "";

          if (!epiCode) {
            return jsonResponse({ error: "epi_code é obrigatório" }, 400);
          }

          if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
            return jsonResponse({ error: "stock_quantity deve ser um número inteiro maior ou igual a zero" }, 400);
          }

          const { data: epi, error: epiError } = await supabaseAdmin
            .from("epis")
            .select("id, code")
            .eq("organization_id", apiKeyRow.organization_id)
            .eq("code", epiCode)
            .maybeSingle();

          if (epiError) {
            console.error("organization-api stock lookup error", epiError);
            return jsonResponse({ error: "Erro ao localizar EPI" }, 500);
          }

          if (!epi) {
            return jsonResponse({ error: "EPI não encontrado para esta organização" }, 404);
          }

          let targetCnpjId: string;

          if (cnpjInput) {
            const { data: cnpjRow, error: cnpjErr } = await supabaseAdmin
              .from("organization_cnpjs")
              .select("id")
              .eq("organization_id", apiKeyRow.organization_id)
              .eq("cnpj", cnpjInput)
              .eq("is_active", true)
              .maybeSingle();

            if (cnpjErr) {
              console.error("organization-api cnpj lookup error", cnpjErr);
              return jsonResponse({ error: "Erro ao localizar CNPJ" }, 500);
            }
            if (!cnpjRow) {
              return jsonResponse({ error: "CNPJ não encontrado para esta organização" }, 404);
            }
            targetCnpjId = cnpjRow.id;
          } else {
            const { data: cnpjs, error: cnpjsErr } = await supabaseAdmin
              .from("organization_cnpjs")
              .select("id")
              .eq("organization_id", apiKeyRow.organization_id)
              .eq("is_active", true);

            if (cnpjsErr) {
              console.error("organization-api cnpjs lookup error", cnpjsErr);
              return jsonResponse({ error: "Erro ao buscar CNPJs" }, 500);
            }

            if (!cnpjs || cnpjs.length === 0) {
              return jsonResponse({ error: "Nenhum CNPJ cadastrado para esta organização" }, 400);
            }

            if (cnpjs.length > 1) {
              return jsonResponse({ error: "Organização possui múltiplos CNPJs. O campo 'cnpj' é obrigatório." }, 400);
            }

            targetCnpjId = cnpjs[0].id;
          }

          const { data: existingStock } = await supabaseAdmin
            .from("epi_cnpj_stock")
            .select("id")
            .eq("epi_id", epi.id)
            .eq("organization_cnpj_id", targetCnpjId)
            .maybeSingle();

          if (existingStock) {
            const { error: updateError } = await supabaseAdmin
              .from("epi_cnpj_stock")
              .update({ stock_quantity: stockQuantity })
              .eq("id", existingStock.id);
            if (updateError) {
              console.error("organization-api stock update error", updateError);
              return jsonResponse({ error: "Erro ao atualizar estoque" }, 500);
            }
          } else {
            const { error: insertError } = await supabaseAdmin
              .from("epi_cnpj_stock")
              .insert({
                epi_id: epi.id,
                organization_cnpj_id: targetCnpjId,
                organization_id: apiKeyRow.organization_id,
                stock_quantity: stockQuantity,
              });
            if (insertError) {
              console.error("organization-api stock insert error", insertError);
              return jsonResponse({ error: "Erro ao criar registro de estoque" }, 500);
            }
          }

          await touchApiKey(supabaseAdmin, apiKeyRow.id);

          return jsonResponse({
            success: true,
            organization_id: apiKeyRow.organization_id,
            epi_code: epi.code,
            stock_quantity: stockQuantity,
            cnpj: cnpjInput || undefined,
          });
        }

        if (publicEndpoint === "employee-upsert") {
          if (req.method !== "POST") {
            return jsonResponse({ error: "Método não suportado" }, 405);
          }

          const apiKeyRow = await validateApiKey(req, supabaseAdmin);
          logApiKeyId = apiKeyRow.id;
          logOrganizationId = apiKeyRow.organization_id;

          let body: Record<string, unknown>;
          try {
            body = await req.json();
          } catch {
            return jsonResponse({ error: "JSON inválido" }, 400);
          }

          const cpfRaw = typeof body?.cpf === "string" ? body.cpf.replace(/\D/g, "").trim() : "";
          if (cpfRaw.length !== 11) {
            return jsonResponse({ error: "cpf é obrigatório e deve conter 11 dígitos" }, 400);
          }

          const cnpjInput = typeof body?.cnpj === "string" ? body.cnpj.replace(/\D/g, "").trim() : "";
          if (!cnpjInput) {
            return jsonResponse({ error: "cnpj é obrigatório" }, 400);
          }

          const nameInput = typeof body?.name === "string" ? body.name.trim() : "";
          const sectorName = typeof body?.sector_name === "string" ? body.sector_name.trim() : "";
          const jobFunctionName = typeof body?.job_function_name === "string" ? body.job_function_name.trim() : "";
          const registrationNumber = typeof body?.registration_number === "string" ? body.registration_number.trim() : undefined;
          const ctpsNumber = typeof body?.ctps_number === "string" ? body.ctps_number.trim() : undefined;
          const shirtSize = typeof body?.shirt_size === "string" ? body.shirt_size.trim() : undefined;
          const pantsSize = typeof body?.pants_size === "string" ? body.pants_size.trim() : undefined;
          const shoeSize = typeof body?.shoe_size === "string" ? body.shoe_size.trim() : undefined;
          const isActiveInput = typeof body?.is_active === "boolean" ? body.is_active : undefined;

          const admissionInput = body?.admission_date;
          let admissionDate: string | null | undefined = undefined;
          if (admissionInput === null) admissionDate = null;
          else if (typeof admissionInput === "string" && admissionInput.length > 0) {
            const parsed = parseDdMmYyyy(admissionInput);
            if (!parsed) return jsonResponse({ error: "admission_date deve estar no formato dd/mm/yyyy" }, 400);
            admissionDate = parsed;
          }

          const terminationInput = body?.termination_date;
          let terminationDate: string | null | undefined = undefined;
          if (terminationInput === null) terminationDate = null;
          else if (typeof terminationInput === "string" && terminationInput.length > 0) {
            const parsed = parseDdMmYyyy(terminationInput);
            if (!parsed) return jsonResponse({ error: "termination_date deve estar no formato dd/mm/yyyy" }, 400);
            terminationDate = parsed;
          }

          // Validate CNPJ belongs to org
          const { data: cnpjRow, error: cnpjErr } = await supabaseAdmin
            .from("organization_cnpjs")
            .select("id")
            .eq("organization_id", apiKeyRow.organization_id)
            .eq("cnpj", cnpjInput)
            .eq("is_active", true)
            .maybeSingle();

          if (cnpjErr) {
            console.error("organization-api employee cnpj lookup error", cnpjErr);
            return jsonResponse({ error: "Erro ao localizar CNPJ" }, 500);
          }
          if (!cnpjRow) {
            return jsonResponse({ error: "CNPJ não encontrado para esta organização" }, 404);
          }

          // Resolve sector by name
          let sectorId: string | null | undefined = undefined;
          if (sectorName) {
            const { data: sectors, error: secErr } = await supabaseAdmin
              .from("sectors")
              .select("id, name")
              .eq("organization_id", apiKeyRow.organization_id)
              .eq("is_active", true);
            if (secErr) {
              console.error("organization-api sector lookup error", secErr);
              return jsonResponse({ error: "Erro ao buscar setores" }, 500);
            }
            const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const target = norm(sectorName);
            const found = (sectors ?? []).find((s) => norm(String(s.name ?? "")) === target);
            if (!found) {
              return jsonResponse({ error: `Setor não encontrado: ${sectorName}` }, 404);
            }
            sectorId = found.id;
          }

          // Resolve job function by name
          let jobFunctionId: string | null | undefined = undefined;
          if (jobFunctionName) {
            let q = supabaseAdmin
              .from("job_functions")
              .select("id, name, sector_id")
              .eq("organization_id", apiKeyRow.organization_id)
              .eq("is_active", true);
            const { data: functions, error: funcErr } = await q;
            if (funcErr) {
              console.error("organization-api job_function lookup error", funcErr);
              return jsonResponse({ error: "Erro ao buscar funções" }, 500);
            }
            const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const target = norm(jobFunctionName);
            const matches = (functions ?? []).filter((f) => norm(String(f.name ?? "")) === target);
            const preferred = sectorId
              ? matches.find((f) => f.sector_id === sectorId) ?? matches[0]
              : matches[0];
            if (!preferred) {
              return jsonResponse({ error: `Função não encontrada: ${jobFunctionName}` }, 404);
            }
            jobFunctionId = preferred.id;
          }

          // Lookup existing employee by CPF
          const { data: existing, error: existingErr } = await supabaseAdmin
            .from("employees")
            .select("id")
            .eq("organization_id", apiKeyRow.organization_id)
            .eq("cpf", cpfRaw)
            .maybeSingle();

          if (existingErr) {
            console.error("organization-api employee lookup error", existingErr);
            return jsonResponse({ error: "Erro ao localizar funcionário" }, 500);
          }

          if (existing) {
            const updatePayload: Record<string, unknown> = {
              organization_cnpj_id: cnpjRow.id,
            };
            if (nameInput) updatePayload.name = nameInput;
            if (registrationNumber !== undefined) updatePayload.registration_number = registrationNumber || null;
            if (ctpsNumber !== undefined) updatePayload.ctps_number = ctpsNumber || null;
            if (shirtSize !== undefined) updatePayload.shirt_size = shirtSize || null;
            if (pantsSize !== undefined) updatePayload.pants_size = pantsSize || null;
            if (shoeSize !== undefined) updatePayload.shoe_size = shoeSize || null;
            if (admissionDate !== undefined) updatePayload.admission_date = admissionDate;
            if (terminationDate !== undefined) updatePayload.termination_date = terminationDate;
            if (sectorId !== undefined) updatePayload.sector_id = sectorId;
            if (jobFunctionId !== undefined) updatePayload.job_function_id = jobFunctionId;
            if (isActiveInput !== undefined) updatePayload.is_active = isActiveInput;

            const { error: updErr } = await supabaseAdmin
              .from("employees")
              .update(updatePayload)
              .eq("id", existing.id);

            if (updErr) {
              console.error("organization-api employee update error", updErr);
              return jsonResponse({ error: "Erro ao atualizar funcionário" }, 500);
            }

            await touchApiKey(supabaseAdmin, apiKeyRow.id);
            return jsonResponse({
              success: true,
              action: "updated",
              employee_id: existing.id,
              cpf: cpfRaw,
              cnpj: cnpjInput,
            });
          }

          // Create
          if (!nameInput) {
            return jsonResponse({ error: "name é obrigatório para criar funcionário" }, 400);
          }

          const insertPayload: Record<string, unknown> = {
            organization_id: apiKeyRow.organization_id,
            organization_cnpj_id: cnpjRow.id,
            cpf: cpfRaw,
            name: nameInput,
            is_active: isActiveInput ?? true,
          };
          if (registrationNumber) insertPayload.registration_number = registrationNumber;
          if (ctpsNumber) insertPayload.ctps_number = ctpsNumber;
          if (shirtSize) insertPayload.shirt_size = shirtSize;
          if (pantsSize) insertPayload.pants_size = pantsSize;
          if (shoeSize) insertPayload.shoe_size = shoeSize;
          if (admissionDate) insertPayload.admission_date = admissionDate;
          if (terminationDate) insertPayload.termination_date = terminationDate;
          if (sectorId) insertPayload.sector_id = sectorId;
          if (jobFunctionId) insertPayload.job_function_id = jobFunctionId;

          const { data: created, error: insErr } = await supabaseAdmin
            .from("employees")
            .insert(insertPayload)
            .select("id")
            .single();

          if (insErr) {
            console.error("organization-api employee insert error", insErr);
            return jsonResponse({ error: "Erro ao criar funcionário" }, 500);
          }

          await touchApiKey(supabaseAdmin, apiKeyRow.id);
          return jsonResponse({
            success: true,
            action: "created",
            employee_id: created.id,
            cpf: cpfRaw,
            cnpj: cnpjInput,
          });
        }

        return jsonResponse({ error: "Endpoint público inválido" }, 404);
      };

      let response: Response;
      try {
        response = await runPublic();
      } catch (err) {
        if (err instanceof Response) {
          response = err;
        } else {
          console.error("organization-api public unexpected error", err);
          response = jsonResponse({ error: "Erro interno" }, 500);
        }
      }

      if (logOrganizationId && publicEndpoint) {
        let errorMessage: string | null = null;
        if (response.status >= 400) {
          try {
            const cloned = response.clone();
            const body = await cloned.json();
            errorMessage = typeof body?.error === "string" ? body.error : null;
          } catch {
            errorMessage = null;
          }
        }
        await logApiUsage(supabaseAdmin, {
          organizationId: logOrganizationId,
          apiKeyId: logApiKeyId,
          endpoint: publicEndpoint,
          method: req.method,
          statusCode: response.status,
          success: response.status < 400,
          errorMessage,
          ipAddress,
          userAgent,
        });
      }

      return response;
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Método não suportado" }, 405);
    }

    const body = await req.json();
    const user = await getAuthenticatedUser(req, supabaseAdmin);
    const action = typeof body?.action === "string" ? body.action : "";
    const targetOrganizationId = resolveTargetOrganization(body?.organizationId ?? null, user);

    if (action === "list-keys") {
      const { data: keys, error } = await supabaseAdmin
        .from("organization_api_keys")
        .select("id, name, key_prefix, is_active, last_used_at, created_at, revoked_at")
        .eq("organization_id", targetOrganizationId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("organization-api list error", error);
        return jsonResponse({ error: "Erro ao listar chaves" }, 500);
      }

      return jsonResponse({ keys: keys ?? [] });
    }

    if (action === "generate-key") {
      const plaintextKey = generateApiKey();
      const keyPrefix = plaintextKey.slice(0, 12);
      const keyHash = await sha256(plaintextKey);
      const now = new Date().toISOString();

      const { error: revokeError } = await supabaseAdmin
        .from("organization_api_keys")
        .update({ is_active: false, revoked_at: now })
        .eq("organization_id", targetOrganizationId)
        .eq("is_active", true);

      if (revokeError) {
        console.error("organization-api revoke previous error", revokeError);
        return jsonResponse({ error: "Erro ao preparar rotação da chave" }, 500);
      }

      const { error: insertError } = await supabaseAdmin.from("organization_api_keys").insert({
        organization_id: targetOrganizationId,
        name: "Chave principal",
        key_prefix: keyPrefix,
        key_hash: keyHash,
        is_active: true,
        created_by: user.userId,
      });

      if (insertError) {
        console.error("organization-api insert error", insertError);
        return jsonResponse({ error: "Erro ao gerar chave" }, 500);
      }

      return jsonResponse({ apiKey: plaintextKey, keyPrefix });
    }

    if (action === "revoke-key") {
      const { error } = await supabaseAdmin
        .from("organization_api_keys")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("organization_id", targetOrganizationId)
        .eq("is_active", true);

      if (error) {
        console.error("organization-api revoke error", error);
        return jsonResponse({ error: "Erro ao revogar chave" }, 500);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("organization-api unexpected error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno do servidor" }, 500);
  }
});
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

/**
 * Ensures the auth session is fresh before invoking an edge function.
 * If the session is missing/expired and cannot be refreshed, redirects to /auth.
 *
 * Returns { data, error } in the same shape as supabase.functions.invoke.
 * If a 401/expired-token response comes back, signs the user out and redirects.
 */
export async function invokeEdgeFunction<T = any>(
  name: string,
  body?: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  // 1. Ensure we have a valid session
  let { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    sessionData = { session: refreshed.session } as typeof sessionData;
  }

  if (!sessionData.session) {
    await handleSessionExpired();
    return { data: null, error: new Error("Sessão expirada. Faça login novamente.") };
  }

  // 2. Invoke
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let message = error.message || "Erro desconhecido";
    let status: number | undefined;

    if (error instanceof FunctionsHttpError) {
      try {
        const ctx: any = await error.context.json();
        if (ctx?.error) message = ctx.error;
        status = error.context?.status;
      } catch {
        status = error.context?.status;
      }
    }

    if (
      status === 401 ||
      /invalid or expired token|token inválido|token invalido|token expirado|sessão expirada|sessao expirada|session/i.test(
        message
      )
    ) {
      await handleSessionExpired();
      return { data: null, error: new Error("Sessão expirada. Faça login novamente.") };
    }

    return { data: null, error: new Error(message) };
  }

  if ((data as any)?.error) {
    return { data: null, error: new Error((data as any).error) };
  }

  return { data: data as T, error: null };
}

async function handleSessionExpired() {
  try {
    toast.error("Sessão expirada. Faça login novamente.", {
      action: {
        label: "Ir para login",
        onClick: () => {
          if (typeof window !== "undefined") {
            window.location.href = "/auth";
          }
        },
      },
    });
  } catch {
    // ignore
  }
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
    window.location.href = "/auth";
  }
}

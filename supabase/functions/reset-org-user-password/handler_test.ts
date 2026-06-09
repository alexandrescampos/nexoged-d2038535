import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Helper to simulate the response logic from the edge function
function getFriendlyError(error: any) {
  const errorCode = error.code || "";
  const errorMessage = error.message?.toLowerCase() || "";
  
  let friendly = error.message;
  let statusCode = 400;

  if (errorCode === "weak_password" || errorMessage.includes("weak")) {
    friendly = "Esta senha foi encontrada em vazamentos públicos de dados e não pode ser usada. Escolha uma senha diferente e mais original.";
  } else if (errorCode === "session_not_found" || errorMessage.includes("expired") || errorMessage.includes("invalid token")) {
    friendly = "Sua sessão ou token expirou. Por favor, faça login novamente.";
    statusCode = 401;
  } else if (errorMessage.includes("user not found")) {
    friendly = "Usuário não encontrado no sistema.";
    statusCode = 404;
  } else if (errorMessage.includes("unexpected error")) {
    friendly = "Ocorreu um erro inesperado. Tente novamente em alguns minutos.";
    statusCode = 500;
  }

  return { friendly, statusCode };
}

Deno.test("Password Reset - HIBP / Weak Password Error", () => {
  const mockError = { code: "weak_password", message: "Password is too weak" };
  const { friendly, statusCode } = getFriendlyError(mockError);
  
  assertEquals(statusCode, 400);
  assertEquals(friendly, "Esta senha foi encontrada em vazamentos públicos de dados e não pode ser usada. Escolha uma senha diferente e mais original.");
});

Deno.test("Password Reset - Expired Session / Token Error", () => {
  const mockError = { code: "session_not_found", message: "Session expired" };
  const { friendly, statusCode } = getFriendlyError(mockError);
  
  assertEquals(statusCode, 401);
  assertEquals(friendly, "Sua sessão ou token expirou. Por favor, faça login novamente.");
});

Deno.test("Password Reset - User Not Found Error", () => {
  const mockError = { message: "User not found" };
  const { friendly, statusCode } = getFriendlyError(mockError);
  
  assertEquals(statusCode, 404);
  assertEquals(friendly, "Usuário não encontrado no sistema.");
});

Deno.test("Password Reset - Unexpected Error", () => {
  const mockError = { message: "Unexpected error occurred" };
  const { friendly, statusCode } = getFriendlyError(mockError);
  
  assertEquals(statusCode, 500);
  assertEquals(friendly, "Ocorreu um erro inesperado. Tente novamente em alguns minutos.");
});

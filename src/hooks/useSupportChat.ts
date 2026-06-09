import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useSupportChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { profile, roles, organization } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const getUserContext = useCallback(() => {
    const roleLabel = roles.includes("org_admin")
      ? "Administrador"
      : roles.includes("user")
        ? "Gestor"
        : "Usuário";
    return {
      name: profile?.full_name || "Não informado",
      role: roleLabel,
      organization: organization?.name || "Não informada",
      organization_id: organization?.id,
      user_id: profile?.id,
    };
  }, [profile, roles, organization]);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      const allMessages = [...messages, userMsg];
      setMessages(allMessages);
      setIsLoading(true);

      abortRef.current = new AbortController();
      let assistantSoFar = "";

      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
              userContext: getUserContext(),
            }),
            signal: abortRef.current.signal,
          }
        );

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Erro de conexão" }));
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: err.error || "Desculpe, ocorreu um erro. Tente novamente." },
          ]);
          setIsLoading(false);
          return;
        }

        if (!resp.body) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Desculpe, não foi possível obter resposta." },
          ]);
          setIsLoading(false);
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        const upsertAssistant = (chunk: string) => {
          assistantSoFar += chunk;
          const current = assistantSoFar;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: current } : m));
            }
            return [...prev, { role: "assistant", content: current }];
          });
        };

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Flush remaining
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch { /* ignore */ }
          }
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Desculpe, ocorreu um erro de conexão. Tente novamente." },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages, getUserContext]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return { messages, isLoading, isOpen, sendMessage, clearMessages, toggleOpen };
}

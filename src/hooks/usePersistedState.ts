import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useState que persiste automaticamente em sessionStorage.
 *
 * - O estado é preservado ao trocar de aba, recarregar a página ou voltar
 *   pelo histórico. É descartado quando o navegador é fechado.
 * - A chave deve ser única dentro da aplicação (ex.: "epi-categories:dialog").
 * - O valor precisa ser serializável em JSON.
 *
 * API idêntica ao `useState`, retornando também um `reset()` que limpa o
 * armazenamento e volta ao valor inicial (útil ao salvar/cancelar).
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const initialRef = useRef(initialValue);

  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignora QuotaExceededError e similares
    }
  }, [key, state]);

  const reset = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    setState(initialRef.current);
  }, [key]);

  return [state, setState, reset];
}

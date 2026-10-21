import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const SessionContext = createContext(null);

// Estados possíveis: "a-carregar" | "autenticado" | "anonimo"
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [estado, setEstado] = useState("a-carregar");

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const res = await fetch("/api/session");
        if (!res.ok) throw new Error("sem sessao");
        const data = await res.json();
        if (cancelado) return;
        if (!data?.user) {
          setEstado("anonimo");
          return;
        }
        setUser(data.user);
        setEstado("autenticado");
      } catch {
        if (cancelado) return;
        setUser(null);
        setEstado("anonimo");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  const entrar = useCallback(async (email, password) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "credenciais_invalidas");
    }
    const data = await res.json();
    setUser(data.user);
    setEstado("autenticado");
    return data.user;
  }, []);

  const sair = useCallback(async () => {
    // Limpa a sessão local de imediato: o logout no servidor é best-effort
    // e não pode deixar o utilizador preso no painel.
    setUser(null);
    setEstado("anonimo");
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // Ignorado de propósito: a sessão local já foi terminada.
    }
  }, []);

  const valor = useMemo(
    () => ({ user, estado, entrar, sair }),
    [user, estado, entrar, sair]
  );

  return (
    <SessionContext.Provider value={valor}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const contexto = useContext(SessionContext);
  if (!contexto) {
    throw new Error("useSession tem de ser usado dentro de SessionProvider");
  }
  return contexto;
}

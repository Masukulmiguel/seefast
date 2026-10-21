import { useCallback, useEffect, useState } from "react";

// Carrega uma coleção da API e gere os estados de carregamento/erro.
// `chave` é o nome do array dentro do payload JSON (ex.: "devices").
export function useApiCollection(endpoint, chave) {
  const [status, setStatus] = useState("loading");
  const [items, setItems] = useState([]);
  const [gatilho, setGatilho] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data[chave]) ? data[chave] : []);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [endpoint, chave, gatilho]);

  // Recarrega a coleção (usado depois de uma escrita).
  const recarregar = useCallback(() => setGatilho((c) => c + 1), []);

  return { status, items, recarregar };
}

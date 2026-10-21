import { useCallback, useEffect, useState } from "react";

// Carrega uma coleção da API e gere os estados de carregamento/erro.
// `chave` é o nome do array dentro do payload JSON (ex.: "devices").
// `intervaloMs` (opcional) volta a perguntar à API com essa periodicidade.
export function useApiCollection(endpoint, chave, { intervaloMs = 0 } = {}) {
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

    let intervalo = null;
    if (intervaloMs > 0) {
      intervalo = setInterval(() => {
        if (!cancelled) load();
      }, intervaloMs);
    }

    return () => {
      cancelled = true;
      if (intervalo) clearInterval(intervalo);
    };
  }, [endpoint, chave, gatilho, intervaloMs]);

  // Recarrega a coleção (usado depois de uma escrita).
  const recarregar = useCallback(() => setGatilho((c) => c + 1), []);

  return { status, items, recarregar };
}

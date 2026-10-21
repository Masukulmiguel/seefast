import { useEffect, useState } from "react";

export default function Alerts() {
  const [status, setStatus] = useState("loading");
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/alerts");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1>Alertas</h1>
      <p>Alertas de segurança e de utilização dos dispositivos.</p>

      {status === "loading" && (
        <div className="page-placeholder">
          <p>A carregar alertas…</p>
        </div>
      )}

      {status === "error" && (
        <div className="page-placeholder" role="status">
          <p>
            Não foi possível carregar os alertas. Confirme que o serviço está a
            correr (<code>npm run server</code>).
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="page-placeholder">
          <ul>
            {alerts.map((a) => (
              <li key={a.id}>{a.mensagem}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

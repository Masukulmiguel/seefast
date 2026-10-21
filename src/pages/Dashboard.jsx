import { useEffect, useState } from "react";

export default function Dashboard() {
  const [status, setStatus] = useState("loading");
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [devicesRes, alertsRes] = await Promise.all([
          fetch("/api/devices"),
          fetch("/api/alerts"),
        ]);
        if (!devicesRes.ok || !alertsRes.ok) {
          throw new Error(`HTTP ${devicesRes.status}/${alertsRes.status}`);
        }
        const devicesData = await devicesRes.json();
        const alertsData = await alertsRes.json();
        if (cancelled) return;
        setDevices(Array.isArray(devicesData.devices) ? devicesData.devices : []);
        setAlerts(Array.isArray(alertsData.alerts) ? alertsData.alerts : []);
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
      <h1>Dashboard</h1>
      <p>Visão geral dos dispositivos e da atividade recente.</p>

      {status === "loading" && (
        <div className="page-placeholder">
          <p>A carregar dados da API…</p>
        </div>
      )}

      {status === "error" && (
        <div className="page-placeholder" role="status">
          <p>
            Não foi possível carregar os dados da API. Confirme que o serviço
            está a correr (<code>npm run server</code>).
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="page-placeholder">
          <h2>Dispositivos ({devices.length})</h2>
          <ul>
            {devices.map((d) => (
              <li key={d.id}>
                {d.nome} — {d.estado}, bateria {d.bateria}%
              </li>
            ))}
          </ul>
          <h2>Alertas ({alerts.length})</h2>
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

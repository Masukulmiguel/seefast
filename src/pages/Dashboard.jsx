import { useApiCollection } from "../lib/useApiCollection.js";
import { sortByDateDesc } from "../lib/dates.js";

export default function Dashboard() {
  const dispositivos = useApiCollection("/api/devices", "devices");
  const alertas = useApiCollection("/api/alerts", "alerts");

  const status =
    dispositivos.status === "error" || alertas.status === "error"
      ? "error"
      : dispositivos.status === "ready" && alertas.status === "ready"
        ? "ready"
        : "loading";

  const devices = dispositivos.items;
  const alerts = alertas.items;
  const online = devices.filter((d) => d.estado === "online").length;
  const avgBattery = devices.length
    ? Math.round(
        devices.reduce((total, d) => total + (Number(d.bateria) || 0), 0) /
          devices.length
      )
    : 0;
  const recentAlerts = sortByDateDesc(alerts);

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
        <>
          <dl className="stat-row">
            <div className="stat">
              <dt>Dispositivos</dt>
              <dd>{devices.length}</dd>
            </div>
            <div className="stat">
              <dt>Online</dt>
              <dd>{online}</dd>
            </div>
            <div className="stat">
              <dt>Bateria média</dt>
              <dd>{avgBattery}%</dd>
            </div>
            <div className="stat">
              <dt>Alertas</dt>
              <dd>{alerts.length}</dd>
            </div>
          </dl>

          <div className="page-placeholder">
            <h2>Dispositivos ({devices.length})</h2>
            <ul>
              {devices.map((d) => (
                <li key={d.id}>
                  {d.nome} — {d.estado}, bateria {d.bateria}%
                </li>
              ))}
            </ul>
            <h2>Alertas ({recentAlerts.length})</h2>
            <ul>
              {recentAlerts.map((a) => (
                <li key={a.id}>{a.mensagem}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

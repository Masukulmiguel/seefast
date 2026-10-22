import { useApiCollection } from "../lib/useApiCollection.js";
import {
  IconeAplicacoes,
  IconeLocalizacao,
  IconeTelemovel,
  IconeUtilizadores,
} from "../components/Icones.jsx";

/**
 * Dashboard do administrador (super-admin).
 *
 * Ve todos os clientes que subscreveram o serviço e os dispositivos de cada
 * um. O endpoint /api/clientes e exclusivo do admin (a API devolve 403 a
 * qualquer outro papel).
 */
export default function Admin() {
  const clientes = useApiCollection("/api/clientes", "clientes", {
    intervaloMs: 30000,
  });
  const dispositivos = useApiCollection("/api/devices", "devices", {
    intervaloMs: 30000,
  });

  const listaClientes = clientes.items ?? [];
  const listaDispositivos = dispositivos.items ?? [];
  const online = listaDispositivos.filter((d) => d.estado === "online").length;
  const comDono = listaDispositivos.filter((d) => d.dono).length;
  const semDono = listaDispositivos.length - comDono;

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Administração</h1>
          <p>Os clientes do serviço e os dispositivos que cada um registou.</p>
        </div>
      </div>

      <dl className="stat-row stagger">
        <div className="stat">
          <dt>Clientes</dt>
          <dd>{listaClientes.length}</dd>
          <span className="stat-foot">contas com o papel de cliente</span>
        </div>
        <div className="stat" data-tone="cyan">
          <dt>Dispositivos</dt>
          <dd>{listaDispositivos.length}</dd>
          <span className="stat-foot">em toda a plataforma</span>
        </div>
        <div className="stat" data-tone="muted">
          <dt>Online agora</dt>
          <dd>{online}</dd>
          <span className="stat-foot">a reportar há menos de 30 min</span>
        </div>
        <div className="stat" data-tone={semDono > 0 ? "warning" : "muted"}>
          <dt>Sem dono</dt>
          <dd>{semDono}</dd>
          <span className="stat-foot">registados sem conta</span>
        </div>
      </dl>

      <div className="page-placeholder">
        <h2>
          <IconeUtilizadores style={{ width: 16, height: 16, verticalAlign: -3 }} /> Clientes (
          {listaClientes.length})
        </h2>

        {clientes.status === "loading" && (
          <div aria-hidden="true">
            <div className="esqueleto largo" />
            <div className="esqueleto largo" />
            <div className="esqueleto medio" />
          </div>
        )}

        {clientes.status === "error" && (
          <p role="status">Não foi possível carregar a lista de clientes.</p>
        )}

        {clientes.status === "ready" && listaClientes.length === 0 && (
          <p>
            Ainda não há clientes. Assim que alguém criar a conta na app, aparece
            aqui.
          </p>
        )}

        {clientes.status === "ready" && listaClientes.length > 0 && (
          <table className="tabela">
            <thead>
              <tr>
                <th>Email</th>
                <th>Plano</th>
                <th>Estado</th>
                <th>Dispositivos</th>
                <th>Registado em</th>
                <th>Último reporte</th>
              </tr>
            </thead>
            <tbody>
              {listaClientes.map((c) => (
                <tr key={c.id}>
                  <td>{c.email}</td>
                  <td className="mono">{c.plano}</td>
                  <td>
                    <span
                      className={`etiqueta ${
                        c.estado === "activo"
                          ? "etiqueta-online"
                          : "etiqueta-desconhecido"
                      }`}
                    >
                      {c.estado}
                    </span>
                  </td>
                  <td className="mono">{c.dispositivos}</td>
                  <td className="mono">
                    {c.registadoEm ? c.registadoEm.slice(0, 10) : "—"}
                  </td>
                  <td className="mono">
                    {c.ultimoReporte ? c.ultimoReporte.slice(0, 16).replace("T", " ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="page-placeholder">
        <h2>
          <IconeTelemovel style={{ width: 16, height: 16, verticalAlign: -3 }} /> Dispositivos
          da plataforma ({listaDispositivos.length})
        </h2>

        {dispositivos.status === "ready" && (
          <table className="tabela">
            <thead>
              <tr>
                <th>Dispositivo</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Bateria</th>
                <th>Último reporte</th>
              </tr>
            </thead>
            <tbody>
              {listaDispositivos.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.nome} <span className="linha-nota mono">{d.id}</span>
                  </td>
                  <td>{d.dono ?? "—"}</td>
                  <td>
                    <span
                      className={`etiqueta etiqueta-${
                        d.estado === "online"
                          ? "online"
                          : d.estado === "offline"
                            ? "offline"
                            : "desconhecido"
                      }`}
                    >
                      {d.estado}
                    </span>
                  </td>
                  <td className="mono">{d.bateria}%</td>
                  <td className="mono">
                    {d.ultimo_reporte
                      ? d.ultimo_reporte.slice(0, 16).replace("T", " ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grelha" style={{ marginTop: 18 }}>
        <div className="recurso">
          <div className="recurso-icone">
            <IconeAplicacoes />
          </div>
          <h3>Cada cliente vê só o seu</h3>
          <p>
            A API filtra os dados pelo dono: um cliente nunca vê os dispositivos
            de outro, nem a lista de clientes.
          </p>
        </div>
        <div className="recurso">
          <div className="recurso-icone">
            <IconeLocalizacao />
          </div>
          <h3>Auditoria em tudo</h3>
          <p>
            Block de apps, limites de ecrã e reconhecimentos de alerta ficam
            registados com o autor e a data.
          </p>
        </div>
      </div>
    </section>
  );
}

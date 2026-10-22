import { useApiCollection } from "../lib/useApiCollection.js";
import { sortByDateDesc } from "../lib/dates.js";
import {
  IconeAlerta,
  IconeAplicacoes,
  IconeLocalizacao,
  IconeRelogio,
  IconeTelemovel,
} from "../components/Icones.jsx";

/**
 * Dashboard do cliente.
 *
 * A API ja devolve apenas os dados do utilizador autenticado (o servidor
 * filtra pelo dono), por isso aqui so se mostra o que ele tem direito.
 */
export default function Client() {
  const dispositivos = useApiCollection("/api/devices", "devices", {
    intervaloMs: 30000,
  });
  const localizacoes = useApiCollection("/api/locations", "locations", {
    intervaloMs: 30000,
  });
  const apps = useApiCollection("/api/apps", "apps", { intervaloMs: 60000 });
  const uso = useApiCollection("/api/usage", "usage", { intervaloMs: 60000 });
  const alertas = useApiCollection("/api/alerts", "alerts", { intervaloMs: 30000 });
  const permissoes = useApiCollection("/api/permissions", "permissions", {
    intervaloMs: 30000,
  });

  const lista = dispositivos.items ?? [];
  const principal = lista[0] ?? null;
  const loc = (localizacoes.items ?? []).find((l) => l.deviceId === principal?.id);
  const consentimento = (permissoes.items ?? []).find(
    (p) => p.deviceId === principal?.id
  );

  const minutos = (uso.items ?? [])
    .filter((u) => u.deviceId === principal?.id)
    .reduce((total, u) => total + (Number(u.minutos) || 0), 0);
  const horas = Math.floor(minutos / 60);
  const restoMin = minutos % 60;

  const appsDoDispositivo = (apps.items ?? []).filter(
    (a) => a.deviceId === principal?.id
  );
  const maisUsado = [...appsDoDispositivo].sort((a, b) => b.minutos - a.minutos)[0];
  const alertasActivos = (alertas.items ?? []).filter((a) => !a.reconhecido);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>O meu telemóvel</h1>
          <p>Tudo o que está a acontecer nos teus dispositivos.</p>
        </div>
      </div>

      {dispositivos.status === "loading" && (
        <div className="page-placeholder" aria-hidden="true">
          <div className="esqueleto largo" />
          <div className="esqueleto medio" />
          <div className="esqueleto curto" />
        </div>
      )}

      {dispositivos.status === "error" && (
        <div className="page-placeholder" role="status">
          <p>Não foi possível carregar os teus dispositivos.</p>
        </div>
      )}

      {dispositivos.status === "ready" && !principal && (
        <div className="page-placeholder">
          <h2>
            <IconeTelemovel style={{ width: 16, height: 16, verticalAlign: -3 }} /> Ainda sem
            dispositivos
          </h2>
          <p>
            Instala a app SeeFast no telemóvel e liga-a com o teu email e senha.
            O teu aparelho aparece aqui automaticamente.
          </p>
        </div>
      )}

      {principal && (
        <>
          <dl className="stat-row stagger">
            <div className="stat" data-tone={principal.estado === "online" ? "cyan" : "muted"}>
              <dt>Estado</dt>
              <dd style={{ fontSize: 20 }}>{principal.estado}</dd>
              <span className="stat-foot">{principal.nome}</span>
            </div>
            <div className="stat" data-tone={principal.bateria < 20 ? "danger" : undefined}>
              <dt>Bateria</dt>
              <dd>{principal.bateria}%</dd>
              <span className="stat-foot">
                {principal.ultimo_reporte
                  ? `Reportou em ${principal.ultimo_reporte
                      .slice(0, 16)
                      .replace("T", " ")}`
                  : "Sem reporte ainda"}
              </span>
            </div>
            <div className="stat" data-tone="cyan">
              <dt>Tempo de uso</dt>
              <dd>
                {horas}
                <span style={{ fontSize: 16 }}>h</span> {restoMin}
                <span style={{ fontSize: 16 }}>min</span>
              </dd>
              <span className="stat-foot">nas últimas 24 horas</span>
            </div>
            <div className="stat" data-tone={alertasActivos.length ? "warning" : "muted"}>
              <dt>Alertas</dt>
              <dd>{alertasActivos.length}</dd>
              <span className="stat-foot">por reconhecer</span>
            </div>
          </dl>

          <div className="grelha" style={{ marginTop: 18 }} data-stagger>
            <div className="recurso">
              <div className="recurso-icone">
                <IconeLocalizacao />
              </div>
              <h3>Localização</h3>
              {loc ? (
                <p className="mono">
                  {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                  <br />
                  <span className="linha-nota">
                    Atualizada em {loc.atualizadoEm.slice(0, 16).replace("T", " ")}
                  </span>
                </p>
              ) : (
                <p>
                  Sem localização. Precisas de ligar a permissão e o consentimento
                  na app.
                </p>
              )}
            </div>

            <div className="recurso">
              <div className="recurso-icone">
                <IconeRelogio />
              </div>
              <h3>Aplicação mais usada</h3>
              {maisUsado ? (
                <p>
                  <strong>{maisUsado.nome}</strong>
                  <br />
                  <span className="linha-nota mono">
                    {maisUsado.minutos} min · {maisUsado.tamanhoMb} MB
                  </span>
                </p>
              ) : (
                <p>Sem dados de tempo de uso ainda.</p>
              )}
            </div>

            <div className="recurso">
              <div className="recurso-icone">
                <IconeAplicacoes />
              </div>
              <h3>Aplicações instaladas</h3>
              <p>
                {appsDoDispositivo.length} aplicações detectadas
                {appsDoDispositivo.some((a) => a.bloqueada) && (
                  <>
                    {" "}
                    ·{" "}
                    <strong>
                      {appsDoDispositivo.filter((a) => a.bloqueada).length} bloqueadas
                    </strong>
                  </>
                )}
              </p>
            </div>

            <div className="recurso">
              <div className="recurso-icone">
                <IconeAlerta />
              </div>
              <h3>Consentimento</h3>
              {consentimento ? (
                <p>
                  Estado:{" "}
                  <span
                    className={`etiqueta ${
                      consentimento.consentimento === "concedido"
                        ? "etiqueta-online"
                        : "etiqueta-desconhecido"
                    }`}
                  >
                    {consentimento.consentimento}
                  </span>
                  <br />
                  <span className="linha-nota">
                    Localização{" "}
                    {consentimento.localizacao ? "ligada" : "desligada"}
                  </span>
                </p>
              ) : (
                <p>Sem dados de consentimento ainda.</p>
              )}
            </div>
          </div>

          {alertasActivos.length > 0 && (
            <div className="page-placeholder">
              <h2>Alertas recentes</h2>
              <ul>
                {sortByDateDesc(alertasActivos)
                  .slice(0, 6)
                  .map((a) => (
                    <li key={a.id} className="linha">
                      <span className="linha-texto">
                        {a.mensagem}
                        <span className="linha-nota">
                          {" "}
                          · {a.em.slice(0, 16).replace("T", " ")}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

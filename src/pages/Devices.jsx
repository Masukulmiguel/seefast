import { useEffect, useState } from "react";

export default function Devices() {
  const [status, setStatus] = useState("loading");
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/devices");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setDevices(Array.isArray(data.devices) ? data.devices : []);
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
      <h1>Dispositivos</h1>
      <p>Gestão dos dispositivos registados no SeeFast.</p>

      {status === "loading" && (
        <div className="page-placeholder">
          <p>A carregar dispositivos…</p>
        </div>
      )}

      {status === "error" && (
        <div className="page-placeholder" role="status">
          <p>
            Não foi possível carregar os dispositivos. Confirme que o serviço
            está a correr (<code>npm run server</code>).
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="page-placeholder">
          <ul>
            {devices.map((d) => (
              <li key={d.id}>
                {d.nome} — {d.estado}, bateria {d.bateria}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

import { useState } from "react";
import DataCollectionPage from "../components/DataCollectionPage.jsx";
import { useSession } from "../lib/session.jsx";

export default function Devices() {
  const { user } = useSession();
  const podeRegistar = user?.role === "admin";
  const [nome, setNome] = useState("");
  const [registado, setRegistado] = useState(null);
  const [erro, setErro] = useState(null);

  async function registar(event) {
    event.preventDefault();
    setErro(null);
    setRegistado(null);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      if (!res.ok) throw new Error("falhou");
      const data = await res.json();
      setRegistado(data.device);
      setNome("");
    } catch {
      setErro("Não foi possível registar o dispositivo.");
    }
  }

  return (
    <>
      <DataCollectionPage
        titulo="Dispositivos"
        descricao="Gestão dos dispositivos registados no SeeFast."
        endpoint="/api/devices"
        chave="devices"
        intervaloMs={30000}
        textoACarregar="A carregar dispositivos…"
        textoVazio="Nenhum dispositivo registado."
        cabecalho={
          podeRegistar && (
            <form className="registo-dispositivo" onSubmit={registar}>
              <label htmlFor="registo-nome">Nome do dispositivo</label>
              <input
                id="registo-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Telemóvel do Miguel"
                required
              />
              <button type="submit">Registar dispositivo</button>
            </form>
          )
        }
        aoRenderizarItem={(d) => (
          <span className="linha">
            <span className="linha-texto">
              {d.nome} — {d.estado}, bateria {d.bateria}%
              {d.ultimo_reporte && (
                <span className="linha-nota"> (reportou em {d.ultimo_reporte})</span>
              )}
            </span>
          </span>
        )}
      />

      {registado && (
        <div className="page-placeholder" role="status">
          <h2>Dispositivo registado: {registado.nome}</h2>
          <p>
            ID: <code>{registado.id}</code>
          </p>
          <p>
            Token: <code>{registado.token}</code>
          </p>
          <p className="aviso">
            Este token só aparece uma vez — copia-o agora para a app do
            dispositivo. Depois, configura-o no ecrã de ligação da app.
          </p>
        </div>
      )}

      {erro && (
        <p className="login-erro" role="alert">
          {erro}
        </p>
      )}
    </>
  );
}

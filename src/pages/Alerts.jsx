import { useState } from "react";
import DataCollectionPage from "../components/DataCollectionPage.jsx";
import { sortByDateDesc } from "../lib/dates.js";
import { useSession } from "../lib/session.jsx";

export default function Alerts() {
  const { user } = useSession();
  const podeEditar = user?.role === "admin";
  const [erro, setErro] = useState(null);

  async function reconhecer(alerta, recarregar) {
    setErro(null);
    try {
      const res = await fetch(`/api/alerts/${alerta.id}/ack`, { method: "POST" });
      if (!res.ok) throw new Error("falhou");
      recarregar();
    } catch {
      setErro("Não foi possível reconhecer o alerta.");
    }
  }

  return (
    <>
      <DataCollectionPage
        titulo="Alertas"
        descricao="Alertas de segurança e de utilização dos dispositivos."
        endpoint="/api/alerts"
        chave="alerts"
        ordenar={sortByDateDesc}
        textoACarregar="A carregar alertas…"
        textoVazio="Sem alertas ativos."
        aoRenderizarItem={(alerta, { recarregar }) => (
          <span className="linha">
            <span className="linha-texto">
              {alerta.mensagem}
              {alerta.reconhecido && (
                <span className="linha-nota"> (reconhecido)</span>
              )}
            </span>
            {podeEditar && !alerta.reconhecido && (
              <button
                type="button"
                className="linha-acao"
                onClick={() => reconhecer(alerta, recarregar)}
              >
                Reconhecer
              </button>
            )}
          </span>
        )}
      />
      {erro && (
        <p className="login-erro" role="alert">
          {erro}
        </p>
      )}
    </>
  );
}

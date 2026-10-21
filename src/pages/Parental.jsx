import { useState } from "react";
import DataCollectionPage from "../components/DataCollectionPage.jsx";
import { useSession } from "../lib/session.jsx";

function Regra({ regra, onGuardar }) {
  const [limite, setLimite] = useState(regra.limiteMinutos);

  return (
    <span className="linha">
      <span className="linha-texto">
        {regra.nome} — {regra.inicio}–{regra.fim}, {regra.limiteMinutos} min/dia
      </span>
      <input
        type="number"
        min="0"
        step="5"
        className="linha-input"
        value={limite}
        onChange={(e) => setLimite(e.target.value)}
        aria-label={`Limite de ecrã (minutos) — ${regra.nome}`}
      />
      <button
        type="button"
        className="linha-acao"
        onClick={() => onGuardar(regra, Number(limite))}
      >
        Guardar
      </button>
    </span>
  );
}

export default function Parental() {
  const { user } = useSession();
  const podeEditar = user?.role === "admin";
  const [erro, setErro] = useState(null);

  async function guardar(regra, limiteMinutos, recarregar) {
    setErro(null);
    try {
      const res = await fetch(`/api/parental-rules/${regra.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limiteMinutos }),
      });
      if (!res.ok) throw new Error("falhou");
      recarregar();
    } catch {
      setErro("Não foi possível guardar a regra.");
    }
  }

  return (
    <>
      <DataCollectionPage
        titulo="Controlo Parental"
        descricao="Regras de utilização e tempo de ecrã por dispositivo."
        endpoint="/api/parental-rules"
        chave="rules"
        textoACarregar="A carregar regras…"
        textoVazio="Sem regras de controlo parental definidas."
        aoRenderizarItem={(regra, { recarregar }) =>
          podeEditar ? (
            <Regra
              regra={regra}
              onGuardar={(r, limite) => guardar(r, limite, recarregar)}
            />
          ) : (
            <span>
              {regra.nome} — {regra.inicio}–{regra.fim}, {regra.limiteMinutos}{" "}
              min/dia
            </span>
          )
        }
      />
      {erro && (
        <p className="login-erro" role="alert">
          {erro}
        </p>
      )}
    </>
  );
}

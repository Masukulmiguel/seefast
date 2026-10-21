import { useState } from "react";
import DataCollectionPage from "../components/DataCollectionPage.jsx";
import { useSession } from "../lib/session.jsx";

export default function AppsPage() {
  const { user } = useSession();
  const podeEditar = user?.role === "admin";
  const [erro, setErro] = useState(null);

  async function alternarBloqueio(app, recarregar) {
    setErro(null);
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloqueada: !app.bloqueada }),
      });
      if (!res.ok) throw new Error("falhou");
      recarregar();
    } catch {
      setErro("Não foi possível actualizar a aplicação.");
    }
  }

  return (
    <>
      <DataCollectionPage
        titulo="Aplicações"
        descricao="Aplicações instaladas e políticas de acesso."
        endpoint="/api/apps"
        chave="apps"
        textoACarregar="A carregar aplicações…"
        textoVazio="Sem aplicações registadas nos dispositivos."
        aoRenderizarItem={(app, { recarregar }) => (
          <span className="linha">
            <span className="linha-texto">
              {app.nome} — {app.pacote}, {app.tamanhoMb} MB (
              {app.bloqueada ? "bloqueada" : "permitida"})
            </span>
            {podeEditar && (
              <button
                type="button"
                className="linha-acao"
                onClick={() => alternarBloqueio(app, recarregar)}
              >
                {app.bloqueada ? "Desbloquear" : "Bloquear"}
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

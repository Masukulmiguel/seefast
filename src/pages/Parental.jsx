import DataCollectionPage from "../components/DataCollectionPage.jsx";

export default function Parental() {
  return (
    <DataCollectionPage
      titulo="Controlo Parental"
      descricao="Regras de utilização e tempo de ecrã por dispositivo."
      endpoint="/api/parental-rules"
      chave="rules"
      textoACarregar="A carregar regras…"
      textoVazio="Sem regras de controlo parental definidas."
      aoRenderizarItem={(r) =>
        `${r.nome} — ${r.limiteMinutos} min/dia, ${r.inicio}–${r.fim}`
      }
    />
  );
}

import DataCollectionPage from "../components/DataCollectionPage.jsx";
import { sortByDateDesc } from "../lib/dates.js";

export default function Alerts() {
  return (
    <DataCollectionPage
      titulo="Alertas"
      descricao="Alertas de segurança e de utilização dos dispositivos."
      endpoint="/api/alerts"
      chave="alerts"
      ordenar={sortByDateDesc}
      textoACarregar="A carregar alertas…"
      textoVazio="Sem alertas ativos."
      aoRenderizarItem={(a) => a.mensagem}
    />
  );
}

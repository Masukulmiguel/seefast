import DataCollectionPage from "../components/DataCollectionPage.jsx";
import { sortByDateDesc } from "../lib/dates.js";

export default function Audit() {
  return (
    <DataCollectionPage
      titulo="Auditoria"
      descricao="Registo de ações administradas no painel SeeFast."
      endpoint="/api/audit"
      chave="entries"
      ordenar={sortByDateDesc}
      textoACarregar="A carregar registos de auditoria…"
      textoVazio="Sem ações registadas."
      aoRenderizarItem={(e) => `${e.ator} — ${e.acao} (${e.alvo}) em ${e.em}`}
    />
  );
}

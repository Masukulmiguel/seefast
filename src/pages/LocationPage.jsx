import DataCollectionPage from "../components/DataCollectionPage.jsx";

export default function LocationPage() {
  return (
    <DataCollectionPage
      titulo="Localização"
      descricao="Consultar a localização dos dispositivos com consentimento ativo."
      endpoint="/api/locations"
      chave="locations"
      intervaloMs={30000}
      textoACarregar="A carregar localizações…"
      textoVazio="Sem localizações disponíveis — é necessário consentimento ativo."
      aoRenderizarItem={(l) =>
        `${l.nome} — ${l.lat}, ${l.lon} (atualizado em ${l.atualizadoEm})`
      }
    />
  );
}

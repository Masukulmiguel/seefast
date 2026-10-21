import DataCollectionPage from "../components/DataCollectionPage.jsx";

export default function Devices() {
  return (
    <DataCollectionPage
      titulo="Dispositivos"
      descricao="Gestão dos dispositivos registados no SeeFast."
      endpoint="/api/devices"
      chave="devices"
      textoACarregar="A carregar dispositivos…"
      textoVazio="Nenhum dispositivo registado."
      aoRenderizarItem={(d) => `${d.nome} — ${d.estado}, bateria ${d.bateria}%`}
    />
  );
}

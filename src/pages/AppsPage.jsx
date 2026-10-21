import DataCollectionPage from "../components/DataCollectionPage.jsx";

export default function AppsPage() {
  return (
    <DataCollectionPage
      titulo="Aplicações"
      descricao="Aplicações instaladas e políticas de acesso."
      endpoint="/api/apps"
      chave="apps"
      textoACarregar="A carregar aplicações…"
      textoVazio="Sem aplicações registadas nos dispositivos."
      aoRenderizarItem={(a) =>
        `${a.nome} — ${a.pacote}, ${a.tamanhoMb} MB (${
          a.bloqueada ? "bloqueada" : "permitida"
        })`
      }
    />
  );
}

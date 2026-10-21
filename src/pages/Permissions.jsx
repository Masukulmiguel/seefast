import DataCollectionPage from "../components/DataCollectionPage.jsx";

export default function Permissions() {
  return (
    <DataCollectionPage
      titulo="Permissões"
      descricao="Consentimentos e permissões concedidas pelos utilizadores."
      endpoint="/api/permissions"
      chave="permissions"
      textoACarregar="A carregar permissões…"
      textoVazio="Sem registos de consentimento."
      aoRenderizarItem={(p) => {
        const consentimento =
          p.consentimento === "concedido" ? "concedido" : "pendente";
        return `${p.nome} — consentimento ${consentimento}, câmara ${
          p.camera ? "permitida" : "negada"
        }, microfone ${p.microfone ? "permitido" : "negado"}, localização ${
          p.localizacao ? "permitida" : "negada"
        }`;
      }}
    />
  );
}

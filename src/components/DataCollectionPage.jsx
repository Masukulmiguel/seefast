import { useApiCollection } from "../lib/useApiCollection.js";

// Página que lista uma coleção vinda da API, com estados de carregamento/erro.
export default function DataCollectionPage({
  titulo,
  descricao,
  endpoint,
  chave,
  aoRenderizarItem,
  ordenar,
  textoVazio = "Não há dados para mostrar.",
  textoACarregar = "A carregar…",
}) {
  const { status, items } = useApiCollection(endpoint, chave);
  const lista = ordenar ? ordenar(items) : items;

  return (
    <section>
      <h1>{titulo}</h1>
      <p>{descricao}</p>

      {status === "loading" && (
        <div className="page-placeholder">
          <p>{textoACarregar}</p>
        </div>
      )}

      {status === "error" && (
        <div className="page-placeholder" role="status">
          <p>
            Não foi possível carregar os dados. Confirme que o serviço está a
            correr (<code>npm run server</code>).
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="page-placeholder">
          {lista.length === 0 ? (
            <p>{textoVazio}</p>
          ) : (
            <ul>
              {lista.map((item, index) => (
                <li key={item.id ?? item.deviceId ?? index}>
                  {aoRenderizarItem(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

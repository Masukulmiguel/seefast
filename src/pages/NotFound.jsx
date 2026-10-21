import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section>
      <h1>Página não encontrada</h1>
      <p>O endereço que pediu não existe neste painel.</p>
      <div className="page-placeholder">
        <p>
          <Link to="/">Voltar ao Dashboard</Link>
        </p>
      </div>
    </section>
  );
}

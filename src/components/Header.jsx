import { useLocation } from "react-router-dom";
import "./Header.css";

const pageTitles = {
  "/": "Dashboard",
  "/dispositivos": "Dispositivos",
  "/localizacao": "Localização",
  "/controlo-parental": "Controlo Parental",
  "/aplicacoes": "Aplicações",
  "/alertas": "Alertas",
  "/permissoes": "Permissões",
  "/auditoria": "Auditoria",
};

export default function Header({ onMenu }) {
  const { pathname } = useLocation();
  const page = pageTitles[pathname] ?? "Página não encontrada";

  return (
    <header className="header">
      <button
        type="button"
        className="header-menu"
        onClick={onMenu}
        aria-label="Abrir menu"
      >
        ☰
      </button>
      <span className="header-title">
        SeeFast — Painel de Supervisão
        <span className="header-page">{page}</span>
      </span>
    </header>
  );
}

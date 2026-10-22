import { useLocation } from "react-router-dom";
import { IconeMenu } from "./Icones.jsx";
import "./Header.css";

const pageTitles = {
  "/": "Dashboard",
  "/admin": "Administração",
  "/cliente": "O meu telemóvel",
  "/dispositivos": "Dispositivos",
  "/localizacao": "Localização",
  "/controlo-parental": "Controlo parental",
  "/aplicacoes": "Aplicações",
  "/alertas": "Alertas",
  "/permissoes": "Permissões",
  "/auditoria": "Auditoria",
  "/entrar": "Entrar",
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
        <IconeMenu style={{ width: 19, height: 19 }} />
      </button>
      <span className="header-title">
        SeeFast
        <span className="header-page">{page}</span>
      </span>
    </header>
  );
}

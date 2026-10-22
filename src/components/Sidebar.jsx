import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import {
  IconeAplicacoes,
  IconeAuditoria,
  IconeCadeado,
  IconeEscudo,
  IconeLocalizacao,
  IconePainel,
  IconeRegra,
  IconeSair,
  IconeTelemovel,
  IconeUtilizadores,
} from "./Icones.jsx";
import "./Sidebar.css";

/**
 * Navegacao lateral.
 *
 * O menu muda conforme o papel: o admin ve a administracao de clientes, o
 * cliente ve o seu painel e os dados do proprio telescrilho.
 */
const LINKS_ADMIN = [
  { grupo: "Visão geral" },
  { to: "/admin", label: "Administração", icone: <IconeUtilizadores />, fim: true },
  { to: "/", label: "Dashboard", icone: <IconePainel />, fim: true },
  { grupo: "Dispositivos" },
  { to: "/dispositivos", label: "Dispositivos", icone: <IconeTelemovel /> },
  { to: "/localizacao", label: "Localização", icone: <IconeLocalizacao /> },
  { to: "/aplicacoes", label: "Aplicações", icone: <IconeAplicacoes /> },
  { grupo: "Controlo" },
  { to: "/controlo-parental", label: "Controlo Parental", icone: <IconeRegra /> },
  { to: "/alertas", label: "Alertas", icone: <IconeCadeado /> },
  { to: "/permissoes", label: "Permissões", icone: <IconeCadeado /> },
  { to: "/auditoria", label: "Auditoria", icone: <IconeAuditoria /> },
];

const LINKS_CLIENTE = [
  { grupo: "O meu telemóvel" },
  { to: "/cliente", label: "O meu telemóvel", icone: <IconeTelemovel />, fim: true },
  { to: "/localizacao", label: "Localização", icone: <IconeLocalizacao /> },
  { to: "/aplicacoes", label: "Aplicações", icone: <IconeAplicacoes /> },
  { to: "/alertas", label: "Alertas", icone: <IconeCadeado /> },
  { to: "/permissoes", label: "Permissões", icone: <IconeCadeado /> },
];

const DESKTOP_QUERY = "(min-width: 901px)";

function queryDesktop() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export default function Sidebar({ open, onClose }) {
  const asideRef = useRef(null);
  const { user, sair } = useSession();
  const [isDesktop, setIsDesktop] = useState(queryDesktop);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(mq.matches);
    const onChange = (event) => setIsDesktop(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // A sidebar esta visivel quando: desktop (sempre) ou mobile com o menu aberto.
  const visible = isDesktop || open;

  useEffect(() => {
    // `inert` remove a arvore de acessibilidade E o foco; `aria-hidden` cobre
    // browsers sem suporte a `inert`.
    if (asideRef.current) {
      asideRef.current.inert = !visible;
    }
  }, [visible]);

  const links = user?.role === "admin" ? LINKS_ADMIN : LINKS_CLIENTE;
  const papel = user?.role === "admin" ? "Administrador" : "Cliente";

  return (
    <aside
      ref={asideRef}
      className={`sidebar${open ? " open" : ""}`}
      aria-hidden={!visible}
    >
      <div className="sidebar-brand">
        <IconeEscudo />
        SeeFast
      </div>
      <nav className="sidebar-nav" aria-label="Navegação do painel">
        {links.map((l, i) =>
          l.grupo ? (
            <span className="sidebar-grupo" key={`grupo-${l.grupo}`}>
              {l.grupo}
            </span>
          ) : (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.fim}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
              onClick={onClose}
            >
              {l.icone}
              {l.label}
            </NavLink>
          )
        )}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-utilizador">
          <span className="sidebar-user">{user?.email}</span>
          <span className="sidebar-papel">{papel}</span>
        </span>
        <button
          type="button"
          className="sidebar-logout"
          onClick={sair}
          aria-label="Sair"
          title="Sair"
        >
          <IconeSair style={{ width: 15, height: 15 }} />
        </button>
      </div>
    </aside>
  );
}

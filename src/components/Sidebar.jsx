import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/dispositivos", label: "Dispositivos" },
  { to: "/localizacao", label: "Localização" },
  { to: "/controlo-parental", label: "Controlo Parental" },
  { to: "/aplicacoes", label: "Aplicações" },
  { to: "/alertas", label: "Alertas" },
  { to: "/permissoes", label: "Permissões" },
  { to: "/auditoria", label: "Auditoria" },
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

  // A sidebar está visível quando: desktop (sempre) ou mobile com o menu aberto.
  const visible = isDesktop || open;

  useEffect(() => {
    // `inert` remove a árvore de acessibilidade E o foco; `aria-hidden` cobre
    // browsers sem suporte a `inert`.
    if (asideRef.current) {
      asideRef.current.inert = !visible;
    }
  }, [visible]);

  return (
    <aside
      ref={asideRef}
      className={`sidebar${open ? " open" : ""}`}
      aria-hidden={!visible}
    >
      <div className="sidebar-brand">SeeFast</div>
      <nav className="sidebar-nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
            onClick={onClose}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { SessionProvider, useSession } from "./lib/session.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Login from "./pages/Login.jsx";
import Landing from "./pages/Landing.jsx";
import Admin from "./pages/Admin.jsx";
import Client from "./pages/Client.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Devices from "./pages/Devices.jsx";
import LocationPage from "./pages/LocationPage.jsx";
import Parental from "./pages/Parental.jsx";
import AppsPage from "./pages/AppsPage.jsx";
import Alerts from "./pages/Alerts.jsx";
import Permissions from "./pages/Permissions.jsx";
import Audit from "./pages/Audit.jsx";
import NotFound from "./pages/NotFound.jsx";

/**
 * Redireciona para outra rota.
 *
 * O <Navigate> do react-router v7 exige um "data router"; com <BrowserRouter>
 * lancaria. Este equivalente usa apenas useNavigate, que funciona nos dois.
 */
function Redirecionar({ para }) {
  const navegar = useNavigate();
  useEffect(() => {
    navegar(para, { replace: true });
  }, [para, navegar]);
  return null;
}

function Painel() {
  const { estado, user } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  if (estado === "a-carregar") {
    return (
      <div className="app-shell">
        <div className="app-main">
          <main className="app-content">
            <div className="page-placeholder" aria-hidden="true">
              <div className="esqueleto largo" />
              <div className="esqueleto medio" />
              <div className="esqueleto curto" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Sem sessao: o site publico (com a entrada no topo).
  if (estado === "anonimo") {
    return (
      <Routes>
        <Route path="/entrar" element={<Login />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    );
  }

  // O cliente comeca no seu proprio painel; o admin no dashboard.
  const ehAdmin = user?.role === "admin";
  const casa = ehAdmin ? "/" : "/cliente";

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="app-main">
        <Header onMenu={() => setSidebarOpen((o) => !o)} />
        <main className="app-content">
          <Routes>
            <Route path="/" element={ehAdmin ? <Dashboard /> : <Client />} />
            <Route
              path="/admin"
              element={ehAdmin ? <Admin /> : <Redirecionar para={casa} />}
            />
            <Route path="/cliente" element={<Client />} />
            <Route path="/dispositivos" element={<Devices />} />
            <Route path="/localizacao" element={<LocationPage />} />
            <Route path="/controlo-parental" element={<Parental />} />
            <Route path="/aplicacoes" element={<AppsPage />} />
            <Route path="/alertas" element={<Alerts />} />
            <Route path="/permissoes" element={<Permissions />} />
            <Route path="/auditoria" element={<Audit />} />
            <Route path="/entrar" element={<Redirecionar para={casa} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <footer className="app-footer">
          SeeFast — a recolha só acontece com consentimento explícito do dono do
          telemóvel.
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Painel />
      </SessionProvider>
    </BrowserRouter>
  );
}

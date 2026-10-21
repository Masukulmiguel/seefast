import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Devices from './pages/Devices.jsx'
import LocationPage from './pages/LocationPage.jsx'
import Parental from './pages/Parental.jsx'
import AppsPage from './pages/AppsPage.jsx'
import Alerts from './pages/Alerts.jsx'
import Permissions from './pages/Permissions.jsx'
import Audit from './pages/Audit.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}
        <div className="app-main">
          <Header onMenu={() => setSidebarOpen((o) => !o)} />
          <main className="app-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dispositivos" element={<Devices />} />
              <Route path="/localizacao" element={<LocationPage />} />
              <Route path="/controlo-parental" element={<Parental />} />
              <Route path="/aplicacoes" element={<AppsPage />} />
              <Route path="/alertas" element={<Alerts />} />
              <Route path="/permissoes" element={<Permissions />} />
              <Route path="/auditoria" element={<Audit />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="app-footer">
            SeeFast MVP — funcionalidades operacionais dependem da app SeeFast
            Android e do consentimento explícito do utilizador.
          </footer>
        </div>
      </div>
    </BrowserRouter>
  )
}

import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Escenarios from './pages/Escenarios.jsx';
import Sensibilidad from './pages/Sensibilidad.jsx';
import MonteCarlo from './pages/MonteCarlo.jsx';
import Historial from './pages/Historial.jsx';

const NAV = [
  { path: '/',            label: 'Dashboard',    icon: 'ti-layout-dashboard', section: 'Principal' },
  { path: '/escenarios',  label: 'Escenarios',   icon: 'ti-chart-bar',        section: 'Principal', badge: '5' },
  { path: '/sensibilidad',label: 'Sensibilidad', icon: 'ti-adjustments',      section: 'Análisis' },
  { path: '/montecarlo',  label: 'Monte Carlo',  icon: 'ti-dice',             section: 'Análisis' },
  { path: '/historial',   label: 'Historial',    icon: 'ti-history',          section: 'Sistema' },
];

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  let lastSection = '';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo-area">
          <div className="logo-mark">
            <div className="logo-icon"><i className="ti ti-cpu" /></div>
            <div>
              <div className="logo-text">InduTech</div>
              <div className="logo-sub">Optimizer · v1.0</div>
            </div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(item => {
            const showLabel = item.section !== lastSection;
            if (showLabel) lastSection = item.section;
            return (
              <div key={item.path}>
                {showLabel && <div className="nav-label">{item.section}</div>}
                <button
                  className={`nav-item${pathname === item.path ? ' active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <i className={`ti ${item.icon}`} />
                  {item.label}
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-row">
            <div className="avatar">GM</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Gerencia IT</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Service Manager</div>
            </div>
            <i className="ti ti-chevron-down" style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }} />
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="topbar-title">Planificación de capacidad IT</div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>1er trimestre · InduTech S.A.</span>
          <div className="status-pill">
            <div className="status-dot" />
            Modelo activo
          </div>
        </div>

        <div className="content">
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/escenarios"   element={<Escenarios />} />
            <Route path="/sensibilidad" element={<Sensibilidad />} />
            <Route path="/montecarlo"   element={<MonteCarlo />} />
            <Route path="/historial"    element={<Historial />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

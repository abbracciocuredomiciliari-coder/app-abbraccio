import { Link, useLocation, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Patients from './pages/Patients';
import Staff from './pages/Staff';
import WorkPlan from './pages/WorkPlan';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Documentazione from './pages/Documentazione';
import Protocolli from './pages/Protocolli';
import Procedure from './pages/Procedure';
import Strumenti from './pages/Strumenti';
import WorkPlanAccessPage from './pages/WorkPlanAccessPage';
import StoricoCliniche from './pages/StoricoCliniche';
import ArchivioCartelle from './pages/ArchivioCartelle';
import CheckList from './pages/CheckList';
import SchedaControlloDefibrillatore from './pages/SchedaControlloDefibrillatore';
import CheckListGlucometro from './pages/CheckListGlucometro';
import CheckListHub from './pages/CheckListHub';
import GestioneUtenti from './pages/GestioneUtenti';
import PortaleOperatore from './pages/PortaleOperatore';
import ProfiloPersonale from './pages/ProfiloPersonale';
import CompensoIncarichi from './pages/CompensoIncarichi';
import EsamiStrumentali from './pages/EsamiStrumentali';
import RichiestePresidiPage from './pages/RichiestePresidiPage';
import {
  Heart,
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  FileText,
  Calendar,
  Stethoscope,
  LogOut,
  User,
  BookOpen,
  Archive,
  CheckSquare,
  ShieldCheck,
  Briefcase,
  UserCircle,
  Euro,
  HeartPulse,
} from 'lucide-react';

// Ruoli con accesso completo (admin/coordinamento/direzione)
const RUOLI_PRIVILEGIATI = ['admin', 'coordinator', 'direttore'];
// Ruoli operativi (vedono solo il portale operatore)
const RUOLI_OPERATORI = ['caregiver', 'infermiere', 'oss', 'fisioterapista', 'medico'];

function isPrivilegiato(role: string) {
  return RUOLI_PRIVILEGIATI.includes(role);
}

function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const operatore = user && !isPrivilegiato(user.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ padding: '16px 12px 8px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: '8px' }}>
          <img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ width: '100%', maxWidth: '160px', height: 'auto', display: 'block', margin: '0 auto' }} />
        </div>
        <nav>
          {/* Link non autenticati */}
          {!user && (
            <Link to="/" className={isActive('/') ? 'active' : ''}>
              <LayoutDashboard size={18} />
              Login
            </Link>
          )}
          {!user && (
            <Link to="/register" className={isActive('/register') ? 'active' : ''}>
              <UserPlus size={18} />
              Registrati
            </Link>
          )}

          {/* ===== MENU OPERATORI (infermieristico, oss, riabilitativo, medico) ===== */}
          {user && operatore && (
            <>
              <Link to="/portale-operatore" className={isActive('/portale-operatore') ? 'active' : ''}>
                <LayoutDashboard size={18} />
                Dashboard
              </Link>
              <Link to="/protocolli" className={isActive('/protocolli') ? 'active' : ''}>
                <ClipboardList size={18} />
                Protocolli
              </Link>
              <Link to="/procedure" className={isActive('/procedure') ? 'active' : ''}>
                <FileText size={18} />
                Procedure
              </Link>
              <Link to="/esami-strumentali" className={isActive('/esami-strumentali') ? 'active' : ''}>
                <HeartPulse size={18} />
                Esami Strumentali
              </Link>
              <Link to="/richieste-presidi" className={isActive('/richieste-presidi') ? 'active' : ''}>
                <Briefcase size={18} />
                Richiesta Presidi/Farmaci
              </Link>
              <Link to="/profilo-personale" className={isActive('/profilo-personale') ? 'active' : ''}>
                <UserCircle size={18} />
                Il mio profilo
              </Link>
            </>
          )}

          {/* ===== MENU PRIVILEGIATI (admin, coordinator, direttore) ===== */}
          {user && isPrivilegiato(user.role) && (
            <>
              {(user.role === 'admin' || user.role === 'coordinator') && (
                <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
                  <LayoutDashboard size={18} />
                  Dashboard
                </Link>
              )}
              <Link to="/patients" className={isActive('/patients') ? 'active' : ''}>
                <Users size={18} />
                Pazienti
              </Link>
              <Link to="/staff" className={isActive('/staff') ? 'active' : ''}>
                <UserPlus size={18} />
                Personale
              </Link>
              <Link to="/protocolli" className={isActive('/protocolli') ? 'active' : ''}>
                <ClipboardList size={18} />
                Protocolli sanitari
              </Link>
              <Link to="/procedure" className={isActive('/procedure') ? 'active' : ''}>
                <FileText size={18} />
                Procedure sanitarie
              </Link>
              <Link to="/workplan" className={isActive('/workplan') ? 'active' : ''}>
                <Calendar size={18} />
                Piano di lavoro
              </Link>
              <Link to="/strumenti" className={isActive('/strumenti') ? 'active' : ''}>
                <Stethoscope size={18} />
                Strumenti e presidi
              </Link>
              <Link to="/storico-cliniche" className={isActive('/storico-cliniche') ? 'active' : ''}>
                <BookOpen size={18} />
                Storico cartelle cliniche
              </Link>
              <Link to="/archivio-cartelle" className={isActive('/archivio-cartelle') ? 'active' : ''}>
                <Archive size={18} />
                Archivio cartelle
              </Link>
              <Link
                to="/checklist-hub"
                className={location.pathname.startsWith('/checklist') || location.pathname.startsWith('/scheda-controllo') ? 'active' : ''}
              >
                <CheckSquare size={18} />
                Check List
              </Link>
              <Link to="/esami-strumentali" className={isActive('/esami-strumentali') ? 'active' : ''}>
                <HeartPulse size={18} />
                Esami Strumentali
              </Link>
              <Link to="/compenso-incarichi" className={isActive('/compenso-incarichi') ? 'active' : ''}>
                <Euro size={18} />
                Compenso per incarichi
              </Link>
              {user.role === 'admin' && (
                <Link to="/gestione-utenti" className={isActive('/gestione-utenti') ? 'active' : ''}>
                  <ShieldCheck size={18} />
                  Gestione Utenti
                </Link>
              )}
            </>
          )}
        </nav>
        {user && (
          <div className="user-area">
            <p>
              <User size={16} />
              {user.name}
            </p>
            <button type="button" onClick={logout} className="logout-button">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </aside>
      <main className="content">
        {/* ── Tasto "Torna al menu principale" ── */}
        {user && (() => {
          const homePath = operatore ? '/portale-operatore' : '/dashboard';
          const noBackPaths = ['/', '/register', homePath];
          if (noBackPaths.includes(location.pathname)) return null;
          return (
            <div style={{ padding: '10px 16px 0', marginBottom: '-4px' }}>
              <Link
                to={homePath}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0',
                  borderRadius: '6px', padding: '7px 14px', fontSize: '0.88rem',
                  fontWeight: '600', textDecoration: 'none', cursor: 'pointer',
                }}
              >
                ← Menu principale
              </Link>
            </div>
          );
        })()}
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Route privilegiati */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
          <Route path="/workplan" element={<ProtectedRoute><WorkPlan /></ProtectedRoute>} />
          <Route path="/accesso/:workPlanId" element={<ProtectedRoute><WorkPlanAccessPage /></ProtectedRoute>} />
          <Route path="/workplan-access/:workPlanId" element={<ProtectedRoute><WorkPlanAccessPage /></ProtectedRoute>} />
          <Route path="/strumenti" element={<ProtectedRoute><Strumenti /></ProtectedRoute>} />
          <Route path="/storico-cliniche" element={<ProtectedRoute><StoricoCliniche /></ProtectedRoute>} />
          <Route path="/archivio-cartelle" element={<ProtectedRoute><ArchivioCartelle /></ProtectedRoute>} />
          {/* Hub Check List (unico punto di accesso dalla sidebar) */}
          <Route path="/checklist-hub" element={<ProtectedRoute><CheckListHub /></ProtectedRoute>} />
          {/* Redirect vecchie URL → hub (compatibilità link esistenti) */}
          <Route path="/checklist" element={<Navigate to="/checklist-hub" replace />} />
          <Route path="/scheda-controllo-defibrillatore" element={<Navigate to="/checklist-hub" replace />} />
          <Route path="/checklist-glucometro" element={<Navigate to="/checklist-hub" replace />} />
          <Route path="/gestione-utenti" element={<ProtectedRoute><GestioneUtenti /></ProtectedRoute>} />

          {/* Route condivise (tutti gli utenti autenticati) */}
          <Route path="/protocolli" element={<ProtectedRoute><Protocolli /></ProtectedRoute>} />
          <Route path="/procedure" element={<ProtectedRoute><Procedure /></ProtectedRoute>} />

          {/* Esami Strumentali */}
          <Route path="/esami-strumentali" element={<ProtectedRoute><EsamiStrumentali /></ProtectedRoute>} />

          {/* Richieste Presidi/Farmaci */}
          <Route path="/richieste-presidi" element={<ProtectedRoute><RichiestePresidiPage /></ProtectedRoute>} />
          {/* Gestione richieste ora integrata come scheda dentro /strumenti */}
          <Route path="/gestione-richieste-presidi" element={<Navigate to="/strumenti" replace />} />

          {/* Route operatori */}
          <Route path="/portale-operatore" element={<ProtectedRoute><PortaleOperatore /></ProtectedRoute>} />
          <Route path="/profilo-personale" element={<ProtectedRoute><ProfiloPersonale /></ProtectedRoute>} />
          <Route path="/compenso-incarichi" element={<ProtectedRoute><CompensoIncarichi /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

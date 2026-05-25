import { Link, useLocation, Route, Routes } from 'react-router-dom';
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
import GestioneUtenti from './pages/GestioneUtenti';
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
} from 'lucide-react';

function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ padding: '16px 12px 8px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: '8px' }}>
          <img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ width: '100%', maxWidth: '160px', height: 'auto', display: 'block', margin: '0 auto' }} />
        </div>
        <nav>
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
          {user && (user.role === 'admin' || user.role === 'coordinator') && (
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
          )}
          {user && (
            <Link to="/patients" className={isActive('/patients') ? 'active' : ''}>
              <Users size={18} />
              Pazienti
            </Link>
          )}
          {user && (
            <Link to="/staff" className={isActive('/staff') ? 'active' : ''}>
              <UserPlus size={18} />
              Personale
            </Link>
          )}
          {user && (
            <Link to="/protocolli" className={isActive('/protocolli') ? 'active' : ''}>
              <ClipboardList size={18} />
              Protocolli sanitari
            </Link>
          )}
          {user && (
            <Link to="/procedure" className={isActive('/procedure') ? 'active' : ''}>
              <FileText size={18} />
              Procedure sanitarie
            </Link>
          )}
          {user && (
            <Link to="/workplan" className={isActive('/workplan') ? 'active' : ''}>
              <Calendar size={18} />
              Piano di lavoro
            </Link>
          )}
          {user && (
            <Link to="/strumenti" className={isActive('/strumenti') ? 'active' : ''}>
              <Stethoscope size={18} />
              Strumenti e presidi
            </Link>
          )}
          {user && (user.role === 'admin' || user.role === 'coordinator' || user.role === 'direttore') && (
            <Link to="/storico-cliniche" className={isActive('/storico-cliniche') ? 'active' : ''}>
              <BookOpen size={18} />
              Storico cartelle cliniche
            </Link>
          )}
          {user && (user.role === 'admin' || user.role === 'coordinator' || user.role === 'direttore') && (
            <Link to="/archivio-cartelle" className={isActive('/archivio-cartelle') ? 'active' : ''}>
              <Archive size={18} />
              Archivio cartelle
            </Link>
          )}
          {user && (
            <Link to="/checklist" className={isActive('/checklist') ? 'active' : ''}>
              <CheckSquare size={18} />
              Check List
            </Link>
          )}
          {user && user.role === 'admin' && (
            <Link to="/gestione-utenti" className={isActive('/gestione-utenti') ? 'active' : ''}>
              <ShieldCheck size={18} />
              Gestione Utenti
            </Link>
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
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
          <Route path="/protocolli" element={<ProtectedRoute><Protocolli /></ProtectedRoute>} />
          <Route path="/procedure" element={<ProtectedRoute><Procedure /></ProtectedRoute>} />
          <Route path="/workplan" element={<ProtectedRoute><WorkPlan /></ProtectedRoute>} />
          <Route path="/accesso/:workPlanId" element={<ProtectedRoute><WorkPlanAccessPage /></ProtectedRoute>} />
          <Route path="/workplan-access/:workPlanId" element={<ProtectedRoute><WorkPlanAccessPage /></ProtectedRoute>} />
          <Route path="/strumenti" element={<ProtectedRoute><Strumenti /></ProtectedRoute>} />
          <Route path="/storico-cliniche" element={<ProtectedRoute><StoricoCliniche /></ProtectedRoute>} />
          <Route path="/archivio-cartelle" element={<ProtectedRoute><ArchivioCartelle /></ProtectedRoute>} />
          <Route path="/checklist" element={<ProtectedRoute><CheckList /></ProtectedRoute>} />
          <Route path="/gestione-utenti" element={<ProtectedRoute><GestioneUtenti /></ProtectedRoute>} />
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
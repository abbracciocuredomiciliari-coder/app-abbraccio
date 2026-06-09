import { useState, useEffect, Suspense, lazy } from 'react';
import { ToastContainer } from './components/ToastContainer';
import { useToast } from './hooks/useToast';
import { Link, useLocation, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ModalitaProvider, useModalita } from './context/ModalitaContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import Breadcrumb from './components/Breadcrumb';

// Eager load per pagine leggere (login, dashboard)
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Lazy load per pagine pesanti
const Patients = lazy(() => import('./pages/Patients'));
const Staff = lazy(() => import('./pages/Staff'));
const WorkPlan = lazy(() => import('./pages/WorkPlan'));
const Documentazione = lazy(() => import('./pages/Documentazione'));
const Protocolli = lazy(() => import('./pages/Protocolli'));
const Procedure = lazy(() => import('./pages/Procedure'));
const Strumenti = lazy(() => import('./pages/Strumenti'));
const WorkPlanAccessPage = lazy(() => import('./pages/WorkPlanAccessPage'));
const StoricoCliniche = lazy(() => import('./pages/StoricoCliniche'));
const ArchivioCartelle = lazy(() => import('./pages/ArchivioCartelle'));
const CheckList = lazy(() => import('./pages/CheckList'));
const SchedaControlloDefibrillatore = lazy(() => import('./pages/SchedaControlloDefibrillatore'));
const CheckListGlucometro = lazy(() => import('./pages/CheckListGlucometro'));
const CheckListHub = lazy(() => import('./pages/CheckListHub'));
const GestioneUtenti = lazy(() => import('./pages/GestioneUtenti'));
const PortaleOperatore = lazy(() => import('./pages/PortaleOperatore'));
const ProfiloPersonale = lazy(() => import('./pages/ProfiloPersonale'));
const CompensoIncarichi = lazy(() => import('./pages/CompensoIncarichi'));
const EsamiStrumentali = lazy(() => import('./pages/EsamiStrumentali'));
const RichiestePresidiPage = lazy(() => import('./pages/RichiestePresidiPage'));
const ProtocolliProcedure = lazy(() => import('./pages/ProtocolliProcedure'));
const ReportConsegne = lazy(() => import('./pages/ReportConsegne'));
const GestioneFatturazione = lazy(() => import('./pages/GestioneFatturazione'));
const GestioneConsensiGDPR = lazy(() => import('./pages/GestioneConsensiGDPR'));
const EsportazioneSIAT = lazy(() => import('./pages/EsportazioneSIAT'));
const RegistrazioneAccesso = lazy(() => import('./pages/RegistrazioneAccesso'));
const PazientiConvenzione = lazy(() => import('./pages/PazientiConvenzione'));
const PianificazionePrelievi = lazy(() => import('./pages/PianificazionePrelievi'));
const CentroPrelievi = lazy(() => import('./pages/CentroPrelievi'));
const AssegnazionePAI = lazy(() => import('./pages/AssegnazionePAI'));
const CentroPrenotazioniPrivato = lazy(() => import('./pages/CentroPrenotazioniPrivato'));
const CentroPrenotazioni = lazy(() => import('./pages/CentroPrenotazioni'));
const CentroPrenotazioniConvenzione = lazy(() => import('./pages/CentroPrenotazioniConvenzione'));
const GestioneRichieste = lazy(() => import('./pages/GestioneRichieste'));
const PortalePaziente = lazy(() => import('./pages/PortalePaziente'));
const RichiestaServizio = lazy(() => import('./pages/RichiestaServizio'));
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
  Shield,
  Briefcase,
  UserCircle,
  Euro,
  Receipt,
  HeartPulse,
  Menu,
  X,
  Package,
  Building2,
  ArrowLeftRight,
  Syringe,
  Map,
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
  const { modalita, setModalita, isConvenzione, modalitaAbilitata, canSwitch } = useModalita();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { toasts, removeToast } = useToast();

  const isActive = (path: string) => location.pathname === path;
  const operatore = user && !isPrivilegiato(user.role);

  // Chiudi il menu mobile a ogni cambio pagina
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('SW registered:', registration);
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    }
  }, []);

  return (
    <div className="app-shell">
      {/* Barra superiore mobile con hamburger */}
      <header className="mobile-topbar">
        <button type="button" className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Apri menu">
          <Menu size={24} />
        </button>
        <img src="/logo.png" alt="Abbraccio Cure Domiciliari" className="mobile-topbar-logo" />
      </header>

      {/* Overlay scuro quando il menu mobile è aperto */}
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <button type="button" className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Chiudi menu">
          <X size={22} />
        </button>
        <div style={{ padding: '16px 12px 8px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: '8px' }}>
          <img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ width: '100%', maxWidth: '160px', height: 'auto', display: 'block', margin: '0 auto' }} />
          {/* Pulsante switch modalità */}
          {user && (
            <button
              type="button"
              onClick={() => canSwitch && setModalita(isConvenzione ? 'privato' : 'convenzione')}
              title={
                !canSwitch
                  ? `Abilitazione: solo ${modalitaAbilitata === 'privato' ? 'pazienti privati' : 'pazienti in convenzione'}`
                  : (isConvenzione ? 'Passa a Gestione Privata' : 'Passa a Convenzione SIAT')
              }
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: canSwitch ? 'none' : '1px solid rgba(255,255,255,0.15)',
                cursor: canSwitch ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: '700',
                fontSize: '0.8rem',
                background: isConvenzione ? 'rgba(2, 132, 199, 0.25)' : 'rgba(255,255,255,0.1)',
                color: !canSwitch ? 'rgba(255,255,255,0.35)' : isConvenzione ? '#7dd3fc' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.2s',
                opacity: canSwitch ? 1 : 0.6,
              }}
            >
              <ArrowLeftRight size={14} />
              {isConvenzione ? '🏥 Convenzione SIAT' : '👤 Gestione Privata'}
              {!canSwitch && <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>🔒</span>}
            </button>
          )}
        </div>
        <nav onClick={() => setMenuOpen(false)}>
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

          {/* ===== MENU PAZIENTE/CAREGIVER REGISTRATO ===== */}
          {user && user.role === 'paziente_registrato' && (
            <>
              <Link to="/portale-paziente" className={isActive('/portale-paziente') ? 'active' : ''}>
                <Calendar size={18} />
                Prenota Servizio
              </Link>
              <Link to="/profilo-personale" className={isActive('/profilo-personale') ? 'active' : ''}>
                <UserCircle size={18} />
                Il mio profilo
              </Link>
            </>
          )}

          {/* ===== MENU OPERATORI (infermieristico, oss, riabilitativo, medico) ===== */}
          {user && operatore && user.role !== 'paziente_registrato' && (
            <>
              <Link to="/portale-operatore" className={isActive('/portale-operatore') ? 'active' : ''}>
                <LayoutDashboard size={18} />
                Dashboard
              </Link>
              <Link to="/piani-lavorativi" className={isActive('/piani-lavorativi') ? 'active' : ''}>
                <Calendar size={18} />
                Piani lavorativi
              </Link>
              <Link to="/protocolli-procedure" className={isActive('/protocolli-procedure') ? 'active' : ''}>
                <ClipboardList size={18} />
                Protocolli e Procedure
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
              {/* — Panoramica — */}
              <span className="nav-section-label">Panoramica</span>
              <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
                <LayoutDashboard size={18} />
                Dashboard
              </Link>

              {/* — Clinico — */}
              <span className="nav-section-label">Clinico</span>
              {!isConvenzione && (
                <Link to="/patients" className={isActive('/patients') ? 'active' : ''}>
                  <Users size={18} />
                  Pazienti
                </Link>
              )}
              {isConvenzione && (
                <Link to="/pazienti-convenzione" className={isActive('/pazienti-convenzione') ? 'active' : ''}>
                  <Building2 size={18} />
                  Pazienti Convenzione
                </Link>
              )}
              {!isConvenzione && (
                <Link to="/centro-prenotazioni" className={isActive('/centro-prenotazioni') ? 'active' : ''}>
                  <Calendar size={18} />
                  Centro Prenotazioni
                </Link>
              )}
              {isConvenzione && (
                <Link to="/centro-prenotazioni-convenzione" className={isActive('/centro-prenotazioni-convenzione') ? 'active' : ''}>
                  <Calendar size={18} />
                  Centro Prenotazioni
                </Link>
              )}
              <Link to="/protocolli-procedure" className={isActive('/protocolli-procedure') ? 'active' : ''}>
                <ClipboardList size={18} />
                Protocolli e Procedure
              </Link>
              <Link to="/storico-cliniche" className={isActive('/storico-cliniche') ? 'active' : ''}>
                <BookOpen size={18} />
                Storico cartelle
              </Link>
              <Link to="/archivio-cartelle" className={isActive('/archivio-cartelle') ? 'active' : ''}>
                <Archive size={18} />
                Archivio cartelle
              </Link>
              {isConvenzione && (
                <Link to="/assegnazione-pai" className={isActive('/assegnazione-pai') ? 'active' : ''}>
                  <Map size={18} />
                  Assegnazione PAI
                </Link>
              )}

              {/* — Operativo — */}
              <span className="nav-section-label">Operativo</span>
              {user.role === 'coordinator' && (
                <>
                  <Link to="/portale-operatore" className={isActive('/portale-operatore') ? 'active' : ''}>
                    <LayoutDashboard size={18} />
                    Portale Operatore
                  </Link>
                  <Link to="/piani-lavorativi" className={isActive('/piani-lavorativi') ? 'active' : ''}>
                    <Calendar size={18} />
                    Piani lavorativi
                  </Link>
                </>
              )}
              <Link to="/staff" className={isActive('/staff') ? 'active' : ''}>
                <UserPlus size={18} />
                Personale
              </Link>
              <Link to="/strumenti" className={isActive('/strumenti') ? 'active' : ''}>
                <Stethoscope size={18} />
                Strumenti e presidi
              </Link>
              <Link to="/report-consegne" className={isActive('/report-consegne') ? 'active' : ''}>
                <Package size={18} />
                Richieste e Consegne
              </Link>
              <Link
                to="/checklist-hub"
                className={location.pathname.startsWith('/checklist') || location.pathname.startsWith('/scheda-controllo') ? 'active' : ''}
              >
                <CheckSquare size={18} />
                Check List
              </Link>

              {/* — Amministrazione — */}
              <span className="nav-section-label">Amministrazione</span>
              <Link to="/compenso-incarichi" className={isActive('/compenso-incarichi') ? 'active' : ''}>
                <Euro size={18} />
                Compenso incarichi
              </Link>
              <Link to="/gestione-fatturazione" className={isActive('/gestione-fatturazione') ? 'active' : ''}>
                <Receipt size={18} />
                Fatturazione
              </Link>

              {/* — Sistema (solo admin) — */}
              {user.role === 'admin' && (
                <>
                  <span className="nav-section-label">Sistema</span>
                  <Link to="/gestione-utenti" className={isActive('/gestione-utenti') ? 'active' : ''}>
                    <ShieldCheck size={18} />
                    Gestione Utenti
                  </Link>
                  <Link to="/gestione-richieste" className={isActive('/gestione-richieste') ? 'active' : ''}>
                    <Calendar size={18} />
                    Gestione Richieste
                  </Link>
                  <Link to="/gestione-consensi-gdpr" className={isActive('/gestione-consensi-gdpr') ? 'active' : ''}>
                    <Shield size={18} />
                    Consensi GDPR
                  </Link>
                  <Link to="/esportazione-siat" className={isActive('/esportazione-siat') ? 'active' : ''}>
                    <FileText size={18} />
                    Esportazione SIAT
                  </Link>
                </>
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
        {/* Breadcrumb Navigation */}
        <Breadcrumb />
        
        <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/richiesta-servizio" element={<RichiestaServizio />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

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
          <Route path="/gestione-richieste" element={<ProtectedRoute><GestioneRichieste /></ProtectedRoute>} />
          <Route path="/centro-prenotazioni-privato" element={<ProtectedRoute><CentroPrenotazioniPrivato /></ProtectedRoute>} />
          <Route path="/portale-paziente" element={<ProtectedRoute><PortalePaziente /></ProtectedRoute>} />

          {/* Route condivise (tutti gli utenti autenticati) */}
          <Route path="/protocolli-procedure" element={<ProtectedRoute><ProtocolliProcedure /></ProtectedRoute>} />
          {/* Redirect vecchie URL protocolli/procedure → pagina unificata */}
          <Route path="/protocolli" element={<Navigate to="/protocolli-procedure" replace />} />
          <Route path="/procedure" element={<Navigate to="/protocolli-procedure" replace />} />

          {/* Esami Strumentali */}
          <Route path="/esami-strumentali" element={<ProtectedRoute><EsamiStrumentali /></ProtectedRoute>} />
          {/* Pianificazione Prelievi (vecchia pagina, mantenuta per compatibilità) */}
          <Route path="/pianificazione-prelievi" element={<ProtectedRoute><PianificazionePrelievi /></ProtectedRoute>} />
          {/* Centro Prenotazioni unificato (privato) — admin/coordinator */}
          <Route path="/centro-prenotazioni" element={<ProtectedRoute><CentroPrenotazioni /></ProtectedRoute>} />
          {/* Centro Prenotazioni convenzione SIAT */}
          <Route path="/centro-prenotazioni-convenzione" element={<ProtectedRoute><CentroPrenotazioniConvenzione /></ProtectedRoute>} />
          {/* Centro Prenotazioni Prelievi — mantenuto per compatibilità */}
          <Route path="/centro-prelievi" element={<ProtectedRoute><CentroPrelievi /></ProtectedRoute>} />
          {/* Assegnazione PAI */}
          <Route path="/assegnazione-pai" element={<ProtectedRoute><AssegnazionePAI /></ProtectedRoute>} />

          {/* Richieste Presidi/Farmaci */}
          <Route path="/richieste-presidi" element={<ProtectedRoute><RichiestePresidiPage /></ProtectedRoute>} />
          {/* Gestione richieste ora integrata come scheda dentro /strumenti */}
          <Route path="/gestione-richieste-presidi" element={<Navigate to="/strumenti" replace />} />

          {/* Route operatori */}
          <Route path="/portale-operatore" element={<ProtectedRoute><PortaleOperatore mode="dashboard" /></ProtectedRoute>} />
          <Route path="/piani-lavorativi" element={<ProtectedRoute><PortaleOperatore mode="piani" /></ProtectedRoute>} />
          <Route path="/profilo-personale" element={<ProtectedRoute><ProfiloPersonale /></ProtectedRoute>} />
          <Route path="/compenso-incarichi" element={<ProtectedRoute><CompensoIncarichi /></ProtectedRoute>} />
          <Route path="/report-consegne" element={<ProtectedRoute><ReportConsegne /></ProtectedRoute>} />
          <Route path="/gestione-fatturazione" element={<ProtectedRoute><GestioneFatturazione /></ProtectedRoute>} />
          {/* GDPR Compliance - Gestione Consensi */}
          <Route path="/gestione-consensi-gdpr" element={<ProtectedRoute><GestioneConsensiGDPR /></ProtectedRoute>} />
          {/* Esportazione SIAT */}
          <Route path="/esportazione-siat" element={<ProtectedRoute><EsportazioneSIAT /></ProtectedRoute>} />
          {/* Pazienti in Convenzione SIAT Lazio */}
          <Route path="/pazienti-convenzione" element={<ProtectedRoute><PazientiConvenzione /></ProtectedRoute>} />
          {/* Registrazione accesso con firma touch (ottimizzata tablet/mobile) */}
          <Route path="/registrazione-accesso/:workPlanId" element={<ProtectedRoute><RegistrazioneAccesso /></ProtectedRoute>} />
        </Routes>
        </Suspense>
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} position="top-right" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ModalitaProvider>
        <AppShell />
      </ModalitaProvider>
    </AuthProvider>
  );
}

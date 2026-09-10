import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
import { Users, Activity, CheckCircle, ClipboardList, MapPin, AlertTriangle, Bell, Eye, MessageCircle, Video } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Loading } from '../components/ui/Loading';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import DashboardTelemedicina from '../components/DashboardTelemedicina';

interface DashboardCounts {
  patientsCount: number;
  staffCount: number;
  workplanCount: number;
  activePatientsCount: number;
  activeWorkplanCount: number;
  prelieviOggiCount: number;
  operatoriSenzaZonaCount: number;
  scadenzeImminentiCount: number;
  paiInScadenza7gg: number;
}

interface PazienteScadenza {
  _id: string;
  firstName: string;
  lastName: string;
  address?: string;
  siat?: {
    dataScadenzaAutorizzazione?: string;
    tipologiaCura?: string;
    npi?: string;
    asl?: string;
    distretto?: string;
  };
  alertPaiVisto?: {
    vistoIl: string;
    vistoDa: string;
    vistoDaId: string;
  };
}

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConvenzione } = useModalita();
  const isPrivilegiato = user && ['admin', 'coordinator', 'direttore'].includes(user.role);

  const [counts, setCounts] = useState<DashboardCounts>({
    patientsCount: 0,
    staffCount: 0,
    workplanCount: 0,
    activePatientsCount: 0,
    activeWorkplanCount: 0,
    prelieviOggiCount: 0,
    operatoriSenzaZonaCount: 0,
    scadenzeImminentiCount: 0,
    paiInScadenza7gg: 0,
  });
  const [loading, setLoading] = useState(true);
  const [unreadChat, setUnreadChat] = useState({ general: 0, patient: 0, total: 0 });
  const [assignmentCounts, setAssignmentCounts] = useState({ in_attesa: 0, accettato: 0, rifiutato: 0 });

  // Alert PAI in scadenza
  const [paiScadenza, setPaiScadenza] = useState<PazienteScadenza[]>([]);
  const [showPaiAlert, setShowPaiAlert] = useState(false);
  const [chiudendoId, setChiudendoId] = useState<string | null>(null);

  // Utenti in attesa di approvazione (solo admin)
  const [pendingCount, setPendingCount] = useState(0);

  const caricaScadenzePai = async () => {
    try {
      const res = await api.get('/patients/scadenze-pai');
      setPaiScadenza(res.data || []);
    } catch { /* noop */ }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const tipoQuery = isConvenzione ? '?tipo=convenzione' : '?tipo=privato';
        const [dashRes] = await Promise.all([
          api.get(`/dashboard${tipoQuery}`),
          isPrivilegiato ? caricaScadenzePai() : Promise.resolve(),
        ]);
        setCounts(dashRes.data);
        try {
          const unreadRes = await api.get('/messages/unread-count');
          setUnreadChat(unreadRes.data || { general: 0, patient: 0, total: 0 });
        } catch { /* non bloccante */ }
        if (isPrivilegiato) {
          try {
            const tipoQuery = isConvenzione ? '?tipo=convenzione' : '?tipo=privato';
            const assignmentsRes = await api.get(`/workplan/assignment-status${tipoQuery}`);
            setAssignmentCounts(assignmentsRes.data.counts || { in_attesa: 0, accettato: 0, rifiutato: 0 });
          } catch { /* non bloccante */ }
        }
        // Conta utenti pending (solo admin)
        if (user?.role === 'admin') {
          try {
            const usersRes = await api.get('/auth/all-users');
            setPendingCount(usersRes.data.filter((u: any) => u.status === 'pending').length);
          } catch { /* non bloccante */ }
        }
      } catch (error) {
        console.error('Errore caricamento dashboard', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [isConvenzione]);

  const segnaVisto = async (pazienteId: string) => {
    setChiudendoId(pazienteId);
    try {
      await api.patch(`/patients/${pazienteId}/segna-alert-visto`);
      setPaiScadenza(prev => prev.filter(p => p._id !== pazienteId));
      setCounts(prev => ({ ...prev, paiInScadenza7gg: Math.max(0, prev.paiInScadenza7gg - 1) }));
    } catch { /* noop */ }
    setChiudendoId(null);
  };

  const formatDataBreve = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const giorniAllaScadenza = (d?: string): number | null => {
    if (!d) return null;
    return Math.floor((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const dashboardCards = [
    {
      title: 'Pazienti attivi',
      subtitle: `${counts.patientsCount} totali`,
      value: counts.activePatientsCount,
      icon: CheckCircle,
      color: '#059669',
      bgColor: 'rgba(5, 150, 105, 0.1)',
      link: '/patients',
    },
    {
      title: 'Incarichi attivi',
      subtitle: `${counts.workplanCount} totali`,
      value: counts.activeWorkplanCount,
      icon: ClipboardList,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      link: '/workplan',
    },
    {
      title: 'Pazienti totali',
      subtitle: 'in archivio',
      value: counts.patientsCount,
      icon: Users,
      color: '#4f46e5',
      bgColor: 'rgba(79, 70, 229, 0.1)',
      link: '/patients',
    },
    ...(isPrivilegiato ? [{
      title: 'Pazienti assegnati',
      subtitle: `${assignmentCounts.in_attesa} in attesa · ${assignmentCounts.accettato} accettati · ${assignmentCounts.rifiutato} rifiutati`,
      value: assignmentCounts.in_attesa,
      icon: ClipboardList,
      color: assignmentCounts.in_attesa > 0 ? '#dc2626' : '#2563eb',
      bgColor: assignmentCounts.in_attesa > 0 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(37, 99, 235, 0.1)',
      link: '/workplan',
    }] : []),
    {
      title: unreadChat.total > 0 ? 'Chat non lette' : 'Chat',
      subtitle: unreadChat.total > 0
        ? `${unreadChat.general} generali · ${unreadChat.patient} paziente`
        : 'Nessun nuovo messaggio',
      value: unreadChat.total,
      icon: MessageCircle,
      color: unreadChat.total > 0 ? '#ef4444' : '#0d9488',
      bgColor: unreadChat.total > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(13, 148, 136, 0.1)',
      link: '/chat',
    },
    {
      title: 'Telemedicina',
      subtitle: 'Gestione video-consulti e parametri',
      value: 'Vai',
      icon: Video,
      color: '#0f766e',
      bgColor: 'rgba(15, 118, 110, 0.1)',
      link: '/telemedicina',
    },
  ];

  const alertCards = [
    counts.operatoriSenzaZonaCount > 0 && {
      title: 'Operatori senza zona',
      desc: `${counts.operatoriSenzaZonaCount} operatori non hanno impostato il domicilio di partenza e non vengono trovati nell\'assegnazione geografica.`,
      icon: MapPin,
      color: '#d97706',
      bgColor: 'rgba(217, 119, 6, 0.08)',
      border: '#fcd34d',
      link: '/staff',
      btnLabel: 'Vai al Personale →',
    },
    counts.scadenzeImminentiCount > 0 && {
      title: `${counts.scadenzeImminentiCount} autorizzazioni SIAT in scadenza (30gg)`,
      desc: 'Pazienti in convenzione con autorizzazione in scadenza nei prossimi 30 giorni.',
      icon: AlertTriangle,
      color: '#dc2626',
      bgColor: 'rgba(220, 38, 38, 0.06)',
      border: '#fca5a5',
      link: '/pazienti-convenzione',
      btnLabel: 'Vai ai pazienti convenzione →',
    },
  ].filter(Boolean) as { title: string; desc: string; icon: any; color: string; bgColor: string; border: string; link: string; btnLabel: string }[];

  // Paziente/caregiver registrato → portale dedicato
  if (user?.role === 'paziente_registrato') {
    return <Navigate to="/portale-paziente" replace />;
  }

  if (user && !isPrivilegiato) {
    return <Navigate to="/portale-operatore" replace />;
  }

  if (loading) {
    return (
      <section className="tw-max-w-none">
        <h2><Activity size={28} />Dashboard</h2>
        <div className="tw-grid tw-grid-cols-[repeat(auto-fit,minmax(200px,1fr))] tw-gap-4 tw-mb-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} padding="md">
              <div className="tw-flex tw-justify-between tw-items-start tw-mb-4">
                <div className="tw-flex-1">
                  <div className="skeleton skeleton-text tw-w-[70%] tw-mb-1.5" />
                  <div className="skeleton skeleton-text tw-w-[45%] tw-h-3" />
                </div>
                <div className="skeleton tw-w-10 tw-h-10 tw-rounded-lg tw-flex-shrink-0" />
              </div>
              <div className="skeleton tw-w-1/2 tw-h-[2.2rem] tw-rounded-md" />
            </Card>
          ))}
        </div>
        <div className="tw-flex tw-flex-col tw-gap-3">
          {[1, 2].map(i => (
            <Card key={i}>
              <div className="skeleton tw-h-10 tw-rounded-md" />
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="tw-max-w-none">
      <h2 className="tw-flex tw-items-center tw-gap-2">
        <Activity size={28} />
        Dashboard
      </h2>

      {/* Banner utenti in attesa — solo admin */}
      {user?.role === 'admin' && pendingCount > 0 && (
        <div
          onClick={() => navigate('/gestione-utenti')}
          className="tw-flex tw-items-center tw-gap-3 tw-mb-5 tw-cursor-pointer tw-rounded-xl tw-border-2 tw-border-amber-400 tw-bg-amber-400/10 tw-px-4 tw-py-3 hover:tw-bg-amber-400/20 tw-transition-colors"
        >
          <Bell size={22} color="#d97706" className="tw-flex-shrink-0" />
          <div className="tw-flex-1">
            <div className="tw-font-bold tw-text-amber-800 tw-text-sm">
              {pendingCount} {pendingCount === 1 ? 'nuova richiesta di accesso' : 'nuove richieste di accesso'} in attesa
            </div>
            <div className="tw-text-amber-700 tw-text-xs tw-mt-0.5">
              Clicca per approvare o rifiutare gli utenti registrati
            </div>
          </div>
          <span className="tw-flex-shrink-0 tw-rounded-full tw-bg-amber-500 tw-text-white tw-font-extrabold tw-text-sm tw-px-3 tw-py-1">{pendingCount}</span>
        </div>
      )}

      <div className="tw-grid tw-grid-cols-[repeat(auto-fit,minmax(200px,1fr))] tw-gap-4">
        {dashboardCards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => navigate(card.link)}
            className="tw-group tw-relative tw-flex tw-flex-col tw-min-w-0 tw-w-full tw-text-left tw-bg-white tw-border tw-border-slate-200 tw-rounded-2xl tw-p-5 tw-shadow-sm tw-cursor-pointer tw-transition-all hover:tw-shadow-md hover:tw--translate-y-0.5"
          >
            <span className="tw-absolute tw-top-0 tw-left-0 tw-right-0 tw-h-1 tw-rounded-t-2xl tw-bg-gradient-to-r tw-from-brand tw-to-brand-light" />
            <div className="tw-flex tw-items-start tw-justify-between tw-gap-3 tw-mb-3">
              <div className="tw-flex-1 tw-min-w-0">
                <h3 className="tw-m-0 tw-mb-1 tw-text-slate-500 tw-text-sm tw-font-bold tw-leading-tight tw-break-words">{card.title}</h3>
                <p className="tw-m-0 tw-text-slate-400 tw-text-[0.82rem] tw-leading-snug tw-break-words">{card.subtitle}</p>
              </div>
              <div
                className="tw-flex tw-items-center tw-justify-center tw-w-10 tw-h-10 tw-rounded-lg tw-flex-shrink-0"
                style={{ backgroundColor: card.bgColor }}
              >
                <card.icon size={20} color={card.color} />
              </div>
            </div>
            <p
              className={`tw-m-0 tw-font-bold tw-break-words ${typeof card.value === 'number' ? 'tw-text-[2.2rem] tw-leading-none tw-tracking-tight' : 'tw-text-[1.15rem] tw-leading-snug'}`}
              style={{ color: card.color }}
            >
              {card.value}
            </p>
          </button>
        ))}
      </div>

      <DashboardTelemedicina />

      {/* ════ ALERT PAI IN SCADENZA 7 GIORNI ════ */}
      {isPrivilegiato && counts.paiInScadenza7gg > 0 && (
        <div className="tw-mt-5">
          <button
            type="button"
            onClick={() => setShowPaiAlert(v => !v)}
            className={`tw-w-full tw-flex tw-items-center tw-justify-between tw-gap-3 tw-bg-red-600/[0.07] tw-border-2 tw-border-red-300 tw-px-4 tw-py-3 tw-cursor-pointer ${showPaiAlert ? 'tw-rounded-t-lg' : 'tw-rounded-lg'}`}
          >
            <div className="tw-flex tw-items-center tw-gap-2.5">
              <Bell size={20} color="#dc2626" />
              <span className="tw-font-bold tw-text-red-600 tw-text-sm">
                ⚠️ {counts.paiInScadenza7gg} PAI SIAT in scadenza entro 7 giorni
              </span>
              <span className="tw-bg-red-600 tw-text-white tw-rounded-lg tw-px-2 tw-py-0.5 tw-text-xs tw-font-extrabold">
                {counts.paiInScadenza7gg}
              </span>
            </div>
            <span className="tw-text-xs tw-text-red-600 tw-font-semibold">{showPaiAlert ? '▲ Chiudi' : '▼ Mostra lista'}</span>
          </button>

          {showPaiAlert && (
            <div className="tw-border-2 tw-border-t-0 tw-border-red-300 tw-rounded-b-lg tw-bg-white tw-overflow-hidden">
              {paiScadenza.length === 0 ? (
                <p className="tw-p-4 tw-text-slate-400 tw-m-0 tw-text-sm">Caricamento lista...</p>
              ) : (
                <div className="tw-flex tw-flex-col">
                  {paiScadenza.map((paz, i) => {
                    const giorni = giorniAllaScadenza(paz.siat?.dataScadenzaAutorizzazione);
                    const scaduto = giorni !== null && giorni < 0;
                    const urgente = giorni !== null && giorni <= 2 && !scaduto;
                    return (
                      <div
                        key={paz._id}
                        className={`tw-flex tw-items-start tw-justify-between tw-gap-3 tw-flex-wrap tw-px-4 tw-py-3.5 ${i > 0 ? 'tw-border-t tw-border-red-100' : ''} ${scaduto ? 'tw-bg-red-600/[0.04]' : urgente ? 'tw-bg-amber-500/[0.04]' : 'tw-bg-white'}`}
                      >
                        <div className="tw-flex-1 tw-min-w-[200px]">
                          <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap tw-font-bold tw-text-[0.92rem] tw-text-brand tw-mb-0.5">
                            {paz.firstName} {paz.lastName}
                            {scaduto ? (
                              <span className="tw-bg-red-600 tw-text-white tw-rounded tw-px-1.5 tw-py-0.5 tw-text-[0.72rem] tw-font-extrabold">SCADUTO {Math.abs(giorni!)} gg fa</span>
                            ) : urgente ? (
                              <span className="tw-bg-amber-500 tw-text-white tw-rounded tw-px-1.5 tw-py-0.5 tw-text-[0.72rem] tw-font-extrabold">⚡ {giorni} gg</span>
                            ) : (
                              <span className="tw-bg-amber-100 tw-text-amber-800 tw-border tw-border-amber-300 tw-rounded tw-px-1.5 tw-py-0.5 tw-text-[0.72rem] tw-font-bold">{giorni} gg</span>
                            )}
                          </div>
                          <div className="tw-flex tw-flex-wrap tw-gap-2 tw-text-[0.8rem] tw-text-slate-600">
                            <span>📅 Scadenza: <strong>{formatDataBreve(paz.siat?.dataScadenzaAutorizzazione)}</strong></span>
                            {paz.siat?.tipologiaCura && <span>🩺 {paz.siat.tipologiaCura}</span>}
                            {paz.siat?.npi && <span>NPI: {paz.siat.npi}</span>}
                            {paz.siat?.asl && <span>ASL: {paz.siat.asl}</span>}
                            {paz.siat?.distretto && <span>Distretto: {paz.siat.distretto}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => segnaVisto(paz._id)}
                          disabled={chiudendoId === paz._id}
                          className={`tw-flex tw-items-center tw-gap-1.5 tw-flex-shrink-0 tw-whitespace-nowrap tw-rounded-lg tw-border tw-border-green-300 tw-px-3.5 tw-py-2 tw-text-[0.82rem] tw-font-bold tw-text-emerald-800 ${chiudendoId === paz._id ? 'tw-bg-slate-200 tw-cursor-not-allowed' : 'tw-bg-green-50 tw-cursor-pointer'}`}
                        >
                          <Eye size={14} />
                          {chiudendoId === paz._id ? '...' : 'Ho visto – chiudi'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alert cards */}
      {alertCards.length > 0 && (
        <div className="tw-mt-5 tw-flex tw-flex-col tw-gap-3">
          <h3 className="tw-m-0 tw-mb-1 tw-text-sm tw-text-slate-700 tw-flex tw-items-center tw-gap-2">
            <AlertTriangle size={18} color="#d97706" /> Attenzione richiesta
          </h3>
          {alertCards.map((card) => (
            <div
              key={card.title}
              className="tw-flex tw-items-start tw-gap-3 tw-rounded-lg tw-px-4 tw-py-3.5"
              style={{
                backgroundColor: card.bgColor,
                border: `1px solid ${card.border}`,
                borderLeft: `4px solid ${card.color}`,
              }}
            >
              <card.icon size={20} color={card.color} className="tw-flex-shrink-0 tw-mt-0.5" />
              <div className="tw-flex-1">
                <div className="tw-font-bold tw-text-sm tw-mb-0.5" style={{ color: card.color }}>{card.title}</div>
                <div className="tw-text-[0.83rem] tw-text-slate-700 tw-mb-2">{card.desc}</div>
                <button
                  type="button"
                  onClick={() => navigate(card.link)}
                  className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-font-bold tw-text-[0.83rem] tw-p-0 tw-underline"
                  style={{ color: card.color }}
                >
                  {card.btnLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Dashboard;

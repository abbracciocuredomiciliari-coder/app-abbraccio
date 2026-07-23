import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Users, Activity, CheckCircle, ClipboardList, MapPin, AlertTriangle, Bell, Eye, MessageCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Loading } from '../components/ui/Loading';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

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
        const [dashRes] = await Promise.all([
          api.get('/dashboard'),
          isPrivilegiato ? caricaScadenzePai() : Promise.resolve(),
        ]);
        setCounts(dashRes.data);
        try {
          const unreadRes = await api.get('/messages/unread-count');
          setUnreadChat(unreadRes.data || { general: 0, patient: 0, total: 0 });
        } catch { /* non bloccante */ }
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
  }, []);

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

  if (loading) {
    return (
      <section>
        <h2><Activity size={28} />Dashboard</h2>
        <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
          {[1, 2, 3, 4].map(i => (
            <Card key={i} padding="md">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text" style={{ width: '70%', marginBottom: '6px' }} />
                  <div className="skeleton skeleton-text" style={{ width: '45%', height: '0.75rem' }} />
                </div>
                <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0 }} />
              </div>
              <div className="skeleton" style={{ width: '50%', height: '2.2rem', borderRadius: '6px' }} />
            </Card>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2].map(i => (
            <Card key={i}>
              <div className="skeleton" style={{ height: '40px', borderRadius: '6px' }} />
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2>
        <Activity size={28} />
        Dashboard
      </h2>
      <>
          {/* Banner utenti in attesa — solo admin */}
          {user?.role === 'admin' && pendingCount > 0 && (
            <div
              onClick={() => navigate('/gestione-utenti')}
              style={{ background: 'rgba(245,158,11,0.12)', border: '2px solid #f59e0b', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'background 0.15s' }}
            >
              <Bell size={22} color="#d97706" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: '#92400e', fontSize: '0.95rem' }}>
                  {pendingCount} {pendingCount === 1 ? 'nuova richiesta di accesso' : 'nuove richieste di accesso'} in attesa
                </div>
                <div style={{ color: '#b45309', fontSize: '0.82rem', marginTop: '2px' }}>
                  Clicca per approvare o rifiutare gli utenti registrati
                </div>
              </div>
              <span style={{ background: '#f59e0b', color: 'white', borderRadius: '20px', padding: '4px 12px', fontWeight: '800', fontSize: '0.9rem', flexShrink: 0 }}>{pendingCount}</span>
            </div>
          )}
          <div className="dashboard-grid">
            {dashboardCards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => navigate(card.link)}
                className="dashboard-card"
                style={{ cursor: 'pointer', textAlign: 'left', background: 'white', border: '1px solid #e2e8f0', width: '100%' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.9rem' }}>{card.title}</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--gray-400)' }}>{card.subtitle}</p>
                  </div>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: card.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <card.icon size={20} color={card.color} />
                  </div>
                </div>
                <p style={{ fontSize: '2.5rem', fontWeight: 700, color: card.color, margin: 0, lineHeight: 1 }}>
                  {card.value}
                </p>
              </button>
            ))}
          </div>

          {/* ════ ALERT PAI IN SCADENZA 7 GIORNI ════ */}
          {isPrivilegiato && counts.paiInScadenza7gg > 0 && (
            <div style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setShowPaiAlert(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(220,38,38,0.07)', border: '2px solid #fca5a5',
                  borderBottom: showPaiAlert ? '2px solid #fca5a5' : '2px solid #fca5a5',
                  borderRadius: showPaiAlert ? '10px 10px 0 0' : '10px',
                  padding: '12px 16px', cursor: 'pointer', gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Bell size={20} color="#dc2626" />
                  <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.95rem' }}>
                    ⚠️ {counts.paiInScadenza7gg} PAI SIAT in scadenza entro 7 giorni
                  </span>
                  <span style={{ background: '#dc2626', color: 'white', borderRadius: '10px', padding: '1px 8px', fontSize: '0.78rem', fontWeight: 800 }}>
                    {counts.paiInScadenza7gg}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>{showPaiAlert ? '▲ Chiudi' : '▼ Mostra lista'}</span>
              </button>

              {showPaiAlert && (
                <div style={{
                  border: '2px solid #fca5a5', borderTop: 'none', borderRadius: '0 0 10px 10px',
                  background: 'white', overflow: 'hidden',
                }}>
                  {paiScadenza.length === 0 ? (
                    <p style={{ padding: '16px', color: '#888', margin: 0, fontSize: '0.88rem' }}>Caricamento lista...</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {paiScadenza.map((paz, i) => {
                        const giorni = giorniAllaScadenza(paz.siat?.dataScadenzaAutorizzazione);
                        const scaduto = giorni !== null && giorni < 0;
                        const urgente = giorni !== null && giorni <= 2 && !scaduto;
                        return (
                          <div
                            key={paz._id}
                            style={{
                              padding: '14px 16px',
                              borderTop: i > 0 ? '1px solid #fee2e2' : 'none',
                              background: scaduto ? 'rgba(220,38,38,0.04)' : urgente ? 'rgba(245,158,11,0.04)' : 'white',
                              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e4d8c', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {paz.firstName} {paz.lastName}
                                {scaduto ? (
                                  <span style={{ background: '#dc2626', color: 'white', borderRadius: '5px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 800 }}>SCADUTO {Math.abs(giorni!)} gg fa</span>
                                ) : urgente ? (
                                  <span style={{ background: '#f59e0b', color: 'white', borderRadius: '5px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 800 }}>⚡ {giorni} gg</span>
                                ) : (
                                  <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: '5px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700 }}>{giorni} gg</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: chiudendoId === paz._id ? '#e5e7eb' : '#f0fdf4',
                                border: '1px solid #bbf7d0', borderRadius: '8px',
                                padding: '8px 14px', cursor: chiudendoId === paz._id ? 'not-allowed' : 'pointer',
                                color: '#065f46', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0,
                              }}
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
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#d97706" /> Attenzione richiesta
              </h3>
              {alertCards.map((card) => (
                <div
                  key={card.title}
                  style={{
                    background: card.bgColor,
                    border: `1px solid ${card.border}`,
                    borderLeft: `4px solid ${card.color}`,
                    borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <card.icon size={20} color={card.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: card.color, fontSize: '0.9rem', marginBottom: '3px' }}>{card.title}</div>
                    <div style={{ fontSize: '0.83rem', color: '#374151', marginBottom: '8px' }}>{card.desc}</div>
                    <button
                      type="button"
                      onClick={() => navigate(card.link)}
                      style={{ background: 'none', border: 'none', color: card.color, cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', padding: 0, textDecoration: 'underline' }}
                    >
                      {card.btnLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </>
    </section>
  );
}

export default Dashboard;

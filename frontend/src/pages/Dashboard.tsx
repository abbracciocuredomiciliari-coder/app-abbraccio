import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { Users, UserPlus, Calendar, Activity, CheckCircle, ClipboardList, Syringe, MapPin, AlertTriangle } from 'lucide-react';

interface DashboardCounts {
  patientsCount: number;
  staffCount: number;
  workplanCount: number;
  activePatientsCount: number;
  activeWorkplanCount: number;
  prelieviOggiCount: number;
  operatoriSenzaZonaCount: number;
  scadenzeImminentiCount: number;
}

function Dashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<DashboardCounts>({
    patientsCount: 0,
    staffCount: 0,
    workplanCount: 0,
    activePatientsCount: 0,
    activeWorkplanCount: 0,
    prelieviOggiCount: 0,
    operatoriSenzaZonaCount: 0,
    scadenzeImminentiCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await api.get('/dashboard');
        setCounts(response.data);
      } catch (error) {
        console.error('Errore caricamento dashboard', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

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
      title: 'Prelievi oggi',
      subtitle: 'da eseguire',
      value: counts.prelieviOggiCount,
      icon: Syringe,
      color: '#0369a1',
      bgColor: 'rgba(3, 105, 161, 0.1)',
      link: '/pianificazione-prelievi',
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
      title: `${counts.scadenzeImminentiCount} autorizzazioni SIAT in scadenza`,
      desc: 'Pazienti in convenzione con autorizzazione in scadenza nei prossimi 30 giorni.',
      icon: AlertTriangle,
      color: '#dc2626',
      bgColor: 'rgba(220, 38, 38, 0.06)',
      border: '#fca5a5',
      link: '/pazienti-convenzione',
      btnLabel: 'Vai ai pazienti convenzione →',
    },
  ].filter(Boolean) as { title: string; desc: string; icon: any; color: string; bgColor: string; border: string; link: string; btnLabel: string }[];

  return (
    <section>
      <h2>
        <Activity size={28} />
        Dashboard
      </h2>
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <>
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
      )}
    </section>
  );
}

export default Dashboard;

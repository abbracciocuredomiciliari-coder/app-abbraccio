import { useEffect, useState } from 'react';
import api from '../api/api';
import { Users, UserPlus, Calendar, Activity, CheckCircle, ClipboardList } from 'lucide-react';

interface DashboardCounts {
  patientsCount: number;
  staffCount: number;
  workplanCount: number;
  activePatientsCount: number;
  activeWorkplanCount: number;
}

function Dashboard() {
  const [counts, setCounts] = useState<DashboardCounts>({
    patientsCount: 0,
    staffCount: 0,
    workplanCount: 0,
    activePatientsCount: 0,
    activeWorkplanCount: 0,
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
    },
    {
      title: 'Incarichi attivi',
      subtitle: `${counts.workplanCount} totali`,
      value: counts.activeWorkplanCount,
      icon: ClipboardList,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
    },
    {
      title: 'Personale attivo',
      subtitle: 'operatori',
      value: counts.staffCount,
      icon: UserPlus,
      color: '#06b6d4',
      bgColor: 'rgba(6, 182, 212, 0.1)',
    },
    {
      title: 'Pazienti totali',
      subtitle: 'in archivio',
      value: counts.patientsCount,
      icon: Users,
      color: '#4f46e5',
      bgColor: 'rgba(79, 70, 229, 0.1)',
    },
  ];

  return (
    <section>
      <h2>
        <Activity size={28} />
        Dashboard
      </h2>
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="dashboard-grid">
          {dashboardCards.map((card) => (
            <div key={card.title} className="dashboard-card">
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Dashboard;

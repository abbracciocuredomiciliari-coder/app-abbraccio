import { useEffect, useState } from 'react';
import api from '../api/api';
import { Users, UserPlus, Calendar, Activity, Stethoscope, FileText } from 'lucide-react';

function Dashboard() {
  const [counts, setCounts] = useState({ patientsCount: 0, staffCount: 0, workplanCount: 0 });
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
      title: 'Pazienti',
      value: counts.patientsCount,
      icon: Users,
      color: '#4f46e5',
      bgColor: 'rgba(79, 70, 229, 0.1)',
    },
    {
      title: 'Staff',
      value: counts.staffCount,
      icon: UserPlus,
      color: '#06b6d4',
      bgColor: 'rgba(6, 182, 212, 0.1)',
    },
    {
      title: 'Incarichi',
      value: counts.workplanCount,
      icon: Calendar,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
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
                <h3 style={{ margin: 0, color: 'var(--gray-500)' }}>{card.title}</h3>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: card.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
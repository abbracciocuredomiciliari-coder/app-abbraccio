import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Video, Activity, AlertTriangle, Bell, Server, HeartPulse, ArrowRight, Loader2 } from 'lucide-react';

type TopAlert = {
  _id: string;
  pazienteNome: string;
  priorita: string;
  messaggio: string;
};

type DashboardData = {
  alertCritici: number;
  alertAperti: number;
  teleconsultiOggi: number;
  dispositiviOffline: number;
  parametri24h: number;
  pazientiMonitorati: number;
  topAlerts: TopAlert[];
};

const colorByPriorita: Record<string, string> = {
  critica: '#dc2626',
  alta: '#d97706',
  media: '#2563eb',
  bassa: '#64748b',
};

export default function DashboardTelemedicina() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/telemedicina/dashboard')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card title="Telemedicina" icon={<Activity size={20} />}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <Loader2 className="animate-spin" style={{ color: '#0d9488' }} />
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const cards = [
    { title: 'Alert aperti', value: data.alertAperti, icon: Bell, color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)', link: '/telemedicina?tab=centrale' },
    { title: 'Alert critici', value: data.alertCritici, icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)', link: '/telemedicina?tab=centrale' },
    { title: 'Teleconsulti oggi', value: data.teleconsultiOggi, icon: Video, color: '#0d9488', bg: 'rgba(13, 148, 136, 0.08)', link: '/telemedicina?tab=agenda' },
    { title: 'Dispositivi offline', value: data.dispositiviOffline, icon: Server, color: '#d97706', bg: 'rgba(217, 119, 6, 0.08)', link: '/telemedicina?tab=dispositivi' },
    { title: 'Parametri 24h', value: data.parametri24h, icon: HeartPulse, color: '#0891b2', bg: 'rgba(8, 145, 178, 0.08)', link: '/telemedicina?tab=dispositivi' },
    { title: 'Pazienti monitorati', value: data.pazientiMonitorati, icon: Activity, color: '#1e4d8c', bg: 'rgba(30, 77, 140, 0.08)', link: '/telemedicina' },
  ];

  return (
    <Card title="Telemedicina" icon={<Activity size={20} />} action={
      <Button variant="primary" size="sm" icon={<ArrowRight size={14} />} onClick={() => navigate('/telemedicina?tab=centrale')}>Apri</Button>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {cards.map(c => (
          <button
            key={c.title}
            onClick={() => navigate(c.link)}
            type="button"
            style={{
              textAlign: 'left',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon size={18} color={c.color} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.title}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: c.color, lineHeight: 1.2 }}>{c.value}</div>
            </div>
          </button>
        ))}
      </div>

      {data.topAlerts.length > 0 && (
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '10px' }}>Top 5 alert urgenti</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.topAlerts.map(a => (
              <button
                key={a._id}
                onClick={() => navigate('/telemedicina?tab=centrale')}
                type="button"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{a.pazienteNome}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{a.messaggio}</div>
                </div>
                <span style={{ background: colorByPriorita[a.priorita] || '#64748b', color: 'white', borderRadius: '20px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {a.priorita}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

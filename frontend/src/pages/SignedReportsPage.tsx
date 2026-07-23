import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';
import { FileText, X, Loader2, Search, Calendar, User } from 'lucide-react';

interface SignedReport {
  _id: string;
  reportText: string;
  signatureBase64: string;
  staffName: string;
  scope: 'all' | 'category';
  category?: string;
  workPlanType?: string;
  fromDate?: string;
  toDate?: string;
  createdAt: string;
  patient?: { firstName: string; lastName: string };
}

export default function SignedReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<SignedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SignedReport | null>(null);
  const [search, setSearch] = useState('');

  const privileged = ['admin', 'coordinator', 'direttore'].includes(user?.role || '');

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/reports/signed');
      setReports(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore caricamento relazioni');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filtered = reports.filter(r => {
    const patientName = r.patient ? `${r.patient.firstName} ${r.patient.lastName}`.toLowerCase() : '';
    const term = search.toLowerCase();
    return patientName.includes(term) || r.staffName.toLowerCase().includes(term);
  });

  const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString('it-IT') : '-');

  const categoryLabel = (cat?: string) => {
    const map: Record<string, string> = {
      infermieristica: 'Infermieristica',
      riabilitativa: 'Fisioterapia / Riabilitativa',
      medica: 'Medica',
      assistenziale: 'Assistenziale OSS',
      sociale: 'Sociale',
    };
    return cat ? map[cat] || cat : '';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', color: '#1e4d8c' }}>📄 Relazioni firmate</h2>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Cerca per paziente o operatore"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </div>
        <Button onClick={fetchReports} variant="secondary" icon={loading ? <Loader2 size={16} /> : <Calendar size={16} />}>
          Aggiorna
        </Button>
      </div>

      {error && (
        <div style={{ padding: '12px', borderRadius: '6px', background: '#fef2f2', color: '#991b1b', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading && !reports.length ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <p>Caricamento...</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Data</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Paziente</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Tipo</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Prestazione</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Operatore</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r._id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>{formatDate(r.createdAt)}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>
                    {r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>
                    {r.scope === 'category' ? 'Per prestazione' : 'Generale'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>
                    {categoryLabel(r.category)} {r.workPlanType ? `(${r.workPlanType})` : ''}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>{r.staffName}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Button onClick={() => setSelected(r)} variant="secondary" size="sm" icon={<FileText size={14} />}>
                      Visualizza
                    </Button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    Nessuna relazione firmata trovata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#1e4d8c' }}>Relazione firmata</h3>
              <button onClick={() => setSelected(null)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: '#475569', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span><User size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {selected.patient ? `${selected.patient.firstName} ${selected.patient.lastName}` : '—'}</span>
              <span><Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {formatDate(selected.createdAt)}</span>
              <span>Firmata da: {selected.staffName}</span>
            </div>

            <textarea
              readOnly
              value={selected.reportText}
              style={{ flex: 1, minHeight: '300px', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'Arial, sans-serif', fontSize: '0.9rem', lineHeight: 1.5, resize: 'vertical', background: '#f8fafc' }}
            />

            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px' }}>Firma digitale</div>
              <img src={selected.signatureBase64} alt="Firma" style={{ maxWidth: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

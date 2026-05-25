import { useEffect, useState } from 'react';
import api from '../api/api';

interface StaffDoc {
  _id: string;
  name: string;
  url: string;
  tipo?: string;
  createdAt: string;
}

interface StaffProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  category: string;
  phone?: string;
  active: boolean;
  dataInizioCollaborazione?: string;
  dataFineCollaborazione?: string;
  note?: string;
}

const categoriaLabel: Record<string, string> = {
  infermieristico: '🩺 Infermieristico',
  oss: '🤝 OSS',
  riabilitativo: '🏃 Riabilitativo',
  medico: '👨‍⚕️ Medico',
  coordinamento: '📋 Coordinamento',
  direzione: '🏥 Direzione',
};

function formatData(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ProfiloPersonale() {
  const [profilo, setProfilo] = useState<StaffProfile | null>(null);
  const [documenti, setDocumenti] = useState<StaffDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    fetchProfilo();
  }, []);

  const fetchProfilo = async () => {
    try {
      const res = await api.get('/workplan/mio-profilo-staff');
      setProfilo(res.data);

      // Carica documenti dello staff
      try {
        const docsRes = await api.get(`/staff/${res.data._id}/documents`);
        setDocumenti(docsRes.data || []);
      } catch {
        setDocumenti([]);
      }
    } catch (err: any) {
      setErrore(err?.response?.data?.message || 'Profilo non trovato. Contatta l\'amministratore.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <section><p>Caricamento profilo...</p></section>;

  if (errore) {
    return (
      <section>
        <h2>👤 Il mio profilo</h2>
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '20px', color: '#92400e' }}>
          ⚠️ {errore}
        </div>
      </section>
    );
  }

  if (!profilo) return null;

  return (
    <section>
      <h2>👤 Il mio profilo</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Visualizza i tuoi dati personali, il contratto e i documenti allegati.
      </p>

      {/* Stato attivo/inattivo */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 16px',
        borderRadius: '20px',
        marginBottom: '24px',
        background: profilo.active ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
        border: `1px solid ${profilo.active ? '#059669' : '#dc2626'}`,
        color: profilo.active ? '#065f46' : '#7f1d1d',
        fontWeight: '700',
        fontSize: '0.9rem',
      }}>
        {profilo.active ? '✅ Collaborazione attiva' : '❌ Collaborazione terminata'}
      </div>

      {/* Dati anagrafici */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1rem' }}>📋 Dati personali</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Nome completo</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{profilo.firstName} {profilo.lastName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Email</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{profilo.email}</div>
          </div>
          {profilo.phone && (
            <div>
              <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Telefono</div>
              <div style={{ fontWeight: '600', color: '#374151' }}>{profilo.phone}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Figura professionale</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{profilo.role}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Categoria</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{categoriaLabel[profilo.category] || profilo.category}</div>
          </div>
        </div>
      </div>

      {/* Periodo collaborazione */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1rem' }}>📅 Periodo di collaborazione</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Data inizio</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{formatData(profilo.dataInizioCollaborazione)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Data fine</div>
            <div style={{ fontWeight: '600', color: profilo.dataFineCollaborazione ? '#dc2626' : '#059669' }}>
              {profilo.dataFineCollaborazione ? formatData(profilo.dataFineCollaborazione) : 'In corso'}
            </div>
          </div>
        </div>
        {profilo.note && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem', color: '#555' }}>
            📝 {profilo.note}
          </div>
        )}
      </div>

      {/* Documenti allegati */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1rem' }}>📎 Documenti e contratto</h3>
        {documenti.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Nessun documento allegato. Contatta l'amministratore.</p>
        ) : (
          <div className="document-list">
            <ul>
              {documenti.map(doc => (
                <li key={doc._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '2px' }}>📄 {doc.name}</div>
                      <div style={{ fontSize: '0.82rem', color: '#888' }}>
                        {doc.tipo && <span style={{ marginRight: '12px' }}>🏷️ {doc.tipo}</span>}
                        📅 {new Date(doc.createdAt).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: '#1e4d8c',
                        color: '#fff',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                      }}
                    >
                      👁️ Visualizza
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

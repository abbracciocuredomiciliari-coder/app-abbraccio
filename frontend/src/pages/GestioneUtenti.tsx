import { useEffect, useState } from 'react';
import api from '../api/api';

interface Utente {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  professione?: string;
  categoria?: string;
  createdAt: string;
  domicilioPartenza?: string;
  raggioAzioneKm?: number;
  domicilioCoords?: { lat: number; lng: number };
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  coordinator: 'Coordinatore',
  caregiver: 'Operatore',
  direttore: 'Direttore Sanitario',
  paziente_registrato: 'Paziente / Caregiver',
};

const statusColors: Record<string, { bg: string; border: string; color: string; label: string }> = {
  pending:  { bg: 'rgba(245,158,11,0.1)',  border: '#f59e0b', color: '#92400e', label: '⏳ In attesa' },
  approved: { bg: 'rgba(5,150,105,0.1)',   border: '#059669', color: '#065f46', label: '✅ Approvato' },
  rejected: { bg: 'rgba(220,38,38,0.1)',   border: '#dc2626', color: '#7f1d1d', label: '❌ Rifiutato' },
};

const categoriaLabels: Record<string, string> = {
  infermieristico: 'Infermieristico',
  oss: 'OSS',
  riabilitativo: 'Riabilitativo',
  medico: 'Medico',
  coordinamento: 'Coordinamento',
  direzione: 'Direzione',
};

function GestioneUtenti() {
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'tutti' | 'pending' | 'approved' | 'rejected'>('pending');
  const [approvandoId, setApprovandoId] = useState<string | null>(null);
  const [roleSelezionato, setRoleSelezionato] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);
  const [conferma, setConferma] = useState<{ msg: string; onSi: () => void } | null>(null);

  const mostraToast = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchUtenti();
  }, []);

  const fetchUtenti = async () => {
    try {
      const res = await api.get('/auth/all-users');
      setUtenti(res.data);
    } catch (err) {
      console.warn('Errore nel caricamento utenti:', err);
    } finally {
      setLoading(false);
    }
  };

  const approvaUtente = async (id: string) => {
    setApprovandoId(id);
    try {
      const role = roleSelezionato[id] || 'caregiver';
      const res = await api.put(`/auth/approve/${id}`, { role });
      setUtenti(utenti.map(u => u._id === id ? { ...u, status: 'approved', role: res.data.user.role } : u));
      mostraToast(`✅ Utente approvato con ruolo: ${roleLabels[role] || role}`, 'ok');
    } catch (err: any) {
      mostraToast(err?.response?.data?.message || 'Errore durante l\'approvazione', 'err');
    } finally {
      setApprovandoId(null);
    }
  };

  const rifiutaUtente = async (id: string) => {
    setConferma({
      msg: 'Sei sicuro di voler rifiutare questa richiesta?',
      onSi: async () => {
        setConferma(null);
        try {
          await api.put(`/auth/reject/${id}`);
          setUtenti(prev => prev.map(u => u._id === id ? { ...u, status: 'rejected' } : u));
          mostraToast('Accesso rifiutato.', 'ok');
        } catch (err: any) {
          mostraToast(err?.response?.data?.message || 'Errore durante il rifiuto', 'err');
        }
      },
    });
  };

  const eliminaUtente = async (id: string) => {
    setConferma({
      msg: 'Sei sicuro di voler eliminare definitivamente questo utente? L\'operazione non è reversibile.',
      onSi: async () => {
        setConferma(null);
        try {
          await api.delete(`/auth/users/${id}`);
          setUtenti(prev => prev.filter(u => u._id !== id));
          mostraToast('Utente eliminato.', 'ok');
        } catch (err: any) {
          mostraToast(err?.response?.data?.message || 'Errore durante l\'eliminazione', 'err');
        }
      },
    });
  };

  const utentiFiltrati = utenti.filter(u => filtro === 'tutti' ? true : u.status === filtro);
  const nPending = utenti.filter(u => u.status === 'pending').length;

  const formatData = (d: string) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <section>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          background: toast.tipo === 'ok' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toast.tipo === 'ok' ? '#059669' : '#dc2626'}`,
          color: toast.tipo === 'ok' ? '#065f46' : '#7f1d1d',
          borderRadius: '10px', padding: '12px 18px', fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: '0.9rem', maxWidth: '340px',
        }}>
          {toast.msg}
        </div>
      )}
      {/* ── Modale conferma ── */}
      {conferma && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <p style={{ margin: '0 0 20px', fontSize: '0.95rem', color: '#374151', lineHeight: 1.5 }}>{conferma.msg}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConferma(null)}
                style={{ background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 18px', cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
                Annulla
              </button>
              <button type="button" onClick={conferma.onSi}
                style={{ background: '#dc2626', border: 'none', borderRadius: '8px', padding: '8px 18px', cursor: 'pointer', fontWeight: 600, color: 'white' }}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
      <h2>👥 Gestione Utenti</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Approva o rifiuta le richieste di registrazione e gestisci gli accessi all'app.
      </p>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(['pending', 'approved', 'rejected', 'tutti'] as const).map((f) => {
          const count = f === 'tutti' ? utenti.length : utenti.filter(u => u.status === f).length;
          const active = filtro === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              style={{
                background: active ? '#1e4d8c' : '#f1f5f9',
                color: active ? '#fff' : '#374151',
                border: `1px solid ${active ? '#1e4d8c' : '#e2e8f0'}`,
                borderRadius: '6px',
                padding: '7px 16px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontWeight: active ? '600' : '400',
                position: 'relative',
              }}
            >
              {f === 'pending' && `⏳ In attesa`}
              {f === 'approved' && `✅ Approvati`}
              {f === 'rejected' && `❌ Rifiutati`}
              {f === 'tutti' && `📋 Tutti`}
              <span style={{
                marginLeft: '6px',
                background: active ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: active ? '#fff' : '#6b7280',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '0.8rem',
                fontWeight: '700',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Alert pending */}
      {nPending > 0 && filtro !== 'pending' && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#92400e', fontWeight: '600', fontSize: '0.9rem' }}>
          ⚠️ Ci sono <strong>{nPending}</strong> richieste in attesa di approvazione.{' '}
          <button type="button" onClick={() => setFiltro('pending')} style={{ background: 'none', border: 'none', color: '#1e4d8c', cursor: 'pointer', fontWeight: '700', textDecoration: 'underline', padding: 0 }}>
            Visualizza →
          </button>
        </div>
      )}

      {loading ? (
        <p>Caricamento...</p>
      ) : utentiFiltrati.length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>Nessun utente in questa categoria.</p>
      ) : (
        <div className="document-list">
          <ul>
            {utentiFiltrati.map((utente) => {
              const st = statusColors[utente.status];
              const isPending = utente.status === 'pending';
              return (
                <li key={utente._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '1rem' }}>{utente.name}</strong>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          background: st.bg,
                          border: `1px solid ${st.border}`,
                          color: st.color,
                        }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <span>📧 {utente.email}</span>
                        {utente.professione && <span>💼 {utente.professione}</span>}
                        {utente.categoria && <span>🏷️ {categoriaLabels[utente.categoria] || utente.categoria}</span>}
                        <span>🔑 {roleLabels[utente.role] || utente.role}</span>
                        <span>📅 {formatData(utente.createdAt)}</span>
                      </div>
                      {/* Domicilio / Zona lavorativa (visibile solo per richieste pending) */}
                      {utente.status === 'pending' && (
                        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.82rem' }}>
                          {utente.domicilioPartenza ? (
                            <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 8px', color: '#065f46' }}>
                              {utente.role === 'paziente_registrato'
                                ? `🏠 Domicilio: ${utente.domicilioPartenza}`
                                : `📍 ${utente.domicilioPartenza} — raggio ${utente.raggioAzioneKm ?? 10} km`}
                              {utente.domicilioCoords && <span style={{ color: '#059669', marginLeft: '4px' }}>✓ geo</span>}
                            </span>
                          ) : (
                            <span style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '2px 8px', color: '#92400e' }}>
                              {utente.role === 'paziente_registrato' ? '⚠️ Domicilio non inserito' : '⚠️ Zona lavorativa non impostata'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {isPending && (
                        <>
                          <select
                            value={roleSelezionato[utente._id] || utente.role || 'caregiver'}
                            onChange={(e) => setRoleSelezionato({ ...roleSelezionato, [utente._id]: e.target.value })}
                            style={{ padding: '6px 10px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '0.85rem' }}
                          >
                            <option value="caregiver">Operatore</option>
                            <option value="coordinator">Coordinatore</option>
                            <option value="direttore">Direttore Sanitario</option>
                            <option value="admin">Admin</option>
                            <option value="paziente_registrato">Paziente / Caregiver</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => approvaUtente(utente._id)}
                            disabled={approvandoId === utente._id}
                            style={{ background: '#059669', fontSize: '0.85rem', padding: '6px 14px', opacity: approvandoId === utente._id ? 0.7 : 1 }}
                          >
                            {approvandoId === utente._id ? '⏳' : '✅ Approva'}
                          </button>
                          <button
                            type="button"
                            onClick={() => rifiutaUtente(utente._id)}
                            style={{ background: '#dc2626', fontSize: '0.85rem', padding: '6px 14px' }}
                          >
                            ❌ Rifiuta
                          </button>
                        </>
                      )}
                      {utente.status === 'rejected' && (
                        <button
                          type="button"
                          onClick={() => approvaUtente(utente._id)}
                          style={{ background: '#059669', fontSize: '0.85rem', padding: '6px 14px' }}
                        >
                          ✅ Approva ora
                        </button>
                      )}
                      {utente.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => rifiutaUtente(utente._id)}
                          style={{ background: '#f59e0b', fontSize: '0.85rem', padding: '6px 14px' }}
                        >
                          🚫 Revoca accesso
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => eliminaUtente(utente._id)}
                        style={{ background: '#6c757d', fontSize: '0.85rem', padding: '6px 14px' }}
                      >
                        🗑️ Elimina
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export default GestioneUtenti;

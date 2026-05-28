import { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

interface CatalogoItem {
  _id: string;
  nome: string;
  categoria: 'presidio' | 'farmaco';
  unitaMisura: string;
  quantitaDisponibile: number;
  dosaggio?: string;
}

interface RichiestaItem {
  supplyId: string;
  nome: string;
  categoria: 'presidio' | 'farmaco';
  unitaMisura: string;
  quantitaRichiesta: number;
  quantitaAutorizzata?: number;
  statoItem: 'in_attesa' | 'autorizzato' | 'rifiutato' | 'parziale';
  noteAdmin?: string;
}

interface Richiesta {
  _id: string;
  operatoreNome: string;
  stato: 'in_attesa' | 'gestita' | 'rifiutata';
  noteOperatore?: string;
  noteAdmin?: string;
  items: RichiestaItem[];
  dataRichiesta: string;
  dataGestione?: string;
  gestitaDa?: string;
}

const statoColori: Record<string, { bg: string; color: string; label: string }> = {
  in_attesa:  { bg: '#fff3cd', color: '#856404', label: '⏳ In attesa' },
  gestita:    { bg: '#d1fae5', color: '#065f46', label: '✅ Gestita' },
  rifiutata:  { bg: '#fee2e2', color: '#7f1d1d', label: '❌ Rifiutata' },
};

const statoItemColori: Record<string, { color: string; label: string }> = {
  in_attesa:  { color: '#856404', label: '⏳ In attesa' },
  autorizzato:{ color: '#065f46', label: '✅ Autorizzato' },
  rifiutato:  { color: '#7f1d1d', label: '❌ Rifiutato' },
  parziale:   { color: '#92400e', label: '⚠️ Parziale' },
};

export default function RichiestaPresidi() {
  const { user } = useAuth();
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [noteOperatore, setNoteOperatore] = useState('');
  const [carrello, setCarrello] = useState<{ item: CatalogoItem; quantita: number }[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<'tutti' | 'presidio' | 'farmaco'>('tutti');
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [catRes, richRes] = await Promise.all([
        api.get('/supply-requests/catalogo'),
        api.get('/supply-requests'),
      ]);
      setCatalogo(catRes.data);
      setRichieste(richRes.data);
    } catch (err) {
      console.error('Errore caricamento richieste presidi:', err);
    } finally {
      setLoading(false);
    }
  };

  const aggiungiAlCarrello = (item: CatalogoItem) => {
    setCarrello(prev => {
      const esistente = prev.find(c => c.item._id === item._id);
      if (esistente) return prev;
      return [...prev, { item, quantita: 1 }];
    });
  };

  const rimuoviDalCarrello = (id: string) => {
    setCarrello(prev => prev.filter(c => c.item._id !== id));
  };

  const aggiornaQuantita = (id: string, q: number) => {
    setCarrello(prev => prev.map(c => c.item._id === id ? { ...c, quantita: Math.max(1, q) } : c));
  };

  const inviaRichiesta = async () => {
    if (carrello.length === 0) { alert('Aggiungi almeno un articolo'); return; }
    setInvio(true);
    try {
      await api.post('/supply-requests', {
        items: carrello.map(c => ({
          supplyId: c.item._id,
          nome: c.item.nome,
          categoria: c.item.categoria,
          unitaMisura: c.item.unitaMisura,
          quantitaRichiesta: c.quantita,
        })),
        noteOperatore,
      });
      setCarrello([]);
      setNoteOperatore('');
      setShowForm(false);
      await fetchAll();
      alert('Richiesta inviata con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nell\'invio della richiesta');
    } finally {
      setInvio(false);
    }
  };

  const eliminaRichiesta = async (id: string) => {
    if (!confirm('Eliminare questa richiesta?')) return;
    try {
      await api.delete(`/supply-requests/${id}`);
      setRichieste(prev => prev.filter(r => r._id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nell\'eliminazione');
    }
  };

  const catalogoFiltrato = catalogo.filter(c =>
    filtroCategoria === 'tutti' || c.categoria === filtroCategoria
  );

  if (loading) return <p style={{ color: '#666' }}>Caricamento...</p>;

  return (
    <div style={{ marginTop: '8px' }}>
      {/* Bottone apri form */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{ background: '#1e4d8c', marginBottom: '16px' }}
        >
          📦 Nuova richiesta presidi/farmaci
        </button>
      )}

      {/* Form nuova richiesta */}
      {showForm && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, color: '#1e4d8c' }}>📦 Nuova richiesta presidi/farmaci</h4>
            <button type="button" onClick={() => { setShowForm(false); setCarrello([]); setNoteOperatore(''); }}
              style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#666' }}>×</button>
          </div>

          {/* Filtro categoria */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {(['tutti', 'presidio', 'farmaco'] as const).map(cat => (
              <button key={cat} type="button" onClick={() => setFiltroCategoria(cat)}
                style={{ background: filtroCategoria === cat ? '#1e4d8c' : '#e2e8f0', color: filtroCategoria === cat ? '#fff' : '#374151', border: 'none', borderRadius: '20px', padding: '5px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>
                {cat === 'tutti' ? '🔍 Tutti' : cat === 'presidio' ? '🏥 Presidi' : '💊 Farmaci'}
              </button>
            ))}
          </div>

          {/* Catalogo */}
          <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '16px' }}>
            {catalogoFiltrato.length === 0 ? (
              <p style={{ padding: '16px', color: '#888', margin: 0 }}>Nessun articolo disponibile.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Articolo</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Tipo</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Disponibile</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600', color: '#374151' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {catalogoFiltrato.map(item => {
                    const inCarrello = carrello.some(c => c.item._id === item._id);
                    return (
                      <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9', background: inCarrello ? 'rgba(30,77,140,0.04)' : 'transparent' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <strong>{item.nome}</strong>
                          {item.dosaggio && <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#888' }}>{item.dosaggio}</span>}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ background: item.categoria === 'farmaco' ? '#ede9fe' : '#e0f2fe', color: item.categoria === 'farmaco' ? '#7c3aed' : '#0369a1', borderRadius: '10px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: '600' }}>
                            {item.categoria === 'farmaco' ? '💊 Farmaco' : '🏥 Presidio'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: item.quantitaDisponibile > 0 ? '#065f46' : '#dc3545', fontWeight: '600' }}>
                          {item.quantitaDisponibile} {item.unitaMisura}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {inCarrello ? (
                            <span style={{ color: '#059669', fontWeight: '600', fontSize: '0.82rem' }}>✅ Aggiunto</span>
                          ) : (
                            <button type="button" onClick={() => aggiungiAlCarrello(item)}
                              style={{ background: '#1e4d8c', padding: '4px 12px', fontSize: '0.82rem' }}>
                              + Aggiungi
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Carrello */}
          {carrello.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '14px' }}>
              <h5 style={{ margin: '0 0 10px', color: '#374151' }}>🛒 Articoli selezionati ({carrello.length})</h5>
              {carrello.map(c => (
                <div key={c.item._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, fontWeight: '600', fontSize: '0.9rem' }}>{c.item.nome}</span>
                  <span style={{ fontSize: '0.82rem', color: '#888' }}>{c.item.unitaMisura}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button type="button" onClick={() => aggiornaQuantita(c.item._id, c.quantita - 1)}
                      style={{ background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: '4px', width: '28px', height: '28px', cursor: 'pointer', fontWeight: '700', fontSize: '1rem' }}>−</button>
                    <input type="number" min="1" value={c.quantita}
                      onChange={e => aggiornaQuantita(c.item._id, parseInt(e.target.value) || 1)}
                      style={{ width: '52px', textAlign: 'center', padding: '4px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '0.9rem' }} />
                    <button type="button" onClick={() => aggiornaQuantita(c.item._id, c.quantita + 1)}
                      style={{ background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: '4px', width: '28px', height: '28px', cursor: 'pointer', fontWeight: '700', fontSize: '1rem' }}>+</button>
                  </div>
                  <button type="button" onClick={() => rimuoviDalCarrello(c.item._id)}
                    style={{ background: '#fee2e2', color: '#dc3545', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem' }}>
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Note operatore */}
          <label style={{ display: 'block', marginBottom: '14px' }}>
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Note per il coordinatore (opzionale)</span>
            <textarea value={noteOperatore} onChange={e => setNoteOperatore(e.target.value)}
              placeholder="Es. urgente, per paziente X..."
              rows={2}
              style={{ width: '100%', marginTop: '4px', padding: '8px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }} />
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={inviaRichiesta} disabled={invio || carrello.length === 0}
              style={{ background: '#059669', padding: '10px 20px', opacity: carrello.length === 0 ? 0.5 : 1 }}>
              {invio ? '⏳ Invio...' : '📤 Invia richiesta'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setCarrello([]); setNoteOperatore(''); }}
              style={{ background: '#6c757d', padding: '10px 20px' }}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Storico richieste */}
      <div>
        <h4 style={{ margin: '0 0 12px', color: '#374151' }}>📋 Le mie richieste ({richieste.length})</h4>
        {richieste.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic' }}>Nessuna richiesta inviata.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {richieste.map(r => {
              const sc = statoColori[r.stato] || statoColori.in_attesa;
              return (
                <div key={r._id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  {/* Header richiesta */}
                  <div style={{ background: '#f8fafc', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1e4d8c' }}>
                        📅 {new Date(r.dataRichiesta).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      {r.noteOperatore && (
                        <span style={{ marginLeft: '10px', fontSize: '0.82rem', color: '#666' }}>📝 {r.noteOperatore}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}`, borderRadius: '20px', padding: '3px 12px', fontSize: '0.82rem', fontWeight: '700' }}>
                        {sc.label}
                      </span>
                      {r.stato === 'in_attesa' && (
                        <button type="button" onClick={() => eliminaRichiesta(r._id)}
                          style={{ background: '#fee2e2', color: '#dc3545', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                          🗑️ Elimina
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ padding: '12px 16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left', color: '#555', fontWeight: '600' }}>Articolo</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: '#555', fontWeight: '600' }}>Richiesto</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: '#555', fontWeight: '600' }}>Autorizzato</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', color: '#555', fontWeight: '600' }}>Stato</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', color: '#555', fontWeight: '600' }}>Note admin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.items.map((item, idx) => {
                          const sc2 = statoItemColori[item.statoItem] || statoItemColori.in_attesa;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '7px 8px' }}>
                                <strong>{item.nome}</strong>
                                <span style={{ marginLeft: '6px', fontSize: '0.78rem', background: item.categoria === 'farmaco' ? '#ede9fe' : '#e0f2fe', color: item.categoria === 'farmaco' ? '#7c3aed' : '#0369a1', borderRadius: '8px', padding: '1px 6px' }}>
                                  {item.categoria === 'farmaco' ? '💊' : '🏥'}
                                </span>
                              </td>
                              <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: '600' }}>
                                {item.quantitaRichiesta} {item.unitaMisura}
                              </td>
                              <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: '600', color: item.quantitaAutorizzata !== undefined ? '#065f46' : '#888' }}>
                                {item.quantitaAutorizzata !== undefined ? `${item.quantitaAutorizzata} ${item.unitaMisura}` : '—'}
                              </td>
                              <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                                <span style={{ color: sc2.color, fontWeight: '600', fontSize: '0.82rem' }}>{sc2.label}</span>
                              </td>
                              <td style={{ padding: '7px 8px', color: '#666', fontSize: '0.82rem' }}>
                                {item.noteAdmin || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Note admin globali */}
                    {r.stato !== 'in_attesa' && (
                      <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#555' }}>
                        {r.noteAdmin && <p style={{ margin: '4px 0' }}>📝 <strong>Note coordinatore:</strong> {r.noteAdmin}</p>}
                        {r.gestitaDa && <p style={{ margin: '4px 0', color: '#888' }}>
                          Gestita da <strong>{r.gestitaDa}</strong>
                          {r.dataGestione && ` il ${new Date(r.dataGestione).toLocaleDateString('it-IT')}`}
                        </p>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

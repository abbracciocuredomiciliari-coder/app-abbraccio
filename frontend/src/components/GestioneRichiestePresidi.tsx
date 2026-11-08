// Componente per la gestione delle richieste presidi/farmaci dagli operatori
import { useState, useEffect } from 'react';
import api from '../api/api';

interface RichiestaItem {
  supplyId: string;
  nome: string;
  categoria: 'presidio' | 'farmaco';
  unitaMisura: string;
  quantitaRichiesta: number;
  quantitaAutorizzata?: number;
  quantitaConsegnata?: number;
  statoItem: 'in_attesa' | 'autorizzato' | 'rifiutato' | 'parziale';
  noteAdmin?: string;
}

interface Richiesta {
  _id: string;
  operatoreId: string;
  operatoreNome: string;
  stato: 'in_attesa' | 'gestita' | 'rifiutata' | 'consegnata';
  noteOperatore?: string;
  noteAdmin?: string;
  items: RichiestaItem[];
  dataRichiesta: string;
  dataGestione?: string;
  gestitaDa?: string;
  dataConsegna?: string;
  consegnataDa?: string;
}

const statoColori: Record<string, { bg: string; color: string; label: string }> = {
  in_attesa:  { bg: '#fff3cd', color: '#856404', label: '⏳ In attesa' },
  gestita:    { bg: '#d1fae5', color: '#065f46', label: '✅ Gestita' },
  rifiutata:  { bg: '#fee2e2', color: '#7f1d1d', label: '❌ Rifiutata' },
  consegnata: { bg: '#e0f2fe', color: '#0369a1', label: '🚚 Consegnata' },
};

const STATI_ITEM = [
  { value: 'autorizzato', label: '✅ Autorizzato', color: '#059669' },
  { value: 'parziale',    label: '⚠️ Parziale',    color: '#d97706' },
  { value: 'rifiutato',   label: '❌ Rifiutato',   color: '#dc2626' },
];

export default function GestioneRichiestePresidi() {
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStato, setFiltroStato] = useState<'tutti' | 'in_attesa' | 'gestita' | 'rifiutata'>('in_attesa');
  const [richiestaInGestione, setRichiestaInGestione] = useState<string | null>(null);
  const [itemsGestione, setItemsGestione] = useState<Record<string, { quantitaAutorizzata: number; statoItem: string; noteAdmin: string }>>({});
  const [noteAdminGlobale, setNoteAdminGlobale] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [consegnando, setConsegnando] = useState<string | null>(null);
  const [consegnaParzialeId, setConsegnaParzialeId] = useState<string | null>(null);
  const [itemsConsegna, setItemsConsegna] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchRichieste();
  }, []);

  const fetchRichieste = async () => {
    setLoading(true);
    try {
      const res = await api.get('/supply-requests');
      setRichieste(res.data);
    } catch (err) {
      console.error('Errore caricamento richieste:', err);
    } finally {
      setLoading(false);
    }
  };

  const apriGestione = (richiesta: Richiesta) => {
    setRichiestaInGestione(richiesta._id);
    setNoteAdminGlobale(richiesta.noteAdmin || '');
    // Inizializza lo stato di ogni item
    const init: Record<string, { quantitaAutorizzata: number; statoItem: string; noteAdmin: string }> = {};
    richiesta.items.forEach(item => {
      init[item.supplyId] = {
        quantitaAutorizzata: item.quantitaAutorizzata ?? item.quantitaRichiesta,
        statoItem: item.statoItem === 'in_attesa' ? 'autorizzato' : item.statoItem,
        noteAdmin: item.noteAdmin || '',
      };
    });
    setItemsGestione(init);
  };

  const chiudiGestione = () => {
    setRichiestaInGestione(null);
    setItemsGestione({});
    setNoteAdminGlobale('');
  };

  const aggiornaItem = (supplyId: string, campo: string, valore: any) => {
    setItemsGestione(prev => ({
      ...prev,
      [supplyId]: { ...prev[supplyId], [campo]: valore },
    }));
  };

  const salvaGestione = async (richiestaId: string) => {
    setSalvando(true);
    try {
      const richiesta = richieste.find(r => r._id === richiestaId);
      if (!richiesta) return;

      const items = richiesta.items.map(item => ({
        supplyId: item.supplyId,
        quantitaAutorizzata: itemsGestione[item.supplyId]?.quantitaAutorizzata ?? 0,
        statoItem: itemsGestione[item.supplyId]?.statoItem || 'rifiutato',
        noteAdmin: itemsGestione[item.supplyId]?.noteAdmin || '',
      }));

      const res = await api.patch(`/supply-requests/${richiestaId}/gestisci`, {
        items,
        noteAdmin: noteAdminGlobale,
      });

      setRichieste(prev => prev.map(r => r._id === richiestaId ? res.data : r));
      chiudiGestione();
      alert('Richiesta gestita con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  };

  const segnaComeConsegnata = async (richiestaId: string) => {
    if (!confirm('Segnare come consegnata? Verrà effettuato lo scarico automatico dal magazzino.')) return;
    setConsegnando(richiestaId);
    try {
      const res = await api.patch(`/supply-requests/${richiestaId}/consegna`, {});
      setRichieste(prev => prev.map(r => r._id === richiestaId ? res.data : r));
      alert('Consegna registrata! Il magazzino è stato aggiornato.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella registrazione della consegna');
    } finally {
      setConsegnando(null);
    }
  };

  const apriConsegnaParziale = (richiesta: Richiesta) => {
    setConsegnaParzialeId(richiesta._id);
    const init: Record<string, number> = {};
    richiesta.items.forEach(item => {
      if (item.statoItem === 'autorizzato' || item.statoItem === 'parziale') {
        init[item.supplyId] = (item.quantitaAutorizzata ?? 0) - (item.quantitaConsegnata ?? 0);
      }
    });
    setItemsConsegna(init);
  };

  const salvaConsegnaParziale = async (richiestaId: string) => {
    setConsegnando(richiestaId);
    try {
      const items = Object.entries(itemsConsegna)
        .map(([supplyId, quantita]) => ({ supplyId, quantita }))
        .filter(i => i.quantita > 0);
      if (items.length === 0) {
        alert('Indicare almeno una quantità da consegnare');
        return;
      }
      const res = await api.patch(`/supply-requests/${richiestaId}/consegna-parziale`, { items });
      setRichieste(prev => prev.map(r => r._id === richiestaId ? res.data : r));
      setConsegnaParzialeId(null);
      setItemsConsegna({});
      alert('Consegna parziale registrata! Il magazzino è stato aggiornato.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella consegna parziale');
    } finally {
      setConsegnando(null);
    }
  };

  const registraReso = async (richiestaId: string, item: RichiestaItem) => {
    const max = item.quantitaConsegnata ?? 0;
    if (max <= 0) {
      alert('Nessuna quantità consegnata da restituire per questo articolo');
      return;
    }
    const input = prompt(`Quantità da restituire di "${item.nome}" (consegnati: ${max})?`, String(max));
    if (input === null) return;
    const quantita = parseInt(input) || 0;
    if (quantita <= 0 || quantita > max) {
      alert(`Quantità non valida (1-${max})`);
      return;
    }
    const motivo = prompt('Motivo del reso (opzionale):') || '';
    try {
      const res = await api.post(`/supply-requests/${richiestaId}/reso`, { supplyId: item.supplyId, quantita, motivo });
      setRichieste(prev => prev.map(r => r._id === richiestaId ? res.data : r));
      alert('Reso registrato! Il materiale è rientrato a magazzino.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella registrazione del reso');
    }
  };

  const richiesteFiltrate = richieste.filter(r =>
    filtroStato === 'tutti' || r.stato === filtroStato
  );

  const countInAttesa = richieste.filter(r => r.stato === 'in_attesa').length;

  if (loading) return <p style={{ color: '#666' }}>Caricamento richieste...</p>;

  return (
    <div>
      {/* Filtri stato */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['in_attesa', 'tutti', 'gestita', 'rifiutata'] as const).map(stato => {
          const sc = stato === 'tutti'
            ? { bg: '#f1f5f9', color: '#374151', label: `🔍 Tutte (${richieste.length})` }
            : { ...statoColori[stato], label: `${statoColori[stato].label} (${richieste.filter(r => r.stato === stato).length})` };
          return (
            <button key={stato} type="button" onClick={() => setFiltroStato(stato)}
              style={{
                background: filtroStato === stato ? sc.color : '#f1f5f9',
                color: filtroStato === stato ? '#fff' : '#374151',
                border: `1px solid ${sc.color}`,
                borderRadius: '20px', padding: '5px 14px', cursor: 'pointer',
                fontWeight: '600', fontSize: '0.85rem',
              }}>
              {sc.label}
            </button>
          );
        })}
        <button type="button" onClick={fetchRichieste}
          style={{ background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: '20px', padding: '5px 14px', cursor: 'pointer', fontSize: '0.85rem' }}>
          🔄 Aggiorna
        </button>
      </div>

      {countInAttesa > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', color: '#856404', fontWeight: '600' }}>
          ⏳ {countInAttesa} richiesta{countInAttesa > 1 ? 'e' : ''} in attesa di gestione
        </div>
      )}

      {richiesteFiltrate.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic' }}>Nessuna richiesta trovata.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {richiesteFiltrate.map(r => {
            const sc = statoColori[r.stato] || statoColori.in_attesa;
            const isInGestione = richiestaInGestione === r._id;
            return (
              <div key={r._id} style={{ border: `1px solid ${r.stato === 'in_attesa' ? '#ffc107' : '#e2e8f0'}`, borderRadius: '8px', overflow: 'hidden', boxShadow: r.stato === 'in_attesa' ? '0 0 0 2px rgba(255,193,7,0.2)' : 'none' }}>
                {/* Header */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1e4d8c' }}>
                      👤 {r.operatoreNome}
                    </span>
                    <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: '#666' }}>
                      📅 {new Date(r.dataRichiesta).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {r.noteOperatore && (
                      <span style={{ marginLeft: '10px', fontSize: '0.82rem', color: '#666' }}>📝 {r.noteOperatore}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}`, borderRadius: '20px', padding: '3px 12px', fontSize: '0.82rem', fontWeight: '700' }}>
                      {sc.label}
                    </span>
                    {r.stato === 'in_attesa' && !isInGestione && (
                      <button type="button" onClick={() => apriGestione(r)}
                        style={{ background: '#1e4d8c', padding: '6px 14px', fontSize: '0.85rem' }}>
                        ✏️ Gestisci
                      </button>
                    )}
                    {r.stato === 'gestita' && (
                      <>
                        <button type="button" onClick={() => segnaComeConsegnata(r._id)}
                          disabled={consegnando === r._id}
                          style={{ background: '#0369a1', padding: '6px 14px', fontSize: '0.85rem', opacity: consegnando === r._id ? 0.6 : 1 }}>
                          {consegnando === r._id && consegnaParzialeId !== r._id ? '⏳...' : '🚚 Consegna tutto'}
                        </button>
                        <button type="button" onClick={() => consegnaParzialeId === r._id ? setConsegnaParzialeId(null) : apriConsegnaParziale(r)}
                          style={{ background: '#d97706', padding: '6px 14px', fontSize: '0.85rem' }}>
                          📦 Consegna parziale
                        </button>
                      </>
                    )}
                    {isInGestione && (
                      <button type="button" onClick={chiudiGestione}
                        style={{ background: '#6c757d', padding: '6px 14px', fontSize: '0.85rem' }}>
                        ✕ Annulla
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabella items */}
                <div style={{ padding: '12px 16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '7px 8px', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Articolo</th>
                        <th style={{ padding: '7px 8px', textAlign: 'center', color: '#374151', fontWeight: '700' }}>Richiesto</th>
                        {isInGestione ? (
                          <>
                            <th style={{ padding: '7px 8px', textAlign: 'center', color: '#374151', fontWeight: '700' }}>Qtà autorizzata</th>
                            <th style={{ padding: '7px 8px', textAlign: 'center', color: '#374151', fontWeight: '700' }}>Decisione</th>
                            <th style={{ padding: '7px 8px', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Note</th>
                          </>
                        ) : (
                          <>
                            <th style={{ padding: '7px 8px', textAlign: 'center', color: '#374151', fontWeight: '700' }}>Autorizzato</th>
                            <th style={{ padding: '7px 8px', textAlign: 'center', color: '#374151', fontWeight: '700' }}>Stato</th>
                            <th style={{ padding: '7px 8px', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Note</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 8px' }}>
                            <strong>{item.nome}</strong>
                            <span style={{ marginLeft: '6px', fontSize: '0.78rem', background: item.categoria === 'farmaco' ? '#ede9fe' : '#e0f2fe', color: item.categoria === 'farmaco' ? '#7c3aed' : '#0369a1', borderRadius: '8px', padding: '1px 6px' }}>
                              {item.categoria === 'farmaco' ? '💊' : '🏥'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: '700', color: '#1e4d8c' }}>
                            {item.quantitaRichiesta} {item.unitaMisura}
                          </td>

                          {isInGestione ? (
                            <>
                              <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.quantitaRichiesta}
                                  value={itemsGestione[item.supplyId]?.quantitaAutorizzata ?? item.quantitaRichiesta}
                                  onChange={e => aggiornaItem(item.supplyId, 'quantitaAutorizzata', parseInt(e.target.value) || 0)}
                                  style={{ width: '70px', textAlign: 'center', padding: '5px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '0.9rem' }}
                                />
                                <span style={{ marginLeft: '4px', fontSize: '0.8rem', color: '#888' }}>{item.unitaMisura}</span>
                              </td>
                              <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                <select
                                  value={itemsGestione[item.supplyId]?.statoItem || 'autorizzato'}
                                  onChange={e => aggiornaItem(item.supplyId, 'statoItem', e.target.value)}
                                  style={{ padding: '5px 8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' }}
                                >
                                  {STATI_ITEM.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: '8px 8px' }}>
                                <input
                                  type="text"
                                  value={itemsGestione[item.supplyId]?.noteAdmin || ''}
                                  onChange={e => aggiornaItem(item.supplyId, 'noteAdmin', e.target.value)}
                                  placeholder="Note per l'operatore..."
                                  style={{ width: '100%', padding: '5px 8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: '600', color: item.quantitaAutorizzata !== undefined ? '#065f46' : '#888' }}>
                                {item.quantitaAutorizzata !== undefined ? `${item.quantitaAutorizzata} ${item.unitaMisura}` : '—'}
                                {(item.quantitaConsegnata ?? 0) > 0 && (
                                  <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: '700' }}>
                                    consegnati {item.quantitaConsegnata}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                {item.statoItem === 'in_attesa' ? (
                                  <span style={{ color: '#856404', fontWeight: '600', fontSize: '0.82rem' }}>⏳ In attesa</span>
                                ) : item.statoItem === 'autorizzato' ? (
                                  <span style={{ color: '#065f46', fontWeight: '600', fontSize: '0.82rem' }}>✅ Autorizzato</span>
                                ) : item.statoItem === 'parziale' ? (
                                  <span style={{ color: '#92400e', fontWeight: '600', fontSize: '0.82rem' }}>⚠️ Parziale</span>
                                ) : (
                                  <span style={{ color: '#7f1d1d', fontWeight: '600', fontSize: '0.82rem' }}>❌ Rifiutato</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 8px', color: '#666', fontSize: '0.82rem' }}>
                                {item.noteAdmin || '—'}
                                {(item.quantitaConsegnata ?? 0) > 0 && (
                                  <button type="button" onClick={() => registraReso(r._id, item)}
                                    style={{ marginLeft: '8px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1px 8px', fontSize: '0.75rem', cursor: 'pointer', color: '#475569' }}>
                                    ↩ Reso
                                  </button>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Form gestione globale */}
                  {isInGestione && (
                    <div style={{ marginTop: '16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '14px' }}>
                      <label style={{ display: 'block', marginBottom: '12px' }}>
                        <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#0369a1' }}>📝 Note generali per l'operatore (opzionale)</span>
                        <textarea
                          value={noteAdminGlobale}
                          onChange={e => setNoteAdminGlobale(e.target.value)}
                          placeholder="Es. Alcuni articoli non disponibili, contattare per alternative..."
                          rows={2}
                          style={{ width: '100%', marginTop: '6px', padding: '8px', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                      </label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => salvaGestione(r._id)} disabled={salvando}
                          style={{ background: '#059669', padding: '10px 20px', fontWeight: '700' }}>
                          {salvando ? '⏳ Salvataggio...' : '✅ Conferma gestione'}
                        </button>
                        <button type="button" onClick={chiudiGestione}
                          style={{ background: '#6c757d', padding: '10px 20px' }}>
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Consegna parziale: quantità da consegnare ora per ogni articolo */}
                  {consegnaParzialeId === r._id && (
                    <div style={{ marginTop: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px' }}>
                      <p style={{ margin: '0 0 10px', fontWeight: '700', fontSize: '0.9rem', color: '#92400e' }}>
                        📦 Consegna parziale — indica quanto consegni ORA (il resto resta da consegnare)
                      </p>
                      {r.items.filter(i => i.statoItem === 'autorizzato' || i.statoItem === 'parziale').map(item => {
                        const residuo = (item.quantitaAutorizzata ?? 0) - (item.quantitaConsegnata ?? 0);
                        return (
                          <div key={item.supplyId} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span style={{ minWidth: '160px', fontSize: '0.87rem' }}>{item.nome}</span>
                            <input
                              type="number" min="0" max={residuo}
                              value={itemsConsegna[item.supplyId] ?? residuo}
                              onChange={e => setItemsConsegna(prev => ({ ...prev, [item.supplyId]: Math.min(parseInt(e.target.value) || 0, residuo) }))}
                              style={{ width: '70px', textAlign: 'center', padding: '5px', border: '1px solid #fcd34d', borderRadius: '4px', fontSize: '0.9rem' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: '#888' }}>/ residui {residuo} {item.unitaMisura}</span>
                          </div>
                        );
                      })}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button type="button" onClick={() => salvaConsegnaParziale(r._id)} disabled={consegnando === r._id}
                          style={{ background: '#d97706', padding: '8px 18px', fontWeight: '700' }}>
                          {consegnando === r._id ? '⏳...' : '✅ Registra consegna parziale'}
                        </button>
                        <button type="button" onClick={() => setConsegnaParzialeId(null)}
                          style={{ background: '#6c757d', padding: '8px 18px' }}>
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Info gestione completata */}
                  {r.stato !== 'in_attesa' && (
                    <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#555', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                      {r.noteAdmin && <p style={{ margin: '0 0 4px' }}>📝 <strong>Note:</strong> {r.noteAdmin}</p>}
                      {r.gestitaDa && (
                        <p style={{ margin: 0, color: '#888' }}>
                          Gestita da <strong>{r.gestitaDa}</strong>
                          {r.dataGestione && ` il ${new Date(r.dataGestione).toLocaleDateString('it-IT')}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

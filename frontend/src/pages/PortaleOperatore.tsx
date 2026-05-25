import { useEffect, useState, useRef } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

interface Paziente {
  _id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  address?: string;
  contactPhone?: string;
  assistanceNeeds?: string;
  pianiAssegnati?: number;
}

interface Piano {
  _id: string;
  type: string;
  category: string;
  task: string;
  notes?: string;
  date: string;
  dataFine?: string;
  status: string;
  tipoCompenso?: string;
  tariffa?: number;
  compensoTotale?: number;
  compensoPagato?: boolean;
  patient: { _id: string; firstName: string; lastName: string };
  staff: { _id: string; firstName: string; lastName: string; role: string };
}

interface Accesso {
  _id: string;
  staffName: string;
  staffRole: string;
  oraEntrata: string;
  oraUscita?: string;
  note?: string;
  firmaLogin: string;
  durataMinuti: number;
  compensoMaturato: number;
}

interface Obiettivo {
  _id: string;
  descrizione: string;
  stato: string;
  dataInizio: string;
  dataRivalutazione?: string;
}

const statoObiettivoBadge: Record<string, { bg: string; color: string; label: string }> = {
  attivo:         { bg: 'rgba(30,77,140,0.1)',  color: '#1e4d8c', label: '🎯 Attivo' },
  raggiunto:      { bg: 'rgba(5,150,105,0.1)',  color: '#065f46', label: '✅ Raggiunto' },
  parziale:       { bg: 'rgba(245,158,11,0.1)', color: '#92400e', label: '⚠️ Parziale' },
  non_raggiunto:  { bg: 'rgba(220,38,38,0.1)',  color: '#7f1d1d', label: '❌ Non raggiunto' },
  rivalutato:     { bg: 'rgba(107,114,128,0.1)',color: '#374151', label: '🔄 Rivalutato' },
};

function formatDurata(min: number) {
  if (!min) return '—';
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function formatData(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatOra(d: string) {
  return new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function PortaleOperatore() {
  const { user } = useAuth();
  const [pazienti, setPazienti] = useState<Paziente[]>([]);
  const [pazienteSelezionato, setPazienteSelezionato] = useState<Paziente | null>(null);
  const [piani, setPiani] = useState<Piano[]>([]);
  const [pianoSelezionato, setPianoSelezionato] = useState<Piano | null>(null);
  const [accessi, setAccessi] = useState<Accesso[]>([]);
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([]);
  const [riepilogo, setRiepilogo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPiano, setLoadingPiano] = useState(false);
  const [registrandoAccesso, setRegistrandoAccesso] = useState(false);
  const [noteAccesso, setNoteAccesso] = useState('');
  const [accessoAperto, setAccessoAperto] = useState<Accesso | null>(null);

  // Export PDF
  const [showExport, setShowExport] = useState(false);
  const [exportDaData, setExportDaData] = useState('');
  const [exportAData, setExportAData] = useState('');
  const [exportData, setExportData] = useState<any>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPazienti();
  }, []);

  const fetchPazienti = async () => {
    try {
      const res = await api.get('/workplan/miei-pazienti');
      setPazienti(res.data);
    } catch (err) {
      console.warn('Errore caricamento pazienti:', err);
    } finally {
      setLoading(false);
    }
  };

  const selezionaPaziente = async (paz: Paziente) => {
    setPazienteSelezionato(paz);
    setPianoSelezionato(null);
    setAccessi([]);
    setObiettivi([]);
    setRiepilogo(null);
    try {
      const res = await api.get('/workplan');
      const pianiPaz = res.data.filter((p: Piano) => p.patient?._id === paz._id);
      setPiani(pianiPaz);
    } catch (err) {
      console.warn('Errore caricamento piani:', err);
    }
  };

  const selezionaPiano = async (piano: Piano) => {
    setPianoSelezionato(piano);
    setLoadingPiano(true);
    setShowExport(false);
    setExportData(null);
    try {
      const [accessiRes, obiettiviRes] = await Promise.all([
        api.get(`/workplan/${piano._id}/accessi`),
        api.get(`/obiettivi?workPlanId=${piano._id}`).catch(() => ({ data: [] })),
      ]);
      setAccessi(accessiRes.data.accessi || []);
      setRiepilogo(accessiRes.data.riepilogo || null);
      setObiettivi(obiettiviRes.data || []);

      // Controlla se c'è un accesso aperto (senza oraUscita) dell'utente corrente
      const aperto = (accessiRes.data.accessi || []).find(
        (a: Accesso) => !a.oraUscita && a.firmaLogin === user?.name
      );
      setAccessoAperto(aperto || null);
    } catch (err) {
      console.warn('Errore caricamento dettagli piano:', err);
    } finally {
      setLoadingPiano(false);
    }
  };

  const registraEntrata = async () => {
    if (!pianoSelezionato) return;
    setRegistrandoAccesso(true);
    try {
      await api.post(`/workplan-access/${pianoSelezionato._id}/entrata`, {
        note: noteAccesso,
      });
      setNoteAccesso('');
      await selezionaPiano(pianoSelezionato);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella registrazione entrata');
    } finally {
      setRegistrandoAccesso(false);
    }
  };

  const registraUscita = async () => {
    if (!pianoSelezionato || !accessoAperto) return;
    setRegistrandoAccesso(true);
    try {
      await api.post(`/workplan-access/${pianoSelezionato._id}/uscita`, {
        accessoId: accessoAperto._id,
        note: noteAccesso,
      });
      setNoteAccesso('');
      await selezionaPiano(pianoSelezionato);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella registrazione uscita');
    } finally {
      setRegistrandoAccesso(false);
    }
  };

  const caricaExport = async () => {
    if (!pianoSelezionato) return;
    setLoadingExport(true);
    try {
      const params: any = {};
      if (exportDaData) params.dataInizio = exportDaData;
      if (exportAData) params.dataFine = exportAData;
      const res = await api.get(`/workplan/${pianoSelezionato._id}/accessi/export`, { params });
      setExportData(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel caricamento export');
    } finally {
      setLoadingExport(false);
    }
  };

  const stampaPDF = () => {
    if (!printRef.current) return;
    const contenuto = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Registro Accessi</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 20px; }
        h1 { font-size: 18px; color: #1e4d8c; margin-bottom: 4px; }
        h2 { font-size: 14px; color: #444; margin: 0 0 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #1e4d8c; color: #fff; padding: 8px; text-align: left; font-size: 11px; }
        td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tr:nth-child(even) td { background: #f8fafc; }
        .riepilogo { margin-top: 20px; background: #f1f5f9; padding: 12px; border-radius: 6px; }
        .riepilogo p { margin: 4px 0; }
        @media print { body { margin: 0; } }
      </style></head><body>${contenuto}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (loading) return <section><p>Caricamento...</p></section>;

  return (
    <section>
      <h2>🏥 Il mio Piano di Lavoro</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Seleziona un paziente per visualizzare i piani assegnati e registrare gli accessi.
      </p>

      {/* Dropdown pazienti */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>
          👤 Pazienti assegnati ({pazienti.length})
        </label>
        {pazienti.length === 0 ? (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px', color: '#92400e' }}>
            ⚠️ Nessun paziente assegnato. Contatta il coordinatore.
          </div>
        ) : (
          <select
            value={pazienteSelezionato?._id || ''}
            onChange={(e) => {
              const paz = pazienti.find(p => p._id === e.target.value);
              if (paz) selezionaPaziente(paz);
            }}
            style={{ width: '100%', maxWidth: '480px', padding: '10px 14px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '1rem' }}
          >
            <option value="">— Seleziona paziente —</option>
            {pazienti.map(p => (
              <option key={p._id} value={p._id}>
                {p.firstName} {p.lastName} {p.pianiAssegnati ? `(${p.pianiAssegnati} piani)` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Info paziente selezionato */}
      {pazienteSelezionato && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <strong>📋 {pazienteSelezionato.firstName} {pazienteSelezionato.lastName}</strong>
          <div style={{ fontSize: '0.88rem', color: '#555', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {pazienteSelezionato.address && <span>📍 {pazienteSelezionato.address}</span>}
            {pazienteSelezionato.contactPhone && <span>📞 {pazienteSelezionato.contactPhone}</span>}
            {pazienteSelezionato.assistanceNeeds && <span>🩺 {pazienteSelezionato.assistanceNeeds}</span>}
          </div>
        </div>
      )}

      {/* Lista piani del paziente */}
      {pazienteSelezionato && piani.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>
            📋 Piani di lavoro ({piani.length})
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {piani.map(piano => (
              <button
                key={piano._id}
                type="button"
                onClick={() => selezionaPiano(piano)}
                style={{
                  background: pianoSelezionato?._id === piano._id ? '#1e4d8c' : '#f1f5f9',
                  color: pianoSelezionato?._id === piano._id ? '#fff' : '#374151',
                  border: `1px solid ${pianoSelezionato?._id === piano._id ? '#1e4d8c' : '#e2e8f0'}`,
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: '600' }}>{piano.category}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  {formatData(piano.date)}{piano.dataFine ? ` → ${formatData(piano.dataFine)}` : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dettaglio piano selezionato */}
      {pianoSelezionato && (
        <div>
          {loadingPiano ? (
            <p>Caricamento piano...</p>
          ) : (
            <>
              {/* Info piano */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 8px', color: '#1e4d8c' }}>📋 {pianoSelezionato.category}</h3>
                <p style={{ margin: '0 0 8px', color: '#374151' }}>{pianoSelezionato.task}</p>
                {pianoSelezionato.notes && <p style={{ margin: '0', color: '#666', fontSize: '0.9rem' }}>📝 {pianoSelezionato.notes}</p>}
              </div>

              {/* Obiettivi (sola lettura) */}
              {obiettivi.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#374151' }}>🎯 Obiettivi del piano</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {obiettivi.map(ob => {
                      const badge = statoObiettivoBadge[ob.stato] || statoObiettivoBadge.attivo;
                      return (
                        <div key={ob._id} style={{ background: badge.bg, border: `1px solid ${badge.color}30`, borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ color: '#374151', fontSize: '0.9rem' }}>{ob.descrizione}</span>
                          <span style={{ color: badge.color, fontWeight: '600', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{badge.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Compenso (sola lettura) */}
              {riepilogo && pianoSelezionato.tipoCompenso && pianoSelezionato.tipoCompenso !== 'nessuno' && (
                <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#065f46' }}>💰 Riepilogo compenso</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.9rem', color: '#374151' }}>
                    <span>📊 Tipo: <strong>{pianoSelezionato.tipoCompenso === 'orario' ? 'Orario' : 'Fisso per accesso'}</strong></span>
                    <span>💵 Tariffa: <strong>€ {pianoSelezionato.tariffa?.toFixed(2) || '0.00'}</strong></span>
                    <span>🕐 Ore totali: <strong>{formatDurata(riepilogo.minutiTotali)}</strong></span>
                    <span>✅ Accessi completati: <strong>{riepilogo.accessiCompletati}</strong></span>
                    <span>💰 Compenso maturato: <strong style={{ color: '#059669' }}>€ {riepilogo.compensoCalcolato?.toFixed(2) || '0.00'}</strong></span>
                    {pianoSelezionato.compensoPagato && <span style={{ color: '#059669', fontWeight: '700' }}>✅ Pagato</span>}
                  </div>
                </div>
              )}

              {/* Registrazione accesso */}
              <div style={{ background: accessoAperto ? 'rgba(5,150,105,0.06)' : 'rgba(30,77,140,0.04)', border: `1px solid ${accessoAperto ? 'rgba(5,150,105,0.3)' : 'rgba(30,77,140,0.2)'}`, borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px', color: accessoAperto ? '#065f46' : '#1e4d8c' }}>
                  {accessoAperto ? '🟢 Accesso in corso' : '🔵 Registra accesso'}
                </h4>
                {accessoAperto && (
                  <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#374151' }}>
                    Entrata: <strong>{formatOra(accessoAperto.oraEntrata)}</strong> del <strong>{formatData(accessoAperto.oraEntrata)}</strong>
                  </p>
                )}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <label style={{ flex: 1, minWidth: '200px' }}>
                    Note (opzionale)
                    <input
                      value={noteAccesso}
                      onChange={e => setNoteAccesso(e.target.value)}
                      placeholder="Es. parametri rilevati, attività svolte..."
                      style={{ marginTop: '4px' }}
                    />
                  </label>
                  {!accessoAperto ? (
                    <button
                      type="button"
                      onClick={registraEntrata}
                      disabled={registrandoAccesso}
                      style={{ background: '#1e4d8c', padding: '10px 20px', whiteSpace: 'nowrap' }}
                    >
                      {registrandoAccesso ? '⏳' : '▶️ Registra entrata'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={registraUscita}
                      disabled={registrandoAccesso}
                      style={{ background: '#059669', padding: '10px 20px', whiteSpace: 'nowrap' }}
                    >
                      {registrandoAccesso ? '⏳' : '⏹️ Registra uscita'}
                    </button>
                  )}
                </div>
              </div>

              {/* Storico accessi */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ margin: 0, color: '#374151' }}>📅 Storico accessi ({accessi.length})</h4>
                  <button
                    type="button"
                    onClick={() => setShowExport(!showExport)}
                    style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', padding: '6px 14px', fontSize: '0.85rem' }}
                  >
                    📄 Esporta / Stampa PDF
                  </button>
                </div>

                {/* Export PDF */}
                {showExport && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                    <h5 style={{ margin: '0 0 12px', color: '#374151' }}>📄 Esporta registro accessi</h5>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
                      <label style={{ flex: 1, minWidth: '140px' }}>
                        Da data
                        <input type="date" value={exportDaData} onChange={e => setExportDaData(e.target.value)} style={{ marginTop: '4px' }} />
                      </label>
                      <label style={{ flex: 1, minWidth: '140px' }}>
                        A data
                        <input type="date" value={exportAData} onChange={e => setExportAData(e.target.value)} style={{ marginTop: '4px' }} />
                      </label>
                      <button
                        type="button"
                        onClick={caricaExport}
                        disabled={loadingExport}
                        style={{ background: '#1e4d8c', padding: '10px 18px', whiteSpace: 'nowrap' }}
                      >
                        {loadingExport ? '⏳' : '🔍 Carica'}
                      </button>
                      {exportData && (
                        <button
                          type="button"
                          onClick={stampaPDF}
                          style={{ background: '#059669', padding: '10px 18px', whiteSpace: 'nowrap' }}
                        >
                          🖨️ Stampa PDF
                        </button>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#888' }}>
                      Lascia vuoto per il mese corrente
                    </p>

                    {/* Anteprima export */}
                    {exportData && (
                      <div ref={printRef} style={{ marginTop: '16px' }}>
                        <h1>Registro Accessi — {exportData.piano.paziente}</h1>
                        <h2>Operatore: {exportData.piano.operatore} ({exportData.piano.ruoloOperatore})</h2>
                        <p><strong>Attività:</strong> {exportData.piano.task}</p>
                        <p><strong>Periodo:</strong> {exportData.periodo.da} — {exportData.periodo.a}</p>

                        <table>
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Entrata</th>
                              <th>Uscita</th>
                              <th>Durata</th>
                              <th>Note</th>
                              {exportData.piano.tipoCompenso !== 'nessuno' && <th>Compenso</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {exportData.accessi.map((acc: any, i: number) => (
                              <tr key={i}>
                                <td>{acc.data}</td>
                                <td>{acc.oraEntrata}</td>
                                <td>{acc.oraUscita}</td>
                                <td>{acc.durataOre}</td>
                                <td>{acc.note || '—'}</td>
                                {exportData.piano.tipoCompenso !== 'nessuno' && <td>{acc.compenso}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="riepilogo">
                          <p><strong>Totale accessi:</strong> {exportData.riepilogo.totaleAccessi}</p>
                          <p><strong>Ore totali:</strong> {exportData.riepilogo.oreTotali}</p>
                          {exportData.piano.tipoCompenso !== 'nessuno' && (
                            <p><strong>Compenso totale:</strong> {exportData.riepilogo.compensoTotale}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Lista accessi */}
                {accessi.length === 0 ? (
                  <p style={{ color: '#888', fontStyle: 'italic' }}>Nessun accesso registrato.</p>
                ) : (
                  <div className="document-list">
                    <ul>
                      {accessi.map(acc => (
                        <li key={acc._id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                📅 {formatData(acc.oraEntrata)} — {formatOra(acc.oraEntrata)}
                                {acc.oraUscita ? ` → ${formatOra(acc.oraUscita)}` : ' 🟢 In corso'}
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#555', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {acc.durataMinuti > 0 && <span>⏱️ {formatDurata(acc.durataMinuti)}</span>}
                                {acc.compensoMaturato > 0 && <span>💰 € {acc.compensoMaturato.toFixed(2)}</span>}
                                {acc.note && <span>📝 {acc.note}</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: '#888' }}>✍️ {acc.firmaLogin}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

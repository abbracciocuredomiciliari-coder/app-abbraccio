import { useEffect, useState, useRef } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

// ─── Interfacce ───────────────────────────────────────────────────────────────

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

interface DiarioEntry {
  _id: string;
  testo: string;
  staffName: string;
  dataRegistrazione: string;
  firmato: boolean;
  dataFirma?: string;
  firmaLogin: string;
  parametriVitali?: {
    pressioneSistolica?: number;
    pressioneDiastolica?: number;
    frequenzaCardiaca?: number;
    frequenzaRespiratoria?: number;
    temperatura?: number;
    saturazione?: number;
    glicemia?: number;
    peso?: number;
    dolore?: number;
  };
}

interface Allegato {
  _id: string;
  nomeFile: string;
  mimeType: string;
  dimensione: number;
  descrizione?: string;
  caricatoDa: string;
  dataCaricamento: string;
  urlCloudinary?: string;
}

interface Obiettivo {
  _id: string;
  descrizione: string;
  stato: string;
  dataInizio: string;
  dataRivalutazione?: string;
  valutazioni?: { data: string; stato: string; note?: string; valutatoDa: string }[];
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const statoObiettivoBadge: Record<string, { bg: string; color: string; label: string }> = {
  attivo:        { bg: 'rgba(30,77,140,0.1)',  color: '#1e4d8c', label: '🎯 Attivo' },
  raggiunto:     { bg: 'rgba(5,150,105,0.1)',  color: '#065f46', label: '✅ Raggiunto' },
  parziale:      { bg: 'rgba(245,158,11,0.1)', color: '#92400e', label: '⚠️ Parziale' },
  non_raggiunto: { bg: 'rgba(220,38,38,0.1)',  color: '#7f1d1d', label: '❌ Non raggiunto' },
  rivalutato:    { bg: 'rgba(107,114,128,0.1)',color: '#374151', label: '🔄 Rivalutato' },
};

const STATI_OBIETTIVO = ['attivo', 'raggiunto', 'parziale', 'non_raggiunto', 'rivalutato'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function PortaleOperatore() {
  const { user } = useAuth();

  // Selezione paziente / piano
  const [pazienti, setPazienti] = useState<Paziente[]>([]);
  const [pazienteSelezionato, setPazienteSelezionato] = useState<Paziente | null>(null);
  const [piani, setPiani] = useState<Piano[]>([]);
  const [pianoSelezionato, setPianoSelezionato] = useState<Piano | null>(null);

  // Accessi
  const [accessi, setAccessi] = useState<Accesso[]>([]);
  const [riepilogo, setRiepilogo] = useState<any>(null);
  const [accessoAperto, setAccessoAperto] = useState<Accesso | null>(null);
  const [noteAccesso, setNoteAccesso] = useState('');
  const [registrandoAccesso, setRegistrandoAccesso] = useState(false);

  // Diario clinico
  const [diario, setDiario] = useState<DiarioEntry[]>([]);
  const [testoDiario, setTestoDiario] = useState('');
  const [parametri, setParametri] = useState<Record<string, string>>({});
  const [salvandoDiario, setSalvandoDiario] = useState(false);
  const [showDiario, setShowDiario] = useState(false);

  // Allegati
  const [allegati, setAllegati] = useState<Allegato[]>([]);
  const [fileAllegato, setFileAllegato] = useState<File | null>(null);
  const [descrizioneAllegato, setDescrizioneAllegato] = useState('');
  const [caricandoAllegato, setCaricandoAllegato] = useState(false);
  const [showAllegati, setShowAllegati] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Obiettivi
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([]);
  const [showObiettivi, setShowObiettivi] = useState(false);
  const [rivalutandoId, setRivalutandoId] = useState<string | null>(null);
  const [statoRivalutazione, setStatoRivalutazione] = useState('');
  const [noteRivalutazione, setNoteRivalutazione] = useState('');
  const [salvandoRivalutazione, setSalvandoRivalutazione] = useState(false);

  // Export PDF
  const [showExport, setShowExport] = useState(false);
  const [exportDaData, setExportDaData] = useState('');
  const [exportAData, setExportAData] = useState('');
  const [exportData, setExportData] = useState<any>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadingPiano, setLoadingPiano] = useState(false);

  // ─── Caricamento iniziale ──────────────────────────────────────────────────

  useEffect(() => {
    api.get('/workplan/miei-pazienti')
      .then(r => setPazienti(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ─── Selezione paziente ────────────────────────────────────────────────────

  const selezionaPaziente = async (paz: Paziente) => {
    setPazienteSelezionato(paz);
    setPianoSelezionato(null);
    resetDettagliPiano();
    try {
      const res = await api.get('/workplan');
      setPiani(res.data.filter((p: Piano) => p.patient?._id === paz._id));
    } catch {}
  };

  const resetDettagliPiano = () => {
    setAccessi([]); setRiepilogo(null); setAccessoAperto(null);
    setDiario([]); setAllegati([]); setObiettivi([]);
    setShowDiario(false); setShowAllegati(false); setShowObiettivi(false);
    setShowExport(false); setExportData(null);
  };

  // ─── Selezione piano ───────────────────────────────────────────────────────

  const selezionaPiano = async (piano: Piano) => {
    setPianoSelezionato(piano);
    setLoadingPiano(true);
    resetDettagliPiano();
    try {
      const [accessiRes, diarioRes, allegatiRes, obiettiviRes] = await Promise.allSettled([
        api.get(`/workplan/${piano._id}/accessi`),
        api.get(`/diario/${piano._id}`),
        api.get(`/allegati/${piano._id}`),
        api.get(`/obiettivi/${piano._id}`),
      ]);

      if (accessiRes.status === 'fulfilled') {
        const data = accessiRes.value.data;
        setAccessi(data.accessi || []);
        setRiepilogo(data.riepilogo || null);
        // Cerca accesso aperto: prima per staffId (via route dedicata), poi fallback su firmaLogin
        const tuttiAccessi: Accesso[] = data.accessi || [];
        const aperto = tuttiAccessi.find((a: Accesso) => !a.oraUscita);
        setAccessoAperto(aperto || null);
      }
      if (diarioRes.status === 'fulfilled') setDiario(diarioRes.value.data || []);
      if (allegatiRes.status === 'fulfilled') setAllegati(allegatiRes.value.data || []);
      if (obiettiviRes.status === 'fulfilled') setObiettivi(obiettiviRes.value.data || []);
    } finally {
      setLoadingPiano(false);
    }
  };

  // ─── Accessi ───────────────────────────────────────────────────────────────

  const registraEntrata = async () => {
    if (!pianoSelezionato) return;
    setRegistrandoAccesso(true);
    try {
      await api.post(`/workplan-access/${pianoSelezionato._id}/entrata`, { note: noteAccesso });
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
      // La route uscita è PATCH /workplan-access/:accessId/uscita
      await api.patch(`/workplan-access/${accessoAperto._id}/uscita`, { note: noteAccesso });
      setNoteAccesso('');
      await selezionaPiano(pianoSelezionato);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella registrazione uscita');
    } finally {
      setRegistrandoAccesso(false);
    }
  };

  // ─── Diario clinico ────────────────────────────────────────────────────────

  const salvaDiario = async () => {
    if (!pianoSelezionato || !testoDiario.trim()) return;
    setSalvandoDiario(true);
    try {
      const pv: Record<string, number> = {};
      Object.entries(parametri).forEach(([k, v]) => {
        if (v !== '') pv[k] = parseFloat(v);
      });
      await api.post(`/diario/${pianoSelezionato._id}`, {
        testo: testoDiario,
        parametriVitali: Object.keys(pv).length > 0 ? pv : undefined,
        workPlanAccess: accessoAperto?._id,
      });
      setTestoDiario('');
      setParametri({});
      const res = await api.get(`/diario/${pianoSelezionato._id}`);
      setDiario(res.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel salvataggio del diario');
    } finally {
      setSalvandoDiario(false);
    }
  };

  const firmaDiario = async (entryId: string) => {
    if (!confirm('Firmare questa voce? Non sarà più modificabile.')) return;
    try {
      await api.post(`/diario/firma/${entryId}`);
      setDiario(prev => prev.map(e => e._id === entryId ? { ...e, firmato: true } : e));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella firma');
    }
  };

  // ─── Allegati ──────────────────────────────────────────────────────────────

  const caricaAllegato = async () => {
    if (!pianoSelezionato || !fileAllegato) return;
    setCaricandoAllegato(true);
    try {
      const formData = new FormData();
      formData.append('file', fileAllegato);
      if (descrizioneAllegato) formData.append('descrizione', descrizioneAllegato);
      await api.post(`/allegati/${pianoSelezionato._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFileAllegato(null);
      setDescrizioneAllegato('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      const res = await api.get(`/allegati/${pianoSelezionato._id}`);
      setAllegati(res.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel caricamento allegato');
    } finally {
      setCaricandoAllegato(false);
    }
  };

  const apriAllegato = (all: Allegato) => {
    if (all.urlCloudinary) {
      window.open(all.urlCloudinary, '_blank');
    } else {
      const token = localStorage.getItem('authToken');
      window.open(`${import.meta.env.VITE_API_BASE_URL}/allegati/file/${all._id}?token=${token}`, '_blank');
    }
  };

  // ─── Obiettivi ─────────────────────────────────────────────────────────────

  const salvaRivalutazione = async (obId: string) => {
    if (!statoRivalutazione) return;
    setSalvandoRivalutazione(true);
    try {
      const res = await api.post(`/obiettivi/valuta/${obId}`, {
        stato: statoRivalutazione,
        note: noteRivalutazione,
      });
      setObiettivi(prev => prev.map(o => o._id === obId ? res.data : o));
      setRivalutandoId(null);
      setStatoRivalutazione('');
      setNoteRivalutazione('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella rivalutazione');
    } finally {
      setSalvandoRivalutazione(false);
    }
  };

  // ─── Export PDF ────────────────────────────────────────────────────────────

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
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Registro Accessi</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:20px}
      h1{font-size:18px;color:#1e4d8c;margin-bottom:4px}
      h2{font-size:14px;color:#444;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1e4d8c;color:#fff;padding:8px;text-align:left;font-size:11px}
      td{padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:11px}
      tr:nth-child(even) td{background:#f8fafc}
      .riepilogo{margin-top:20px;background:#f1f5f9;padding:12px;border-radius:6px}
      .riepilogo p{margin:4px 0}
      @media print{body{margin:0}}
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <section><p>Caricamento...</p></section>;

  return (
    <section>
      <h2>🏥 Il mio Piano di Lavoro</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Seleziona un paziente per visualizzare i piani assegnati e operare.
      </p>

      {/* ── Dropdown pazienti ── */}
      <div style={{ marginBottom: '20px' }}>
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
            onChange={e => { const p = pazienti.find(x => x._id === e.target.value); if (p) selezionaPaziente(p); }}
            style={{ width: '100%', maxWidth: '480px', padding: '10px 14px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '1rem' }}
          >
            <option value="">— Seleziona paziente —</option>
            {pazienti.map(p => (
              <option key={p._id} value={p._id}>{p.firstName} {p.lastName}{p.pianiAssegnati ? ` (${p.pianiAssegnati} piani)` : ''}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Info paziente ── */}
      {pazienteSelezionato && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
          <strong>📋 {pazienteSelezionato.firstName} {pazienteSelezionato.lastName}</strong>
          <div style={{ fontSize: '0.88rem', color: '#555', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {pazienteSelezionato.address && <span>📍 {pazienteSelezionato.address}</span>}
            {pazienteSelezionato.contactPhone && <span>📞 {pazienteSelezionato.contactPhone}</span>}
            {pazienteSelezionato.assistanceNeeds && <span>🩺 {pazienteSelezionato.assistanceNeeds}</span>}
          </div>
        </div>
      )}

      {/* ── Lista piani ── */}
      {pazienteSelezionato && piani.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>📋 Piani di lavoro ({piani.length})</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {piani.map(piano => (
              <button key={piano._id} type="button" onClick={() => selezionaPiano(piano)}
                style={{ background: pianoSelezionato?._id === piano._id ? '#1e4d8c' : '#f1f5f9', color: pianoSelezionato?._id === piano._id ? '#fff' : '#374151', border: `1px solid ${pianoSelezionato?._id === piano._id ? '#1e4d8c' : '#e2e8f0'}`, borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left' }}>
                <div style={{ fontWeight: '600' }}>{piano.category}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{formatData(piano.date)}{piano.dataFine ? ` → ${formatData(piano.dataFine)}` : ''}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Dettaglio piano ── */}
      {pianoSelezionato && (
        loadingPiano ? <p>Caricamento piano...</p> : (
          <div>
            {/* Info piano */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 6px', color: '#1e4d8c' }}>📋 {pianoSelezionato.category}</h3>
              <p style={{ margin: '0 0 4px', color: '#374151' }}>{pianoSelezionato.task}</p>
              {pianoSelezionato.notes && <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>📝 {pianoSelezionato.notes}</p>}
            </div>

            {/* ── Compenso (sola lettura) ── */}
            {riepilogo && pianoSelezionato.tipoCompenso && pianoSelezionato.tipoCompenso !== 'nessuno' && (
              <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px', color: '#065f46' }}>💰 Compenso (sola lettura)</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.9rem', color: '#374151' }}>
                  <span>📊 {pianoSelezionato.tipoCompenso === 'orario' ? 'Orario' : 'Fisso'}</span>
                  <span>💵 Tariffa: <strong>€ {pianoSelezionato.tariffa?.toFixed(2) || '0.00'}</strong></span>
                  <span>🕐 Ore: <strong>{formatDurata(riepilogo.minutiTotali)}</strong></span>
                  <span>✅ Accessi: <strong>{riepilogo.accessiCompletati}</strong></span>
                  <span>💰 Maturato: <strong style={{ color: '#059669' }}>€ {riepilogo.compensoCalcolato?.toFixed(2) || '0.00'}</strong></span>
                  {pianoSelezionato.compensoPagato && <span style={{ color: '#059669', fontWeight: '700' }}>✅ Pagato</span>}
                </div>
              </div>
            )}

            {/* ── Registrazione accesso ── */}
            <div style={{ background: accessoAperto ? 'rgba(5,150,105,0.06)' : 'rgba(30,77,140,0.04)', border: `1px solid ${accessoAperto ? 'rgba(5,150,105,0.3)' : 'rgba(30,77,140,0.2)'}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 10px', color: accessoAperto ? '#065f46' : '#1e4d8c' }}>
                {accessoAperto ? '🟢 Accesso in corso' : '🔵 Registra accesso'}
              </h4>
              {accessoAperto && (
                <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#374151' }}>
                  Entrata: <strong>{formatOra(accessoAperto.oraEntrata)}</strong> del <strong>{formatData(accessoAperto.oraEntrata)}</strong>
                </p>
              )}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <label style={{ flex: 1, minWidth: '200px' }}>
                  Note accesso (opzionale)
                  <input value={noteAccesso} onChange={e => setNoteAccesso(e.target.value)} placeholder="Es. parametri rilevati, attività svolte..." style={{ marginTop: '4px' }} />
                </label>
                {!accessoAperto ? (
                  <button type="button" onClick={registraEntrata} disabled={registrandoAccesso}
                    style={{ background: '#1e4d8c', padding: '10px 20px', whiteSpace: 'nowrap' }}>
                    {registrandoAccesso ? '⏳' : '▶️ Registra entrata'}
                  </button>
                ) : (
                  <button type="button" onClick={registraUscita} disabled={registrandoAccesso}
                    style={{ background: '#dc2626', padding: '10px 20px', whiteSpace: 'nowrap' }}>
                    {registrandoAccesso ? '⏳' : '⏹️ Registra uscita'}
                  </button>
                )}
              </div>
            </div>

            {/* ── SEZIONE DIARIO CLINICO ── */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
              <button type="button" onClick={() => setShowDiario(!showDiario)}
                style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                <span>📓 Diario clinico ({diario.length} voci)</span>
                <span>{showDiario ? '▲' : '▼'}</span>
              </button>
              {showDiario && (
                <div style={{ padding: '16px' }}>
                  {/* Form nuova voce */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                    <h5 style={{ margin: '0 0 12px', color: '#1e4d8c' }}>✏️ Nuova voce diario</h5>
                    <label style={{ display: 'block', marginBottom: '12px' }}>
                      Diaria *
                      <textarea
                        value={testoDiario}
                        onChange={e => setTestoDiario(e.target.value)}
                        placeholder="Descrivi le attività svolte, le condizioni del paziente, le osservazioni cliniche..."
                        rows={4}
                        style={{ width: '100%', marginTop: '4px', padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                    </label>

                    {/* Parametri vitali */}
                    <h6 style={{ margin: '0 0 10px', color: '#374151', fontWeight: '600' }}>📊 Parametri vitali (opzionali)</h6>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                      {[
                        { key: 'pressioneSistolica',   label: '🩸 P. Sistolica',   unit: 'mmHg', step: '1' },
                        { key: 'pressioneDiastolica',  label: '🩸 P. Diastolica',  unit: 'mmHg', step: '1' },
                        { key: 'frequenzaCardiaca',    label: '❤️ Freq. Cardiaca', unit: 'bpm',  step: '1' },
                        { key: 'frequenzaRespiratoria',label: '🫁 Freq. Resp.',    unit: 'atti/min', step: '1' },
                        { key: 'temperatura',          label: '🌡️ Temperatura',   unit: '°C',   step: '0.1' },
                        { key: 'saturazione',          label: '💨 Saturazione',    unit: '%',    step: '1' },
                        { key: 'glicemia',             label: '🍬 Glicemia',       unit: 'mg/dL',step: '1' },
                        { key: 'peso',                 label: '⚖️ Peso',           unit: 'kg',   step: '0.1' },
                        { key: 'dolore',               label: '😣 Dolore (0-10)',  unit: '/10',  step: '1' },
                      ].map(({ key, label, unit, step }) => (
                        <label key={key} style={{ fontSize: '0.82rem' }}>
                          {label}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <input
                              type="number"
                              value={parametri[key] || ''}
                              onChange={e => setParametri(prev => ({ ...prev, [key]: e.target.value }))}
                              step={step}
                              min={key === 'dolore' ? '0' : undefined}
                              max={key === 'dolore' ? '10' : undefined}
                              placeholder="—"
                              style={{ flex: 1, padding: '5px 8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '0.85rem' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>{unit}</span>
                          </div>
                        </label>
                      ))}
                    </div>

                    <button type="button" onClick={salvaDiario} disabled={salvandoDiario || !testoDiario.trim()}
                      style={{ background: '#1e4d8c', padding: '9px 20px', opacity: !testoDiario.trim() ? 0.5 : 1 }}>
                      {salvandoDiario ? '⏳ Salvataggio...' : '💾 Salva voce diario'}
                    </button>
                  </div>

                  {/* Lista voci diario */}
                  {diario.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>Nessuna voce nel diario.</p>
                  ) : (
                    <div className="document-list">
                      <ul>
                        {diario.map(entry => (
                          <li key={entry._id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>📅 {formatData(entry.dataRegistrazione)} {formatOra(entry.dataRegistrazione)}</span>
                                  <span style={{ fontSize: '0.8rem', color: '#888' }}>✍️ {entry.staffName}</span>
                                  {entry.firmato && (
                                    <span style={{ background: 'rgba(5,150,105,0.1)', color: '#065f46', border: '1px solid #059669', borderRadius: '10px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: '700' }}>
                                      ✅ Firmato {entry.dataFirma ? formatData(entry.dataFirma) : ''}
                                    </span>
                                  )}
                                </div>
                                <p style={{ margin: '0 0 8px', color: '#374151', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{entry.testo}</p>
                                {entry.parametriVitali && Object.values(entry.parametriVitali).some(v => v !== undefined && v !== null) && (
                                  <div style={{ background: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', fontSize: '0.82rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {entry.parametriVitali.pressioneSistolica !== undefined && <span>🩸 {entry.parametriVitali.pressioneSistolica}/{entry.parametriVitali.pressioneDiastolica} mmHg</span>}
                                    {entry.parametriVitali.frequenzaCardiaca !== undefined && <span>❤️ {entry.parametriVitali.frequenzaCardiaca} bpm</span>}
                                    {entry.parametriVitali.frequenzaRespiratoria !== undefined && <span>🫁 {entry.parametriVitali.frequenzaRespiratoria} atti/min</span>}
                                    {entry.parametriVitali.temperatura !== undefined && <span>🌡️ {entry.parametriVitali.temperatura}°C</span>}
                                    {entry.parametriVitali.saturazione !== undefined && <span>💨 SpO2 {entry.parametriVitali.saturazione}%</span>}
                                    {entry.parametriVitali.glicemia !== undefined && <span>🍬 {entry.parametriVitali.glicemia} mg/dL</span>}
                                    {entry.parametriVitali.peso !== undefined && <span>⚖️ {entry.parametriVitali.peso} kg</span>}
                                    {entry.parametriVitali.dolore !== undefined && <span>😣 Dolore {entry.parametriVitali.dolore}/10</span>}
                                  </div>
                                )}
                              </div>
                              {!entry.firmato && entry.firmaLogin === user?.name && (
                                <button type="button" onClick={() => firmaDiario(entry._id)}
                                  style={{ background: '#059669', fontSize: '0.82rem', padding: '5px 12px', whiteSpace: 'nowrap' }}>
                                  ✍️ Firma
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── SEZIONE ALLEGATI ── */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
              <button type="button" onClick={() => setShowAllegati(!showAllegati)}
                style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                <span>📎 Allegati ({allegati.length})</span>
                <span>{showAllegati ? '▲' : '▼'}</span>
              </button>
              {showAllegati && (
                <div style={{ padding: '16px' }}>
                  {/* Upload */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                    <h5 style={{ margin: '0 0 12px', color: '#1e4d8c' }}>📤 Carica documento</h5>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <label style={{ flex: 2, minWidth: '200px' }}>
                        File *
                        <input ref={fileInputRef} type="file" onChange={e => setFileAllegato(e.target.files?.[0] || null)}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt"
                          style={{ marginTop: '4px', display: 'block' }} />
                      </label>
                      <label style={{ flex: 2, minWidth: '200px' }}>
                        Descrizione (opzionale)
                        <input value={descrizioneAllegato} onChange={e => setDescrizioneAllegato(e.target.value)}
                          placeholder="Es. Referto ECG, Prescrizione..." style={{ marginTop: '4px' }} />
                      </label>
                      <button type="button" onClick={caricaAllegato} disabled={caricandoAllegato || !fileAllegato}
                        style={{ background: '#1e4d8c', padding: '10px 18px', opacity: !fileAllegato ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                        {caricandoAllegato ? '⏳' : '📤 Carica'}
                      </button>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#888' }}>Formati accettati: PDF, immagini, Word, Excel, testo. Max 20 MB.</p>
                  </div>

                  {/* Lista allegati */}
                  {allegati.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>Nessun allegato.</p>
                  ) : (
                    <div className="document-list">
                      <ul>
                        {allegati.map(all => (
                          <li key={all._id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div>
                                <div style={{ fontWeight: '600', marginBottom: '2px' }}>
                                  {all.mimeType.startsWith('image/') ? '🖼️' : all.mimeType === 'application/pdf' ? '📄' : '📎'} {all.nomeFile}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#888', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                  {all.descrizione && <span>{all.descrizione}</span>}
                                  <span>{formatBytes(all.dimensione)}</span>
                                  <span>📅 {formatData(all.dataCaricamento)}</span>
                                  <span>👤 {all.caricatoDa}</span>
                                </div>
                              </div>
                              <button type="button" onClick={() => apriAllegato(all)}
                                style={{ background: '#1e4d8c', fontSize: '0.85rem', padding: '6px 14px' }}>
                                👁️ Apri
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── SEZIONE OBIETTIVI ── */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
              <button type="button" onClick={() => setShowObiettivi(!showObiettivi)}
                style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                <span>🎯 Obiettivi del piano ({obiettivi.length})</span>
                <span>{showObiettivi ? '▲' : '▼'}</span>
              </button>
              {showObiettivi && (
                <div style={{ padding: '16px' }}>
                  {obiettivi.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>Nessun obiettivo definito. Gli obiettivi vengono formulati dal coordinatore.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {obiettivi.map(ob => {
                        const badge = statoObiettivoBadge[ob.stato] || statoObiettivoBadge.attivo;
                        const isRivalutando = rivalutandoId === ob._id;
                        return (
                          <div key={ob._id} style={{ background: badge.bg, border: `1px solid ${badge.color}30`, borderRadius: '8px', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#374151' }}>{ob.descrizione}</p>
                                <div style={{ fontSize: '0.82rem', color: '#888', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                  <span>📅 Inizio: {formatData(ob.dataInizio)}</span>
                                  {ob.dataRivalutazione && <span>🔄 Rivalutazione: {formatData(ob.dataRivalutazione)}</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ color: badge.color, fontWeight: '700', fontSize: '0.85rem', background: badge.bg, border: `1px solid ${badge.color}`, borderRadius: '12px', padding: '2px 10px' }}>{badge.label}</span>
                                <button type="button"
                                  onClick={() => { setRivalutandoId(isRivalutando ? null : ob._id); setStatoRivalutazione(ob.stato); setNoteRivalutazione(''); }}
                                  style={{ background: isRivalutando ? '#6c757d' : '#f59e0b', fontSize: '0.82rem', padding: '5px 12px' }}>
                                  {isRivalutando ? '✕ Annulla' : '🔄 Rivaluta'}
                                </button>
                              </div>
                            </div>

                            {/* Form rivalutazione */}
                            {isRivalutando && (
                              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginTop: '8px' }}>
                                <h6 style={{ margin: '0 0 10px', color: '#374151' }}>🔄 Rivaluta obiettivo</h6>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                  <label style={{ flex: 1, minWidth: '160px' }}>
                                    Nuovo stato *
                                    <select value={statoRivalutazione} onChange={e => setStatoRivalutazione(e.target.value)}
                                      style={{ marginTop: '4px', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '4px', width: '100%' }}>
                                      <option value="">— Seleziona —</option>
                                      {STATI_OBIETTIVO.map(s => (
                                        <option key={s} value={s}>{statoObiettivoBadge[s]?.label || s}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label style={{ flex: 2, minWidth: '200px' }}>
                                    Note rivalutazione
                                    <input value={noteRivalutazione} onChange={e => setNoteRivalutazione(e.target.value)}
                                      placeholder="Osservazioni sulla rivalutazione..." style={{ marginTop: '4px' }} />
                                  </label>
                                  <button type="button" onClick={() => salvaRivalutazione(ob._id)}
                                    disabled={salvandoRivalutazione || !statoRivalutazione}
                                    style={{ background: '#059669', padding: '9px 16px', opacity: !statoRivalutazione ? 0.5 : 1 }}>
                                    {salvandoRivalutazione ? '⏳' : '✅ Salva'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Storico valutazioni */}
                            {ob.valutazioni && ob.valutazioni.length > 0 && (
                              <details style={{ marginTop: '8px' }}>
                                <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#888' }}>📋 Storico valutazioni ({ob.valutazioni.length})</summary>
                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {ob.valutazioni.map((v, i) => (
                                    <div key={i} style={{ fontSize: '0.82rem', color: '#555', background: '#f8fafc', padding: '6px 10px', borderRadius: '4px' }}>
                                      <strong>{formatData(v.data)}</strong> — {statoObiettivoBadge[v.stato]?.label || v.stato}
                                      {v.note && ` — ${v.note}`}
                                      <span style={{ color: '#888', marginLeft: '8px' }}>({v.valutatoDa})</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── STORICO ACCESSI + EXPORT PDF ── */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#f8fafc', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#374151' }}>📅 Storico accessi ({accessi.length})</span>
                <button type="button" onClick={() => setShowExport(!showExport)}
                  style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', padding: '6px 14px', fontSize: '0.85rem' }}>
                  📄 Esporta / Stampa PDF
                </button>
              </div>

              {/* Export PDF */}
              {showExport && (
                <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
                  <h5 style={{ margin: '0 0 12px', color: '#374151' }}>📄 Esporta registro accessi</h5>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '8px' }}>
                    <label style={{ flex: 1, minWidth: '140px' }}>
                      Da data
                      <input type="date" value={exportDaData} onChange={e => setExportDaData(e.target.value)} style={{ marginTop: '4px' }} />
                    </label>
                    <label style={{ flex: 1, minWidth: '140px' }}>
                      A data
                      <input type="date" value={exportAData} onChange={e => setExportAData(e.target.value)} style={{ marginTop: '4px' }} />
                    </label>
                    <button type="button" onClick={caricaExport} disabled={loadingExport}
                      style={{ background: '#1e4d8c', padding: '10px 18px', whiteSpace: 'nowrap' }}>
                      {loadingExport ? '⏳' : '🔍 Carica'}
                    </button>
                    {exportData && (
                      <button type="button" onClick={stampaPDF}
                        style={{ background: '#059669', padding: '10px 18px', whiteSpace: 'nowrap' }}>
                        🖨️ Stampa PDF
                      </button>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#888' }}>Lascia vuoto per il mese corrente</p>

                  {exportData && (
                    <div ref={printRef} style={{ marginTop: '16px', background: '#fff', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <h1>Registro Accessi — {exportData.piano.paziente}</h1>
                      <h2>Operatore: {exportData.piano.operatore} ({exportData.piano.ruoloOperatore})</h2>
                      <p><strong>Attività:</strong> {exportData.piano.task}</p>
                      <p><strong>Periodo:</strong> {exportData.periodo.da} — {exportData.periodo.a}</p>
                      <table>
                        <thead>
                          <tr>
                            <th>Data</th><th>Entrata</th><th>Uscita</th><th>Durata</th><th>Note</th>
                            {exportData.piano.tipoCompenso !== 'nessuno' && <th>Compenso</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {exportData.accessi.map((acc: any, i: number) => (
                            <tr key={i}>
                              <td>{acc.data}</td><td>{acc.oraEntrata}</td><td>{acc.oraUscita}</td>
                              <td>{acc.durataOre}</td><td>{acc.note || '—'}</td>
                              {exportData.piano.tipoCompenso !== 'nessuno' && <td>{acc.compenso}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="riepilogo">
                        <p><strong>Totale accessi:</strong> {exportData.riepilogo.totaleAccessi}</p>
                        <p><strong>Ore totali:</strong> {exportData.riepilogo.oreTotali}</p>
                        {exportData.piano.tipoCompenso !== 'nessuno' && <p><strong>Compenso totale:</strong> {exportData.riepilogo.compensoTotale}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lista accessi */}
              <div style={{ padding: accessi.length > 0 ? '0' : '16px' }}>
                {accessi.length === 0 ? (
                  <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Nessun accesso registrato.</p>
                ) : (
                  <div className="document-list" style={{ margin: 0 }}>
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
            </div>

          </div>
        )
      )}
    </section>
  );
}

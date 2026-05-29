import { useEffect, useState, useRef } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import RichiestaPresidi from '../components/RichiestaPresidi';

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

const PARAMETRI_VITALI = [
  { key: 'pressioneSistolica',    label: '🩸 P. Sistolica',    unit: 'mmHg',     step: '1' },
  { key: 'pressioneDiastolica',   label: '🩸 P. Diastolica',   unit: 'mmHg',     step: '1' },
  { key: 'frequenzaCardiaca',     label: '❤️ Freq. Cardiaca',  unit: 'bpm',      step: '1' },
  { key: 'frequenzaRespiratoria', label: '🫁 Freq. Resp.',      unit: 'atti/min', step: '1' },
  { key: 'temperatura',           label: '🌡️ Temperatura',     unit: '°C',       step: '0.1' },
  { key: 'saturazione',           label: '💨 Saturazione',      unit: '%',        step: '1' },
  { key: 'glicemia',              label: '🍬 Glicemia',         unit: 'mg/dL',    step: '1' },
  { key: 'peso',                  label: '⚖️ Peso',             unit: 'kg',       step: '0.1' },
  { key: 'dolore',                label: '😣 Dolore (0-10)',    unit: '/10',      step: '1' },
];

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
  const [tuttiIPiani, setTuttiIPiani] = useState<Piano[]>([]);
  const [mostraTuttiPiani, setMostraTuttiPiani] = useState(false);

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

  // ─── Caricamento iniziale + polling ogni 30s ───────────────────────────────

  const caricaDati = async (silent = false) => {
    try {
      const [pazientiRes, pianiRes] = await Promise.all([
        api.get('/workplan/miei-pazienti'),
        api.get('/workplan'),
      ]);
      const tuttiPiani: Piano[] = pianiRes.data || [];
      setTuttiIPiani(tuttiPiani);
      const pazientiConPianoAttivo = pazientiRes.data.filter((paz: Paziente) =>
        tuttiPiani.some(p => p.patient?._id === paz._id && p.status === 'pending')
      );
      setPazienti(pazientiConPianoAttivo);
    } catch {}
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    caricaDati();
    const interval = setInterval(() => caricaDati(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // ─── Selezione paziente ────────────────────────────────────────────────────

  const selezionaPaziente = async (paz: Paziente) => {
    setPazienteSelezionato(paz);
    setPianoSelezionato(null);
    setMostraTuttiPiani(false);
    resetDettagliPiano();
    try {
      const res = await api.get('/workplan');
      const pianiPaz = res.data.filter((p: Piano) => p.patient?._id === paz._id);
      setPiani(pianiPaz);
      const pianiAttivi = pianiPaz.filter((p: Piano) => p.status === 'pending');
      if (pianiAttivi.length === 1) {
        selezionaPiano(pianiAttivi[0]);
      }
    } catch {}
  };

  const resetDettagliPiano = () => {
    setAccessi([]); setRiepilogo(null); setAccessoAperto(null);
    setDiario([]); setAllegati([]); setObiettivi([]);
    setShowDiario(false); setShowAllegati(false); setShowObiettivi(false);
    setShowExport(false); setExportData(null);
  };

  // ─── Vista tutti i piani attivi ───────────────────────────────────────────

  const apriTuttiPiani = () => {
    setMostraTuttiPiani(true);
    setPazienteSelezionato(null);
    setPianoSelezionato(null);
    resetDettagliPiano();
  };

  const selezionaPianoDaLista = async (piano: Piano) => {
    setMostraTuttiPiani(false);
    const paz = pazienti.find(p => p._id === piano.patient._id);
    if (paz) {
      setPazienteSelezionato(paz);
      const res = await api.get('/workplan');
      setPiani(res.data.filter((p: Piano) => p.patient?._id === paz._id));
    }
    selezionaPiano(piano);
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
        const tuttiAccessi: Accesso[] = data.accessi || [];
        setAccessoAperto(tuttiAccessi.find((a: Accesso) => !a.oraUscita) || null);
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
      const res = await api.post(`/workplan-access/${pianoSelezionato._id}/entrata`, { note: noteAccesso });
      setNoteAccesso('');
      setAccessoAperto(res.data);
      const accessiRes = await api.get(`/workplan/${pianoSelezionato._id}/accessi`);
      setAccessi(accessiRes.data.accessi || []);
      setRiepilogo(accessiRes.data.riepilogo || null);
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
      await api.patch(`/workplan-access/${accessoAperto._id}/uscita`, { note: noteAccesso });
      setNoteAccesso('');
      setAccessoAperto(null);
      const accessiRes = await api.get(`/workplan/${pianoSelezionato._id}/accessi`);
      setAccessi(accessiRes.data.accessi || []);
      setRiepilogo(accessiRes.data.riepilogo || null);
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
      Object.entries(parametri).forEach(([k, v]) => { if (v !== '') pv[k] = parseFloat(v); });
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
    if (!exportData) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const righe = exportData.accessi.map((acc: any) => `
      <tr>
        <td>${acc.data}</td>
        <td>${acc.oraEntrata}</td>
        <td>${acc.oraUscita || '—'}</td>
        <td>${acc.durataOre}</td>
        <td>${acc.note || '—'}</td>
      </tr>`).join('');

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
    </style></head><body>
    <h1>Registro Accessi — ${exportData.piano.paziente}</h1>
    <h2>Operatore: ${exportData.piano.operatore} (${exportData.piano.ruoloOperatore})</h2>
    <p><strong>Attività:</strong> ${exportData.piano.task}</p>
    <p><strong>Periodo:</strong> ${exportData.periodo.da} — ${exportData.periodo.a}</p>
    <table>
      <thead><tr><th>Data</th><th>Entrata</th><th>Uscita</th><th>Durata</th><th>Note</th></tr></thead>
      <tbody>${righe}</tbody>
    </table>
    <div class="riepilogo">
      <p><strong>Totale accessi:</strong> ${exportData.riepilogo.totaleAccessi}</p>
      <p><strong>Ore totali:</strong> ${exportData.riepilogo.oreTotali}</p>
    </div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.focus();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <section><p>Caricamento...</p></section>;

  const pianiAttiviTutti = tuttiIPiani.filter(p => p.status === 'pending');
  const compensoTotaleGlobale = tuttiIPiani
    .filter(p => p.tipoCompenso && p.tipoCompenso !== 'nessuno')
    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);
  const compensoPagatoGlobale = tuttiIPiani
    .filter(p => p.tipoCompenso && p.tipoCompenso !== 'nessuno' && p.compensoPagato)
    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);

  return (
    <section>
      <h2>
        {pazienteSelezionato || mostraTuttiPiani ? '🏥 Il mio Piano di Lavoro' : '📊 Dashboard'}
      </h2>

      {/* ══════════════════════════════════════════════════════════════════════
          DASHBOARD OPERATORE
      ══════════════════════════════════════════════════════════════════════ */}
      {!pazienteSelezionato && !mostraTuttiPiani && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Pazienti attivi</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#059669', lineHeight: 1 }}>{pazienti.length}</div>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Incarichi attivi</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#d97706', lineHeight: 1 }}>{pianiAttiviTutti.length}</div>
            </div>
            {compensoTotaleGlobale > 0 && (
              <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Compenso maturato</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#7c3aed', lineHeight: 1 }}>€ {compensoTotaleGlobale.toFixed(2)}</div>
                {compensoPagatoGlobale > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '600', marginTop: '2px' }}>✅ € {compensoPagatoGlobale.toFixed(2)} pagato</div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ color: 'var(--gray-500)', margin: 0, fontSize: '0.95rem' }}>
              Seleziona un paziente per operare, oppure visualizza tutti i piani attivi.
            </p>
            <button
              type="button"
              onClick={apriTuttiPiani}
              style={{ background: '#1e4d8c', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}
            >
              📋 Tutti i piani attivi ({pianiAttiviTutti.length})
            </button>
          </div>

          {/* ── RICHIESTA PRESIDI/FARMACI ── */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px', overflow: 'hidden' }}>
            <details>
              <summary style={{ background: '#f8fafc', padding: '14px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', color: '#374151', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📦 Richiesta Presidi / Farmaci</span>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>▼</span>
              </summary>
              <div style={{ padding: '16px' }}>
                <RichiestaPresidi />
              </div>
            </details>
          </div>

          {pazienti.length === 0 ? (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px', color: '#92400e' }}>
              ⚠️ Nessun paziente assegnato. Contatta il coordinatore.
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '0.95rem', color: '#374151' }}>
                👤 Pazienti in carico ({pazienti.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pazienti.map(paz => {
                  const pianiPaz = tuttiIPiani.filter(p => p.patient?._id === paz._id && p.status === 'pending');
                  const compensoTotale = tuttiIPiani
                    .filter(p => p.patient?._id === paz._id && p.tipoCompenso && p.tipoCompenso !== 'nessuno')
                    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);
                  const compensoPagato = tuttiIPiani
                    .filter(p => p.patient?._id === paz._id && p.tipoCompenso && p.tipoCompenso !== 'nessuno' && p.compensoPagato)
                    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);
                  const haCompenso = tuttiIPiani.some(p => p.patient?._id === paz._id && p.tipoCompenso && p.tipoCompenso !== 'nessuno');
                  return (
                    <button
                      key={paz._id}
                      type="button"
                      onClick={() => selezionaPaziente(paz)}
                      style={{
                        background: '#fff', border: '1px solid #e2e8f0', borderLeft: '4px solid #1e4d8c',
                        borderRadius: '8px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e4d8c', marginBottom: '4px' }}>
                          👤 {paz.firstName} {paz.lastName}
                        </div>
                        <div style={{ fontSize: '0.83rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {paz.address && <span>📍 {paz.address}</span>}
                          {paz.contactPhone && <span>📞 {paz.contactPhone}</span>}
                          {paz.assistanceNeeds && <span>🩺 {paz.assistanceNeeds}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                        {haCompenso && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '600', textTransform: 'uppercase' }}>Compenso maturato</div>
                            <div style={{ fontWeight: '800', color: '#7c3aed', fontSize: '1rem' }}>€ {compensoTotale.toFixed(2)}</div>
                            {compensoPagato > 0 && (
                              <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '600' }}>✅ € {compensoPagato.toFixed(2)} pagato</div>
                            )}
                          </div>
                        )}
                        <span style={{
                          background: pianiPaz.length > 0 ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.1)',
                          color: pianiPaz.length > 0 ? '#065f46' : '#6b7280',
                          border: `1px solid ${pianiPaz.length > 0 ? '#059669' : '#9ca3af'}`,
                          borderRadius: '20px', padding: '4px 12px', fontSize: '0.82rem', fontWeight: '700',
                        }}>
                          {pianiPaz.length} {pianiPaz.length === 1 ? 'piano attivo' : 'piani attivi'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VISTA: Tutti i piani attivi
      ══════════════════════════════════════════════════════════════════════ */}
      {mostraTuttiPiani && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setMostraTuttiPiani(false)}
              style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.88rem' }}
            >
              ← Torna ai pazienti
            </button>
            <h3 style={{ margin: 0, color: '#1e4d8c', fontSize: '1.05rem' }}>
              📋 Tutti i piani attivi ({pianiAttiviTutti.length})
            </h3>
          </div>

          {pianiAttiviTutti.length === 0 ? (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px', color: '#92400e' }}>
              ⚠️ Nessun piano attivo al momento.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pianiAttiviTutti.map(piano => (
                <button
                  key={piano._id}
                  type="button"
                  onClick={() => selezionaPianoDaLista(piano)}
                  style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderLeft: '4px solid #059669',
                    borderRadius: '8px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1e4d8c', marginBottom: '3px' }}>
                      👤 {piano.patient.firstName} {piano.patient.lastName}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '2px' }}>
                      {piano.category} — {piano.task}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#888' }}>
                      📅 {formatData(piano.date)}{piano.dataFine ? ` → ${formatData(piano.dataFine)}` : ''}
                    </div>
                  </div>
                  <span style={{ background: 'rgba(5,150,105,0.1)', color: '#065f46', border: '1px solid #059669', borderRadius: '20px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: '700', flexShrink: 0 }}>
                    ✅ Attivo
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PAZIENTE SELEZIONATO: info + lista piani
      ══════════════════════════════════════════════════════════════════════ */}
      {pazienteSelezionato && !pianoSelezionato && (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => { setPazienteSelezionato(null); setPianoSelezionato(null); resetDettagliPiano(); }}
              style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.88rem' }}
            >
              ← Torna ai pazienti
            </button>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
            <strong>📋 {pazienteSelezionato.firstName} {pazienteSelezionato.lastName}</strong>
            <div style={{ fontSize: '0.88rem', color: '#555', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {pazienteSelezionato.address && <span>📍 {pazienteSelezionato.address}</span>}
              {pazienteSelezionato.contactPhone && <span>📞 {pazienteSelezionato.contactPhone}</span>}
              {pazienteSelezionato.assistanceNeeds && <span>🩺 {pazienteSelezionato.assistanceNeeds}</span>}
            </div>
          </div>

          {piani.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>Nessun piano assegnato per questo paziente.</p>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', marginBottom: '10px', fontSize: '0.95rem', color: '#374151' }}>
                📋 Piani di lavoro ({piani.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {piani.map(piano => (
                  <button
                    key={piano._id}
                    type="button"
                    onClick={() => selezionaPiano(piano)}
                    style={{
                      background: piano.status === 'pending' ? '#fff' : '#f9fafb',
                      border: `1px solid ${piano.status === 'pending' ? '#059669' : '#e2e8f0'}`,
                      borderLeft: `4px solid ${piano.status === 'pending' ? '#059669' : '#9ca3af'}`,
                      borderRadius: '6px', padding: '10px 16px', cursor: 'pointer', fontSize: '0.9rem',
                      textAlign: 'left', minWidth: '180px',
                    }}
                  >
                    <div style={{ fontWeight: '600', color: '#1e4d8c' }}>{piano.category}</div>
                    <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '2px' }}>
                      {formatData(piano.date)}{piano.dataFine ? ` → ${formatData(piano.dataFine)}` : ''}
                    </div>
                    <div style={{ fontSize: '0.75rem', marginTop: '3px', color: piano.status === 'pending' ? '#059669' : '#6b7280', fontWeight: '600' }}>
                      {piano.status === 'pending' ? '✅ Attivo' : piano.status === 'completed' ? '✔ Completato' : '✕ Annullato'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DETTAGLIO PIANO
      ══════════════════════════════════════════════════════════════════════ */}
      {pianoSelezionato && (
        loadingPiano ? <p>Caricamento piano...</p> : (
          <div>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setPianoSelezionato(null); resetDettagliPiano(); }}
                style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Torna ai piani
              </button>
              {pazienteSelezionato && (
                <span style={{ fontSize: '0.85rem', color: '#888' }}>
                  {pazienteSelezionato.firstName} {pazienteSelezionato.lastName} › {pianoSelezionato.category}
                </span>
              )}
            </div>

            {/* Info piano */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 6px', color: '#1e4d8c' }}>📋 {pianoSelezionato.category}</h3>
              <p style={{ margin: '0 0 4px', color: '#374151' }}>{pianoSelezionato.task}</p>
              {pianoSelezionato.notes && <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>📝 {pianoSelezionato.notes}</p>}
            </div>

            {/* ── COMPENSO MATURATO ── */}
            {pianoSelezionato.tipoCompenso && pianoSelezionato.tipoCompenso !== 'nessuno' && (
              <div style={{ background: riepilogo?.compensoPagato ? 'rgba(5,150,105,0.06)' : 'rgba(124,58,237,0.06)', border: `1px solid ${riepilogo?.compensoPagato ? 'rgba(5,150,105,0.3)' : 'rgba(124,58,237,0.3)'}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', color: riepilogo?.compensoPagato ? '#065f46' : '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💰 Compenso maturato
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div style={{ background: '#f5f3ff', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>
                      {pianoSelezionato.tipoCompenso === 'orario' ? 'Tariffa/ora' : 'Compenso fisso'}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#7c3aed' }}>
                      € {(pianoSelezionato.tariffa || 0).toFixed(2)}
                      {pianoSelezionato.tipoCompenso === 'orario' && <span style={{ fontSize: '0.7rem', fontWeight: '400' }}>/h</span>}
                    </div>
                  </div>
                  {pianoSelezionato.tipoCompenso === 'orario' && riepilogo && (
                    <div style={{ background: '#f0f9ff', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>Ore lavorate</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0284c7' }}>{riepilogo.oreTotali}h</div>
                    </div>
                  )}
                  {riepilogo && (
                    <div style={{ background: '#fefce8', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>Accessi</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#d97706' }}>{riepilogo.accessiCompletati}</div>
                    </div>
                  )}
                  {riepilogo && (
                    <div style={{ background: riepilogo.compensoPagato ? '#f0fdf4' : '#fdf4ff', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', border: `1px solid ${riepilogo.compensoPagato ? '#bbf7d0' : '#e9d5ff'}` }}>
                      <div style={{ fontSize: '0.72rem', color: riepilogo.compensoPagato ? '#059669' : '#7c3aed', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>
                        {riepilogo.compensoPagato ? '✅ Pagato' : '💰 Maturato'}
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: riepilogo.compensoPagato ? '#059669' : '#7c3aed' }}>
                        € {(riepilogo.compensoSalvato > 0 ? riepilogo.compensoSalvato : riepilogo.compensoCalcolato).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
                {riepilogo && !riepilogo.compensoPagato && (
                  <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#888', fontStyle: 'italic' }}>
                    ⏳ In attesa di pagamento da parte del coordinatore.
                  </p>
                )}
                {riepilogo?.compensoPagato && (
                  <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#059669', fontWeight: '600' }}>
                    ✅ Compenso già pagato.
                  </p>
                )}
              </div>
            )}

            {/* ── REGISTRAZIONE ACCESSO (tutti i tipi di piano) ── */}
            <div style={{ background: accessoAperto ? 'rgba(5,150,105,0.06)' : 'rgba(30,77,140,0.04)', border: `1px solid ${accessoAperto ? 'rgba(5,150,105,0.3)' : 'rgba(30,77,140,0.2)'}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 10px', color: accessoAperto ? '#065f46' : '#1e4d8c' }}>
                {accessoAperto ? '🟢 Accesso in corso' : '🔵 Registra accesso'}
              </h4>
              {accessoAperto && (
                <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#374151' }}>
                  Entrata: <strong>{formatOra(accessoAperto.oraEntrata)}</strong> del <strong>{formatData(accessoAperto.oraEntrata)}</strong>
                </p>
              )}
              <label style={{ display: 'block', marginBottom: '12px' }}>
                Note accesso (opzionale)
                <input value={noteAccesso} onChange={e => setNoteAccesso(e.target.value)} placeholder="Es. parametri rilevati, attività svolte..." style={{ marginTop: '4px' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={registraEntrata}
                  disabled={!!accessoAperto || registrandoAccesso}
                  style={{
                    padding: '14px', borderRadius: '10px', border: 'none',
                    cursor: accessoAperto ? 'not-allowed' : 'pointer',
                    backgroundColor: accessoAperto ? '#d1fae5' : '#16a34a',
                    color: 'white', fontWeight: '700', fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: accessoAperto ? 0.6 : 1,
                  }}
                >
                  ▶️ ENTRATA
                </button>
                <button
                  type="button"
                  onClick={registraUscita}
                  disabled={!accessoAperto || registrandoAccesso}
                  style={{
                    padding: '14px', borderRadius: '10px', border: 'none',
                    cursor: !accessoAperto ? 'not-allowed' : 'pointer',
                    backgroundColor: !accessoAperto ? '#fee2e2' : '#dc2626',
                    color: 'white', fontWeight: '700', fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: !accessoAperto ? 0.6 : 1,
                  }}
                >
                  ⏹️ USCITA
                </button>
              </div>
              {registrandoAccesso && (
                <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#888', textAlign: 'center' }}>⏳ Registrazione in corso...</p>
              )}
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
                    <h6 style={{ margin: '0 0 10px', color: '#374151', fontWeight: '600' }}>📊 Parametri vitali (opzionali)</h6>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                      {PARAMETRI_VITALI.map(({ key, label, unit, step }) => (
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
                  📄 Esporta / Visualizza PDF
                </button>
              </div>

              {showExport && (
                <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
                  <h5 style={{ margin: '0 0 12px', color: '#374151' }}>📄 Esporta registro accessi (rendicontazione)</h5>
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
                        🖨️ Visualizza PDF
                      </button>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#888' }}>Lascia vuoto per il mese corrente. Il PDF non include le tariffe.</p>

                  {exportData && (
                    <div ref={printRef} style={{ marginTop: '16px', background: '#fff', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <h1>Registro Accessi — {exportData.piano.paziente}</h1>
                      <h2>Operatore: {exportData.piano.operatore} ({exportData.piano.ruoloOperatore})</h2>
                      <p><strong>Attività:</strong> {exportData.piano.task}</p>
                      <p><strong>Periodo:</strong> {exportData.periodo.da} — {exportData.periodo.a}</p>
                      <table>
                        <thead>
                          <tr><th>Data</th><th>Entrata</th><th>Uscita</th><th>Durata</th><th>Note</th></tr>
                        </thead>
                        <tbody>
                          {exportData.accessi.map((acc: any, i: number) => (
                            <tr key={i}>
                              <td>{acc.data}</td>
                              <td>{acc.oraEntrata}</td>
                              <td>{acc.oraUscita || '—'}</td>
                              <td>{acc.durataOre}</td>
                              <td>{acc.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="riepilogo">
                        <p><strong>Totale accessi:</strong> {exportData.riepilogo.totaleAccessi}</p>
                        <p><strong>Ore totali:</strong> {exportData.riepilogo.oreTotali}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

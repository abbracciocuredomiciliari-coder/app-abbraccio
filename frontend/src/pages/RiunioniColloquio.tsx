import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// RIUNIONI COLLOQUIO — area Intermediazioni.
// Come le Riunioni Équipe (stanza Jitsi, registrazione microfono, verbale AI)
// ma i partecipanti — badanti, colf, famiglie — NON devono avere un account:
// accettano l'invito da un link pubblico ricevuto via email e il giorno
// dell'appuntamento ricevono il promemoria con il link di collegamento.
// ═══════════════════════════════════════════════════════════════════════════

type Partecipante = {
  nome: string; email: string; ruolo: string; telefono?: string; staffId?: string;
  invitatoIl?: string; risposta: 'attesa' | 'accettato' | 'rifiutato'; rispostoIl?: string; notaRisposta?: string;
};
type Colloquio = {
  _id: string; titolo: string; dataRiunione: string; ordineDelGiorno: string;
  modalita: 'video' | 'presenza' | 'telefono'; stanzaVideo: string; linkCollegamento?: string;
  partecipanti: Partecipante[]; registrazioneInCorso?: boolean; registrazioneIniziataIl?: string;
  trascrizione?: string; verbale?: string; stato: 'programmato' | 'svolto' | 'annullato';
  promemoriaInviatoIl?: string; creatoDaNome: string;
};
type StaffOption = { _id: string; firstName: string; lastName: string; email: string; phone?: string; category?: string; role?: string; modalitaAbilitata?: string; areaIntermediazione?: boolean };
type NuovoPartecipante = { nome: string; email: string; telefono: string; ruolo: string; staffId?: string };

const managers = ['admin', 'coordinator', 'direttore'];
const btn = (background = '#0f766e'): React.CSSProperties => ({ padding: '10px 14px', border: 0, borderRadius: 7, background, color: 'white', fontWeight: 700, cursor: 'pointer' });
const modalitaLabel: Record<string, string> = { video: '🎥 Videochiamata', presenza: '🏢 In presenza', telefono: '📞 Telefonata' };
const ruoloLabel: Record<string, string> = { badante: 'Badante/Colf', famiglia: 'Famiglia', operatore: 'Operatore', altro: 'Altro' };
const rispostaUI: Record<string, { icona: string; testo: string; colore: string }> = {
  accettato: { icona: '✅', testo: 'ha accettato', colore: '#15803d' },
  rifiutato: { icona: '❌', testo: 'ha rifiutato', colore: '#b91c1c' },
  attesa: { icona: '⏳', testo: 'in attesa di risposta', colore: '#b45309' },
};
const statoUI: Record<string, { testo: string; bg: string }> = {
  programmato: { testo: '📅 programmato', bg: '#dbeafe' },
  svolto: { testo: '✅ svolto', bg: '#dcfce7' },
  annullato: { testo: '🚫 annullato', bg: '#fee2e2' },
};

export default function RiunioniColloquio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = managers.includes(user?.role || '');

  const [items, setItems] = useState<Colloquio[]>([]);
  const [current, setCurrent] = useState<Colloquio | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ titolo: '', dataRiunione: new Date().toISOString().slice(0, 16), ordineDelGiorno: '', modalita: 'video' as 'video' | 'presenza' | 'telefono', linkCollegamento: '' });
  const [partecipanti, setPartecipanti] = useState<NuovoPartecipante[]>([]);
  const [esterno, setEsterno] = useState<NuovoPartecipante>({ nome: '', email: '', telefono: '', ruolo: 'famiglia' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const chunksRef = useRef<Blob[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.get('/colloqui-intermediazione');
      setItems(list.data);
      if (id) setCurrent((await api.get(`/colloqui-intermediazione/${id}`)).data);
    } catch (e: any) { setError(e.response?.data?.message || 'Errore nel caricamento dei colloqui.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!isManager) return;
    api.get('/staff', { params: { active: 'true' } })
      .then(r => setStaff((r.data || []).filter((s: StaffOption) => s.areaIntermediazione || s.modalitaAbilitata === 'intermediazione')))
      .catch(() => setStaff([]));
  }, [isManager]);

  useEffect(() => { if (!recording) return; const t = window.setInterval(() => setSeconds(s => s + 1), 1000); return () => window.clearInterval(t); }, [recording]);
  useEffect(() => () => streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop())), []);

  const aggiungiStaff = (s: StaffOption, aggiungi: boolean) => {
    const nome = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email;
    setPartecipanti(prev => aggiungi
      ? [...prev, { nome, email: s.email, telefono: s.phone || '', ruolo: 'badante', staffId: s._id }]
      : prev.filter(p => p.staffId !== s._id));
  };
  const aggiungiEsterno = () => {
    if (!esterno.nome.trim() || !/^\S+@\S+\.\S+$/.test(esterno.email.trim())) { setError('Inserisci nome e una email valida per il partecipante.'); return; }
    setPartecipanti(prev => [...prev, { ...esterno, nome: esterno.nome.trim(), email: esterno.email.trim().toLowerCase() }]);
    setEsterno({ nome: '', email: '', telefono: '', ruolo: 'famiglia' });
    setError('');
  };

  const crea = async () => {
    setSaving(true); setError('');
    try {
      const res = await api.post('/colloqui-intermediazione', {
        titolo: form.titolo, dataRiunione: new Date(form.dataRiunione).toISOString(),
        ordineDelGiorno: form.ordineDelGiorno, modalita: form.modalita,
        linkCollegamento: form.linkCollegamento || undefined,
        partecipanti,
      });
      setShowCreate(false); setPartecipanti([]);
      setInfo(`Colloquio creato — inviti email inviati: ${res.data.emailInviate ?? 0}`);
      navigate(`/riunioni-colloquio/${res.data._id}`);
    } catch (e: any) { setError(e.response?.data?.message || 'Impossibile creare il colloquio.'); }
    finally { setSaving(false); }
  };

  // ── Registrazione microfono → trascrizione → verbale AI ──────────────────
  const startRecording = async () => {
    if (!current || !window.confirm('Confermi di aver informato tutti i partecipanti? Verrà registrato temporaneamente il microfono di questo dispositivo per trascrivere il verbale; la registrazione non sarà archiviata.')) return;
    try {
      setError(''); setSeconds(0); chunksRef.current = [];
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current = [microphone];
      const recorder = new MediaRecorder(microphone, MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = ev => { if (ev.data.size) chunksRef.current.push(ev.data); };
      recorder.onstop = async () => {
        setRecording(false);
        api.post(`/colloqui-intermediazione/${current._id}/recording-status`, { attiva: false }).catch(() => undefined);
        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        if (!chunksRef.current.length) { setError('Nessun audio catturato dal microfono. Verifica l’autorizzazione e riprova.'); return; }
        setProcessing(true);
        try {
          const body = new FormData();
          body.append('audio', new Blob(chunksRef.current, { type: 'audio/webm' }), 'colloquio.webm');
          body.append('confermaInformativaTrascrizione', 'true');
          const res = await api.post(`/colloqui-intermediazione/${current._id}/transcribe`, body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 240000 });
          setCurrent(prev => prev ? { ...prev, trascrizione: res.data.trascrizione } : prev);
        } catch (e: any) { setError(e.response?.data?.message || 'Trascrizione non riuscita.'); }
        finally { setProcessing(false); }
      };
      await api.post(`/colloqui-intermediazione/${current._id}/recording-status`, { attiva: true });
      recorder.start(1000); setRecording(true);
    } catch { setError('Registrazione non avviata. Consenti l’uso del microfono nelle impostazioni del browser e riprova.'); }
  };
  const stopRecording = () => { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); };
  const generateMinutes = async () => {
    if (!current) return;
    setProcessing(true);
    try { setCurrent((await api.post(`/colloqui-intermediazione/${current._id}/generate-minutes`)).data); }
    catch (e: any) { setError(e.response?.data?.message || 'Impossibile generare il verbale.'); }
    finally { setProcessing(false); }
  };
  const salvaVerbale = async () => {
    if (!current) return;
    try { setCurrent((await api.patch(`/colloqui-intermediazione/${current._id}`, { verbale: current.verbale || '' })).data); setInfo('Verbale salvato.'); }
    catch (e: any) { setError(e.response?.data?.message || 'Impossibile salvare il verbale.'); }
  };
  const cambiaStato = async (stato: string) => {
    if (!current) return;
    try { setCurrent((await api.patch(`/colloqui-intermediazione/${current._id}`, { stato })).data); }
    catch (e: any) { setError(e.response?.data?.message || 'Impossibile aggiornare lo stato.'); }
  };
  const reinviaInviti = async () => {
    if (!current || !window.confirm('Reinviare l\'invito via email ai partecipanti che non hanno ancora risposto?')) return;
    try { const res = await api.post(`/colloqui-intermediazione/${current._id}/reinvia-inviti`); setInfo(res.data.message); await load(); }
    catch (e: any) { setError(e.response?.data?.message || 'Reinvio non riuscito.'); }
  };
  const inviaPromemoria = async () => {
    if (!current || !window.confirm('Inviare ORA il promemoria con il link di collegamento ai partecipanti?')) return;
    try { const res = await api.post(`/colloqui-intermediazione/${current._id}/promemoria`); setInfo(res.data.message); await load(); }
    catch (e: any) { setError(e.response?.data?.message || 'Invio promemoria non riuscito.'); }
  };
  const elimina = async () => {
    if (!current || !window.confirm('Eliminare definitivamente questo colloquio?')) return;
    try { await api.delete(`/colloqui-intermediazione/${current._id}`); navigate('/riunioni-colloquio'); }
    catch (e: any) { setError(e.response?.data?.message || 'Impossibile eliminare il colloquio.'); }
  };
  const linkVideo = current ? (current.linkCollegamento || (current.modalita === 'video' ? `https://meet.jit.si/${current.stanzaVideo}` : '')) : '';
  const print = () => {
    if (!current) return;
    const win = window.open('', '_blank'); if (!win) return;
    const righe = current.partecipanti.map(p => `<p><strong>${p.nome}</strong> (${ruoloLabel[p.ruolo] || p.ruolo}) — ${rispostaUI[p.risposta].testo}${p.rispostoIl ? ` il ${new Date(p.rispostoIl).toLocaleString('it-IT')}` : ''}</p>`).join('');
    win.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Verbale colloquio</title><style>body{font-family:Arial;max-width:800px;margin:auto;padding:28px}.box{white-space:pre-wrap;border:1px solid #94a3b8;padding:12px}</style></head><body><h1>VERBALE RIUNIONE COLLOQUIO</h1><p><strong>${current.titolo}</strong><br>${new Date(current.dataRiunione).toLocaleString('it-IT')}<br>Motivo: ${current.ordineDelGiorno}</p><h3>Verbale</h3><div class="box">${(current.verbale || '').replace(/</g, '&lt;')}</div><h3>Partecipanti</h3>${righe}<script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  if (loading) return <div className="tw-p-6">Caricamento colloqui...</div>;

  // ══ VISTA DETTAGLIO ═══════════════════════════════════════════════════════
  if (current) {
    const accettati = current.partecipanti.filter(p => p.risposta === 'accettato').length;
    const inAttesa = current.partecipanti.filter(p => p.risposta === 'attesa').length;
    const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    return (
      <main className="tw-p-[18px] tw-max-w-[1100px] tw-mx-auto">
        <button onClick={() => navigate('/riunioni-colloquio')} className="tw-border-0 tw-bg-transparent tw-text-teal-700 tw-cursor-pointer">← Tutti i colloqui</button>
        {error && <p className="tw-p-2.5 tw-bg-red-50 tw-text-red-700">{error}</p>}
        {info && <p className="tw-p-2.5 tw-bg-green-50 tw-text-green-700">{info}</p>}

        <header className="tw-flex tw-justify-between tw-gap-3 tw-flex-wrap">
          <div>
            <h2 className="tw-text-teal-700 tw-mb-1">💬 {current.titolo}</h2>
            <p>📅 {new Date(current.dataRiunione).toLocaleString('it-IT')} · {modalitaLabel[current.modalita]} · <span style={{ background: statoUI[current.stato].bg, padding: '2px 10px', borderRadius: 999, fontSize: '.82rem', fontWeight: 700 }}>{statoUI[current.stato].testo}</span></p>
            <p className="tw-text-sm tw-text-slate-600">{accettati} accettazioni · {inAttesa} in attesa{current.promemoriaInviatoIl ? ` · 📨 promemoria inviato ${new Date(current.promemoriaInviatoIl).toLocaleString('it-IT')}` : ''}</p>
          </div>
          <div className="tw-flex tw-gap-2 tw-items-start tw-flex-wrap">
            <button onClick={print} style={btn('#475569')}>🖨️ PDF / stampa</button>
            {isManager && <button onClick={elimina} style={btn('#dc2626')}>🗑️ Elimina</button>}
          </div>
        </header>

        {isManager && current.stato === 'programmato' && (
          <div className="tw-mt-3 tw-flex tw-gap-2 tw-flex-wrap">
            {inAttesa > 0 && <button onClick={reinviaInviti} style={btn('#f59e0b')}>📧 Reinvia inviti ({inAttesa})</button>}
            <button onClick={inviaPromemoria} style={btn('#2563eb')}>🔔 Invia promemoria ora</button>
            <button onClick={() => cambiaStato('svolto')} style={btn('#16a34a')}>✅ Segna svolto</button>
            <button onClick={() => cambiaStato('annullato')} style={btn('#64748b')}>🚫 Annulla colloquio</button>
          </div>
        )}

        {/* Partecipanti e stato accettazione */}
        <section className="tw-mt-4">
          <h3>Partecipanti</h3>
          {current.partecipanti.map((p, i) => (
            <div key={i} className="tw-py-2 tw-border-b tw-border-slate-200 tw-flex tw-justify-between tw-flex-wrap tw-gap-2">
              <span>{rispostaUI[p.risposta].icona} <strong>{p.nome}</strong> · {ruoloLabel[p.ruolo] || p.ruolo} · {p.email}</span>
              <span style={{ color: rispostaUI[p.risposta].colore, fontWeight: 700, fontSize: '.85rem' }}>
                {rispostaUI[p.risposta].testo}{p.rispostoIl ? ` — ${new Date(p.rispostoIl).toLocaleString('it-IT')}` : ''}{p.notaRisposta ? ` (${p.notaRisposta})` : ''}
              </span>
            </div>
          ))}
        </section>

        {/* Link + video */}
        {current.modalita === 'video' && linkVideo && (
          <>
            <p className="tw-mt-4 tw-text-sm">🔗 Link collegamento (inviato nel promemoria): <a href={linkVideo} target="_blank" rel="noreferrer">{linkVideo}</a></p>
            <h3>Videochiamata colloquio</h3>
            <iframe title="Videochiamata colloquio" src={`https://meet.jit.si/${current.stanzaVideo}#config.prejoinPageEnabled=true&config.disableRecording=true`} allow="camera; microphone; fullscreen; display-capture; autoplay" className="tw-w-full tw-h-[520px] tw-border-0 tw-rounded-[10px]" />
          </>
        )}
        {current.modalita !== 'video' && current.linkCollegamento && <p className="tw-mt-4">📍 {current.modalita === 'telefono' ? 'Numero da chiamare' : 'Luogo'}: <strong>{current.linkCollegamento}</strong></p>}

        {/* Registrazione → trascrizione → verbale AI */}
        <div className="tw-mt-4" style={{ padding: 12, background: recording ? '#fef2f2' : '#fffbeb', border: `1px solid ${recording ? '#ef4444' : '#fde68a'}`, borderRadius: 8 }}>
          <strong>{recording || current.registrazioneInCorso ? `🔴 REGISTRAZIONE AUDIO ATTIVA${recording ? ` · ${elapsed}` : ''}` : '🔒 Audio temporaneo per il verbale'}</strong><br />
          <small>La registrazione usa il microfono di questo dispositivo. Informare i partecipanti prima di avviare. Nessun audio viene archiviato.</small>
        </div>
        {isManager && (
          <div className="tw-mt-3 tw-flex tw-gap-2 tw-flex-wrap">
            <button onClick={recording ? stopRecording : startRecording} disabled={processing} style={btn(recording ? '#dc2626' : '#0f766e')}>
              {recording ? '⏹ Ferma registrazione e trascrivi' : processing ? 'Trascrizione in corso...' : '🎙 Avvia registrazione audio colloquio'}
            </button>
            {current.trascrizione && <button onClick={generateMinutes} disabled={processing} style={btn('#7c3aed')}>✨ AI — Genera verbale dalla trascrizione</button>}
          </div>
        )}

        <section className="tw-mt-4">
          <h3>Trascrizione</h3>
          <textarea readOnly value={current.trascrizione || ''} placeholder="Dopo la registrazione apparirà qui la trascrizione." rows={6} className="tw-w-full tw-box-border tw-p-2.5" />
          <h3>Verbale</h3>
          <textarea disabled={!isManager} value={current.verbale || ''} onChange={e => setCurrent({ ...current, verbale: e.target.value })} rows={12} placeholder="Scrivi, incolla o genera il verbale dalla trascrizione." className="tw-w-full tw-box-border tw-p-2.5" />
          {isManager && <button onClick={salvaVerbale} style={{ ...btn('#2563eb'), marginTop: 8 }}>💾 Salva verbale</button>}
        </section>
      </main>
    );
  }

  // ══ VISTA LISTA + CREAZIONE ═══════════════════════════════════════════════
  return (
    <main className="tw-p-[18px] tw-max-w-[1000px] tw-mx-auto">
      <header className="tw-flex tw-justify-between tw-gap-3 tw-flex-wrap">
        <div>
          <h2 className="tw-text-teal-700">💬 Riunioni Colloquio</h2>
          <p>Colloqui con badanti, colf e famiglie — con invito via email, accettazione senza login e verbale AI.</p>
        </div>
        {isManager && <button onClick={() => setShowCreate(v => !v)} style={btn()}>＋ Nuovo colloquio</button>}
      </header>
      {error && <p className="tw-text-red-700">{error}</p>}
      {info && <p className="tw-p-2.5 tw-bg-green-50 tw-text-green-700">{info}</p>}

      {showCreate && (
        <section className="tw-p-4 tw-border tw-border-teal-200 tw-rounded-[10px] tw-bg-teal-50 tw-grid tw-gap-2.5 tw-mb-5">
          <h3 className="tw-m-0">Nuovo colloquio</h3>
          <label>Modalità
            <select value={form.modalita} onChange={e => setForm({ ...form, modalita: e.target.value as any })} className="tw-block tw-w-full tw-p-[9px]">
              <option value="video">🎥 Videochiamata (link automatico)</option>
              <option value="presenza">🏢 In presenza</option>
              <option value="telefono">📞 Telefonata</option>
            </select>
          </label>
          <input placeholder="Titolo (es. Colloquio badante Sig.ra Rossi)" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} className="tw-p-[9px]" />
          <label>Data e ora appuntamento
            <input type="datetime-local" value={form.dataRiunione} onChange={e => setForm({ ...form, dataRiunione: e.target.value })} className="tw-block tw-w-full tw-p-[9px]" />
          </label>
          <textarea placeholder="Motivo del colloquio / ordine del giorno" value={form.ordineDelGiorno} onChange={e => setForm({ ...form, ordineDelGiorno: e.target.value })} rows={3} className="tw-p-[9px]" />
          {form.modalita === 'video' && <input placeholder="Link video alternativo (facoltativo — se vuoto si crea in automatico)" value={form.linkCollegamento} onChange={e => setForm({ ...form, linkCollegamento: e.target.value })} className="tw-p-[9px]" />}
          {form.modalita === 'presenza' && <input placeholder="Luogo del colloquio (indirizzo)" value={form.linkCollegamento} onChange={e => setForm({ ...form, linkCollegamento: e.target.value })} className="tw-p-[9px]" />}
          {form.modalita === 'telefono' && <input placeholder="Numero da chiamare (facoltativo)" value={form.linkCollegamento} onChange={e => setForm({ ...form, linkCollegamento: e.target.value })} className="tw-p-[9px]" />}

          <strong>Personale intermediazioni (badanti/colf)</strong>
          <div className="tw-max-h-[160px] tw-overflow-y-auto tw-bg-white tw-p-2">
            {staff.length === 0 && <p className="tw-text-slate-500 tw-text-sm">Nessun membro del personale intermediazioni — aggiungi sotto a mano.</p>}
            {staff.map(s => (
              <label key={s._id} className="tw-block tw-p-1 tw-cursor-pointer">
                <input type="checkbox" checked={partecipanti.some(p => p.staffId === s._id)} onChange={e => aggiungiStaff(s, e.target.checked)} /> {s.firstName} {s.lastName} — {s.role || s.category} ({s.email})
              </label>
            ))}
          </div>

          <strong>Famiglia o altro partecipante (senza account)</strong>
          <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-4 tw-gap-2">
            <input placeholder="Nome e cognome" value={esterno.nome} onChange={e => setEsterno({ ...esterno, nome: e.target.value })} className="tw-p-[9px]" />
            <input placeholder="Email" value={esterno.email} onChange={e => setEsterno({ ...esterno, email: e.target.value })} className="tw-p-[9px]" />
            <input placeholder="Telefono (facoltativo)" value={esterno.telefono} onChange={e => setEsterno({ ...esterno, telefono: e.target.value })} className="tw-p-[9px]" />
            <select value={esterno.ruolo} onChange={e => setEsterno({ ...esterno, ruolo: e.target.value })} className="tw-p-[9px]">
              <option value="famiglia">Famiglia</option>
              <option value="badante">Badante/Colf</option>
              <option value="operatore">Operatore</option>
              <option value="altro">Altro</option>
            </select>
          </div>
          <button onClick={aggiungiEsterno} style={{ ...btn('#64748b'), justifySelf: 'start' }}>＋ Aggiungi partecipante</button>

          {partecipanti.length > 0 && (
            <div className="tw-flex tw-flex-wrap tw-gap-2">
              {partecipanti.map((p, i) => (
                <span key={i} style={{ background: '#fff', border: '1px solid #99f6e4', borderRadius: 999, padding: '4px 10px', fontSize: '.85rem' }}>
                  {p.nome} · {ruoloLabel[p.ruolo]} <button onClick={() => setPartecipanti(prev => prev.filter((_, j) => j !== i))} style={{ border: 0, background: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </span>
              ))}
            </div>
          )}

          <button onClick={crea} disabled={saving} style={{ ...btn(), justifySelf: 'start' }}>
            {saving ? 'Creazione e invio inviti...' : '📧 Crea colloquio e invia gli inviti email'}
          </button>
        </section>
      )}

      {!items.length && !showCreate && <p className="tw-text-slate-500">Nessun colloquio programmato. Creane uno con il pulsante in alto.</p>}
      {items.map(c => {
        const acc = c.partecipanti.filter(p => p.risposta === 'accettato').length;
        const rif = c.partecipanti.filter(p => p.risposta === 'rifiutato').length;
        const att = c.partecipanti.length - acc - rif;
        return (
          <button key={c._id} onClick={() => navigate(`/riunioni-colloquio/${c._id}`)} className="tw-w-full tw-text-left tw-p-3.5 tw-mb-2.5 tw-bg-white tw-border tw-border-slate-200 tw-rounded-[10px] tw-cursor-pointer">
            <div className="tw-flex tw-justify-between tw-flex-wrap tw-gap-2">
              <div>
                <strong>{c.titolo}</strong><br />
                <span className="tw-text-sm tw-text-slate-600">📅 {new Date(c.dataRiunione).toLocaleString('it-IT')} · {modalitaLabel[c.modalita]}</span>
              </div>
              <div className="tw-text-right">
                <span style={{ background: statoUI[c.stato].bg, padding: '2px 10px', borderRadius: 999, fontSize: '.8rem', fontWeight: 700 }}>{statoUI[c.stato].testo}</span><br />
                <span className="tw-text-xs tw-text-slate-500">✅ {acc} · ⏳ {att} · ❌ {rif}{c.promemoriaInviatoIl ? ' · 📨' : ''}{c.verbale ? ' · 📄 verbale' : ''}</span>
              </div>
            </div>
          </button>
        );
      })}
    </main>
  );
}

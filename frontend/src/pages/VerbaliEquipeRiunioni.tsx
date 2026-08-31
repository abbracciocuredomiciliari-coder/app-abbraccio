import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import FirmaCanvas from '../components/FirmaCanvas';

type Partecipante = { userId: string; nome: string; email: string; confermatoIl?: string; firma?: string; firmatoIl?: string; esterno?: boolean };
type Verbale = { _id: string; titolo: string; dataRiunione: string; ordineDelGiorno: string; stanzaVideo: string; registrazioneInCorso?: boolean; registrazioneIniziataIl?: string; modalita: 'video' | 'presenza'; allegato?: { nome: string; url: string; tipo: string }; partecipanti: Partecipante[]; trascrizione?: string; verbale?: string; stato: 'bozza' | 'in_firma' | 'firmato'; creatoDaNome: string };
type UserOption = { id: string; nome: string; email: string };
const managers = ['admin', 'coordinator', 'direttore'];
const button = (background = '#0f766e'): React.CSSProperties => ({ padding: '10px 14px', border: 0, borderRadius: 7, background, color: 'white', fontWeight: 700, cursor: 'pointer' });

export default function VerbaliEquipeRiunioni() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = managers.includes(user?.role || '');
  const [items, setItems] = useState<Verbale[]>([]);
  const [current, setCurrent] = useState<Verbale | null>(null);
  const [participants, setParticipants] = useState<UserOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ titolo: '', dataRiunione: new Date().toISOString().slice(0, 16), ordineDelGiorno: '', modalita: 'video' as 'video' | 'presenza', verbale: '', partecipanti: [] as string[] });
  const [file, setFile] = useState<File | null>(null);
  const [partecipantiEsterni, setPartecipantiEsterni] = useState<{ nome: string; email: string }[]>([]);
  const [esterno, setEsterno] = useState({ nome: '', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [firma, setFirma] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const chunksRef = useRef<Blob[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.get('/verbali-equipe');
      setItems(list.data);
      if (id) setCurrent((await api.get(`/verbali-equipe/${id}`)).data);
    } catch (e: any) { setError(e.response?.data?.message || 'Errore nel caricamento dei verbali.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (isManager) api.get('/verbali-equipe/participants').then(r => setParticipants(r.data)).catch(() => setParticipants([])); }, [isManager]);
  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setSeconds(s => s + 1), 1000); return () => window.clearInterval(timer); }, [recording]);
  useEffect(() => {
    if (!id) return;
    const refreshRecordingStatus = () => api.get(`/verbali-equipe/${id}`).then(response => setCurrent(previous => previous ? { ...previous, registrazioneInCorso: response.data.registrazioneInCorso, registrazioneIniziataIl: response.data.registrazioneIniziataIl } : response.data)).catch(() => undefined);
    const timer = window.setInterval(refreshRecordingStatus, 5000);
    return () => window.clearInterval(timer);
  }, [id]);
  useEffect(() => () => streamsRef.current.forEach(stream => stream.getTracks().forEach(track => track.stop())), []);

  const create = async () => {
    try {
      const data = new FormData();
      data.append('titolo', form.titolo); data.append('dataRiunione', new Date(form.dataRiunione).toISOString()); data.append('ordineDelGiorno', form.ordineDelGiorno); data.append('modalita', form.modalita); data.append('partecipanti', JSON.stringify(form.partecipanti)); data.append('partecipantiEsterni', JSON.stringify(partecipantiEsterni));
      if (form.verbale.trim()) data.append('verbale', form.verbale.trim());
      if (file) data.append('allegato', file);
      const res = await api.post('/verbali-equipe', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowCreate(false); navigate(`/verbali-equipe/${res.data._id}`);
    } catch (e: any) { setError(e.response?.data?.message || 'Impossibile creare la riunione.'); }
  };

  const startRecording = async () => {
    if (!current || !window.confirm('Confermi di aver informato tutti i partecipanti? Verrà registrato temporaneamente il microfono di questo dispositivo per trascrivere il verbale; la registrazione non sarà archiviata.')) return;
    try {
      setError(''); setSeconds(0); chunksRef.current = [];
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current = [microphone];
      const recorder = new MediaRecorder(microphone, MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        setRecording(false); api.post(`/verbali-equipe/${current._id}/recording-status`, { attiva: false }).catch(() => undefined); streamsRef.current.forEach(stream => stream.getTracks().forEach(track => track.stop()));
        if (!chunksRef.current.length) { setError('Nessun audio catturato dal microfono. Verifica l’autorizzazione del microfono e riprova.'); return; }
        setProcessing(true);
        try {
          const body = new FormData(); body.append('audio', new Blob(chunksRef.current, { type: 'audio/webm' }), 'riunione.webm'); body.append('confermaInformativaTrascrizione', 'true');
          const res = await api.post(`/verbali-equipe/${current._id}/transcribe`, body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 240000 });
          setCurrent(previous => previous ? { ...previous, trascrizione: res.data.trascrizione } : previous);
        } catch (e: any) { setError(e.response?.data?.message || 'Trascrizione non riuscita.'); }
        finally { setProcessing(false); }
      };
      await api.post(`/verbali-equipe/${current._id}/recording-status`, { attiva: true });
      recorder.start(1000); setRecording(true);
    } catch { setError('Registrazione non avviata. Consenti l’uso del microfono nelle impostazioni del browser e riprova.'); }
  };
  const stopRecording = () => { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); };
  const generateMinutes = async () => { if (!current) return; setProcessing(true); try { const res = await api.post(`/verbali-equipe/${current._id}/generate-minutes`); setCurrent(res.data); } catch (e: any) { setError(e.response?.data?.message || 'Impossibile generare il verbale.'); } finally { setProcessing(false); } };
  const saveMinutes = async () => { if (!current) return; try { const res = await api.patch(`/verbali-equipe/${current._id}`, { verbale: current.verbale || '' }); setCurrent(res.data); } catch (e: any) { setError(e.response?.data?.message || 'Impossibile salvare la bozza.'); } };
  const confirmAttendance = async () => { if (!current) return; try { setCurrent((await api.post(`/verbali-equipe/${current._id}/confirm-attendance`)).data); } catch (e: any) { setError(e.response?.data?.message || 'Impossibile confermare la partecipazione.'); } };
  const requestSignatures = async () => {
    if (!current) return;
    const isResend = current.stato === 'in_firma';
    const msg = isResend ? 'Reinviare il link di firma ai partecipanti che non hanno ancora firmato?' : 'Inviare ora il link di firma via email a tutti i partecipanti?';
    if (!window.confirm(msg)) return;
    try {
      const res = await api.post(`/verbali-equipe/${current._id}/request-signatures`);
      setCurrent(res.data.verbale);
      const dettagli: any[] = res.data.dettagli || [];
      const nonInviate = dettagli.filter((d: any) => !d.success).map((d: any) => d.email).join(', ');
      let text = `Inviate: ${res.data.emailInviate || 0} di ${res.data.totale || 0}`;
      if (nonInviate) text += `\nNon inviate: ${nonInviate}`;
      alert(text);
    } catch (e: any) { setError(e.response?.data?.message || 'Invio richieste firma non riuscito.'); }
  };
  const sign = async () => { if (!current || !firma) return; try { setCurrent((await api.post(`/verbali-equipe/${current._id}/sign`, { firma })).data); setFirma(''); } catch (e: any) { setError(e.response?.data?.message || 'Firma non riuscita.'); } };
  const eliminaRiunione = async () => {
    if (!current || !window.confirm('Eliminare definitivamente questa riunione saltata? L’operazione è consentita solo per bozze senza firme.')) return;
    try {
      await api.delete(`/verbali-equipe/${current._id}`);
      navigate('/verbali-equipe');
    } catch (e: any) { setError(e.response?.data?.message || 'Impossibile eliminare la riunione.'); }
  };
  const print = () => { if (!current) return; const win = window.open('', '_blank'); if (!win) return; const signatures = current.partecipanti.map(p => `<p><strong>${p.nome}</strong> — ${p.firma ? (p.esterno ? 'firmato' : p.firmatoIl ? `firmato ${new Date(p.firmatoIl).toLocaleString('it-IT')}` : 'firmato') : 'firma in attesa'}${p.firma ? `<br><img src="${p.firma}" style="height:60px">` : ''}</p>`).join(''); win.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Verbale équipe</title><style>body{font-family:Arial;max-width:800px;margin:auto;padding:28px}.box{white-space:pre-wrap;border:1px solid #94a3b8;padding:12px}img{max-width:220px}</style></head><body><h1>VERBALE RIUNIONE ÉQUIPE</h1><p><strong>${current.titolo}</strong><br>${new Date(current.dataRiunione).toLocaleString('it-IT')}<br>Ordine del giorno: ${current.ordineDelGiorno}</p><h3>Verbale</h3><div class="box">${(current.verbale || '').replace(/</g, '&lt;')}</div><h3>Partecipanti e firme</h3>${signatures}<script>window.onload=()=>window.print()</script></body></html>`); win.document.close(); };

  if (loading) return <div className="tw-p-6">Caricamento verbali...</div>;
  if (current) {
    const me = current.partecipanti.find(p => p.userId === user?.id);
    const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    return <main className="tw-p-[18px] tw-max-w-[1100px] tw-mx-auto"><button onClick={() => navigate('/verbali-equipe')} className="tw-border-0 tw-bg-transparent tw-text-teal-700 tw-cursor-pointer">← Tutti i verbali</button>{error && <p className="tw-p-2.5 tw-bg-red-50 tw-text-red-700">{error}</p>}<header className="tw-flex tw-justify-between tw-gap-3 tw-flex-wrap"><div><h2 className="tw-text-teal-700 tw-mb-1">👥 {current.titolo}</h2><p>📅 {new Date(current.dataRiunione).toLocaleString('it-IT')} · {current.modalita === 'presenza' ? 'Riunione in presenza' : 'Video riunione'}</p></div><div className="tw-flex tw-gap-2 tw-items-start tw-flex-wrap"><button onClick={print} style={button('#475569')}>🖨️ PDF / stampa</button>{isManager && current.stato === 'bozza' && !current.registrazioneInCorso && !current.partecipanti.some(p => p.firma) && <button onClick={eliminaRiunione} style={button('#dc2626')}>🗑️ Elimina riunione saltata</button>}</div></header>{current.modalita === 'video' && <><div style={{ padding: 12, background: recording ? '#fef2f2' : '#fffbeb', border: `1px solid ${recording ? '#ef4444' : '#fde68a'}`, borderRadius: 8 }}><strong>{recording || current.registrazioneInCorso ? `🔴 REGISTRAZIONE AUDIO ATTIVA${recording ? ` · ${elapsed}` : ''}` : '🔒 Audio temporaneo per verbale'}</strong><br /><small>La registrazione usa il microfono del dispositivo dell’organizzatore. Quando è attiva, l’avviso rosso è visibile a tutti i partecipanti. Nessun audio viene archiviato.</small></div><h3>Videochiamata équipe</h3><iframe title="Videochiamata équipe" src={`https://meet.jit.si/${current.stanzaVideo}#config.prejoinPageEnabled=true&config.disableRecording=true`} allow="camera; microphone; fullscreen; display-capture; autoplay" className="tw-w-full tw-h-[520px] tw-border-0 tw-rounded-[10px]" />{isManager && current.stato === 'bozza' && <div className="tw-mt-3 tw-flex tw-gap-2 tw-flex-wrap"><button onClick={recording ? stopRecording : startRecording} disabled={processing} style={button(recording ? '#dc2626' : '#0f766e')}>{recording ? '⏹ Ferma registrazione e trascrivi' : processing ? 'Trascrizione in corso...' : '🎙 Avvia registrazione audio riunione'}</button>{current.trascrizione && <button onClick={generateMinutes} disabled={processing} style={button('#7c3aed')}>✨ ALL - Genera verbale dalla trascrizione</button>}</div>}</>}{current.allegato && <p><a href={current.allegato.url} target="_blank" rel="noreferrer">📎 Apri verbale allegato: {current.allegato.nome}</a></p>}<section className="tw-mt-4.5"><h3>Trascrizione</h3><textarea readOnly value={current.trascrizione || ''} placeholder="Dopo la registrazione apparirà qui la trascrizione." rows={7} className="tw-w-full tw-box-border tw-p-2.5" /><h3>Verbale</h3><textarea disabled={!isManager || current.stato !== 'bozza'} value={current.verbale || ''} onChange={e => setCurrent({ ...current, verbale: e.target.value })} rows={12} placeholder="Scrivi, incolla o genera il verbale dalla trascrizione." className="tw-w-full tw-box-border tw-p-2.5" />{isManager && current.stato === 'bozza' && <div className="tw-mt-2 tw-flex tw-gap-2"><button onClick={saveMinutes} style={button('#2563eb')}>Salva bozza verbale</button>{(current.verbale || current.allegato) && <button onClick={requestSignatures} style={button('#7c3aed')}>📧 Invia link firma a partecipanti</button>}</div>}{isManager && current.stato === 'in_firma' && (current.verbale || current.allegato) && <div className="tw-mt-2 tw-flex tw-gap-2"><button onClick={requestSignatures} style={button('#f59e0b')}>📧 Reinvia inviti ai partecipanti</button></div>}</section><section className="tw-mt-4.5"><h3>Partecipanti</h3>{current.partecipanti.map(p => <div key={p.userId} className="tw-py-2 tw-px-0 tw-border-b tw-border-slate-200">{p.firma ? '✅' : '⌛'} {p.nome} · {p.confermatoIl ? 'partecipazione confermata' : 'da confermare'} · {p.firma ? (p.esterno ? 'firmato' : p.firmatoIl ? `firmato ${new Date(p.firmatoIl).toLocaleString('it-IT')}` : 'firmato') : 'firma in attesa'}</div>)}{me && !me.confermatoIl && current.stato === 'bozza' && <button onClick={confirmAttendance} style={{ ...button('#2563eb'), marginTop: 10 }}>✅ Conferma partecipazione</button>}{me && current.stato === 'in_firma' && !me.firma && <div className="tw-mt-4"><FirmaCanvas label="Firma il verbale" sublabel="Firma con dito o penna" onFirmaCompleta={setFirma} onCancella={() => setFirma('')} altezza={140} /><button onClick={sign} disabled={!firma} style={button()}>✍️ Firma verbale</button></div>}</section></main>;
  }
  return <main className="tw-p-[18px] tw-max-w-[1000px] tw-mx-auto"><header className="tw-flex tw-justify-between tw-gap-3 tw-flex-wrap"><div><h2 className="tw-text-teal-700">👥 Verbali riunione équipe</h2><p>Video riunioni, verbali in presenza, trascrizioni e firme digitali.</p></div>{isManager && <button onClick={() => setShowCreate(v => !v)} style={button()}>＋ Nuovo verbale / riunione</button>}</header>{error && <p className="tw-text-red-700">{error}</p>}{showCreate && <section className="tw-p-4 tw-border tw-border-teal-200 tw-rounded-[10px] tw-bg-teal-50 tw-grid tw-gap-2.5"><h3 className="tw-m-0">Nuova riunione o verbale in presenza</h3><label>Modalità<select value={form.modalita} onChange={e => setForm({ ...form, modalita: e.target.value as 'video' | 'presenza' })} className="tw-block tw-w-full tw-p-[9px]"><option value="video">Video riunione</option><option value="presenza">Riunione in presenza</option></select></label><input placeholder="Titolo" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} className="tw-p-[9px]" /><input type="datetime-local" value={form.dataRiunione} onChange={e => setForm({ ...form, dataRiunione: e.target.value })} className="tw-p-[9px]" /><textarea placeholder="Ordine del giorno" value={form.ordineDelGiorno} onChange={e => setForm({ ...form, ordineDelGiorno: e.target.value })} rows={3} className="tw-p-[9px]" />{form.modalita === 'presenza' && <><textarea placeholder="Incolla o scrivi il testo del verbale in presenza" value={form.verbale} onChange={e => setForm({ ...form, verbale: e.target.value })} rows={7} className="tw-p-[9px]" /><label>Allega il verbale (PDF, DOC, DOCX o TXT)<input type="file" accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain" onChange={e => setFile(e.target.files?.[0] || null)} /></label></>}<strong>Operatori App Abbraccio</strong><div className="tw-max-h-[180px] tw-overflow-y-auto tw-bg-white tw-p-2">{participants.map(p => <label key={p.id} className="tw-block tw-p-1"><input type="checkbox" checked={form.partecipanti.includes(p.id)} onChange={e => setForm({ ...form, partecipanti: e.target.checked ? [...form.partecipanti, p.id] : form.partecipanti.filter(value => value !== p.id) })} /> {p.nome} · {p.email}</label>)}</div><strong>Operatore esterno (senza account)</strong><div className="tw-flex tw-gap-2 tw-flex-wrap"><input placeholder="Nome e cognome" value={esterno.nome} onChange={e => setEsterno({ ...esterno, nome: e.target.value })} className="tw-p-[9px] tw-flex-1" /><input type="email" placeholder="Email" value={esterno.email} onChange={e => setEsterno({ ...esterno, email: e.target.value })} className="tw-p-[9px] tw-flex-1" /><button type="button" onClick={() => { if (esterno.nome.trim() && /^\S+@\S+\.\S+$/.test(esterno.email.trim())) { setPartecipantiEsterni([...partecipantiEsterni, { nome: esterno.nome.trim(), email: esterno.email.trim() }]); setEsterno({ nome: '', email: '' }); } }} style={button('#475569')}>Aggiungi esterno</button></div>{partecipantiEsterni.map((p, index) => <div key={`${p.email}-${index}`} className="tw-flex tw-justify-between tw-px-2.5 tw-py-2 tw-rounded-md tw-bg-cyan-50"><span>{p.nome} · {p.email}</span><button type="button" onClick={() => setPartecipantiEsterni(partecipantiEsterni.filter((_, itemIndex) => itemIndex !== index))} className="tw-border-0 tw-bg-transparent tw-text-red-700 tw-cursor-pointer">Rimuovi</button></div>)}<button onClick={create} style={button()}>{form.modalita === 'presenza' ? 'Archivia e invia inviti' : 'Crea riunione e invia inviti'}</button></section>}<section className="tw-grid tw-gap-2.5 tw-mt-4">{items.length ? items.map(v => <button key={v._id} onClick={() => navigate(`/verbali-equipe/${v._id}`)} className="tw-text-left tw-p-3.5 tw-border tw-border-slate-300 tw-rounded-lg tw-bg-white tw-cursor-pointer"><strong>{v.modalita === 'presenza' ? '📄' : '🎥'} {v.titolo}</strong><br /><small>{new Date(v.dataRiunione).toLocaleString('it-IT')} · {v.stato === 'firmato' ? '✅ Firmato' : v.stato === 'in_firma' ? '✍️ In firma' : '📝 Bozza'}</small></button>) : <p>Nessun verbale disponibile.</p>}</section></main>;
}

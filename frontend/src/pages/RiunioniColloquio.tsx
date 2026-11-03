import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/api';
import { Plus, Trash2, ArrowLeft, Video, Phone, MapPin, Send, Bell, FileText, Mic } from 'lucide-react';

const MODALITA: Record<string, { label: string; icon: any }> = {
  video: { label: 'Videochiamata', icon: Video },
  presenza: { label: 'Di persona', icon: MapPin },
  telefono: { label: 'Telefonata', icon: Phone },
};

export default function RiunioniColloquio() {
  const { id } = useParams();
  const nav = useNavigate();
  const [lista, setLista] = useState<any[]>([]);
  const [coll, setColl] = useState<any>(null);
  const [form, setForm] = useState(false);
  const [f, setF] = useState({ titolo: '', dataRiunione: '', ordineDelGiorno: '', modalita: 'video', linkCollegamento: '' });
  const [verbale, setVerbale] = useState('');
  const [err, setErr] = useState('');

  const carica = () => api.get('/colloqui-intermediazione').then(r => setLista(r.data.colloqui || r.data || [])).catch(() => {});
  useEffect(() => { if (id) api.get(`/colloqui-intermediazione/${id}`).then(r => { setColl(r.data.colloquio || r.data); setVerbale((r.data.colloquio || r.data).verbale || ''); }).catch(() => setErr('Colloquio non trovato')); else carica(); }, [id]);

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/colloqui-intermediazione', { ...f, partecipanti: [] });
      setForm(false); setF({ titolo: '', dataRiunione: '', ordineDelGiorno: '', modalita: 'video', linkCollegamento: '' });
      carica();
    } catch (e2: any) { setErr(e2?.response?.data?.message || 'Errore'); }
  }

  const salvaVerbale = () => api.patch(`/colloqui-intermediazione/${id}`, { verbale }).then(() => alert('Verbale salvato')).catch(() => setErr('Errore salvataggio'));
  const elimina = (cid: string) => { if (confirm('Eliminare?')) api.delete(`/colloqui-intermediazione/${cid}`).then(() => { setColl(null); nav('/riunioni-colloquio'); }); };
  const azione = (path: string, body?: any) => api.post(`/colloqui-intermediazione/${id}/${path}`, body).then(() => alert('Fatto')).catch((e: any) => alert(e?.response?.data?.message || 'Errore'));

  const inp = 'tw-w-full tw-px-3 tw-py-2 tw-border tw-border-slate-300 tw-rounded-lg tw-text-sm tw-mt-1';
  const lbl = 'tw-block tw-text-xs tw-font-bold tw-text-slate-600';

  // ── Dettaglio colloquio ────────────────────────────────────────────────────
  if (id) return (
    <div className="tw-p-4 tw-max-w-3xl tw-mx-auto">
      <button onClick={() => { setColl(null); nav('/riunioni-colloquio'); }} className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-blue-800 tw-font-bold tw-mb-4"><ArrowLeft size={15} /> Indietro</button>
      {err && <p className="tw-text-red-600">{err}</p>}
      {coll && (
        <div className="tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-shadow-sm tw-p-5">
          <div className="tw-flex tw-items-start tw-justify-between tw-flex-wrap tw-gap-2">
            <div>
              <h1 className="tw-text-lg tw-font-bold tw-text-slate-800">{coll.titolo || 'Colloquio'}</h1>
              {coll.dataRiunione && <p className="tw-text-sm tw-text-slate-500">{new Date(coll.dataRiunione).toLocaleString('it-IT')} · {MODALITA[coll.modalita]?.label || coll.modalita}</p>}
              {coll.linkCollegamento && <a href={coll.linkCollegamento} target="_blank" rel="noopener" className="tw-text-sm tw-text-blue-700 tw-font-semibold">🔗 Apri link colloquio</a>}
            </div>
            <button onClick={() => elimina(coll._id)} className="tw-p-2 tw-rounded-lg tw-bg-red-50 tw-text-red-600"><Trash2 size={16} /></button>
          </div>
          {coll.ordineDelGiorno && <div className="tw-mt-3 tw-bg-slate-50 tw-rounded-lg tw-p-3 tw-text-sm tw-whitespace-pre-wrap"><strong>Ordine del giorno:</strong><br />{coll.ordineDelGiorno}</div>}
          {(coll.partecipanti || []).length > 0 && (
            <div className="tw-mt-3">
              <strong className="tw-text-sm">Invitati:</strong>
              {coll.partecipanti.map((p: any, i: number) => (
                <div key={i} className="tw-text-sm tw-text-slate-600 tw-flex tw-gap-2 tw-items-center">
                  <span>{p.nome || p.email}</span>
                  {p.risposta && <span className={`tw-text-[0.7rem] tw-font-bold tw-px-2 tw-py-0.5 tw-rounded-full ${p.risposta === 'accettato' ? 'tw-bg-emerald-100 tw-text-emerald-700' : 'tw-bg-red-100 tw-text-red-700'}`}>{p.risposta}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mt-4">
            <button onClick={() => azione('reinvia-inviti')} className="tw-px-3 tw-py-2 tw-rounded-lg tw-bg-blue-50 tw-text-blue-800 tw-text-xs tw-font-bold tw-flex tw-items-center tw-gap-1"><Send size={13} /> Reinvia inviti</button>
            <button onClick={() => azione('promemoria')} className="tw-px-3 tw-py-2 tw-rounded-lg tw-bg-amber-50 tw-text-amber-800 tw-text-xs tw-font-bold tw-flex tw-items-center tw-gap-1"><Bell size={13} /> Promemoria</button>
            <button onClick={() => azione('recording-status', { attiva: !coll.registrazioneInCorso })} className={`tw-px-3 tw-py-2 tw-rounded-lg tw-text-xs tw-font-bold tw-flex tw-items-center tw-gap-1 ${coll.registrazioneInCorso ? 'tw-bg-red-100 tw-text-red-700' : 'tw-bg-slate-100 tw-text-slate-700'}`}><Mic size={13} /> {coll.registrazioneInCorso ? 'Stop registrazione' : 'Avvia registrazione'}</button>
            <button onClick={() => azione('generate-minutes')} className="tw-px-3 tw-py-2 tw-rounded-lg tw-bg-violet-50 tw-text-violet-800 tw-text-xs tw-font-bold tw-flex tw-items-center tw-gap-1"><FileText size={13} /> Genera verbale AI</button>
          </div>
          <div className="tw-mt-4">
            <label className={lbl}>Verbale
              <textarea className={inp} rows={8} value={verbale} onChange={e => setVerbale(e.target.value)} placeholder="Verbale della riunione..." /></label>
            <button onClick={salvaVerbale} className="tw-mt-2 tw-px-4 tw-py-2 tw-rounded-lg tw-bg-blue-800 tw-text-white tw-text-sm tw-font-bold">Salva verbale</button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Lista colloqui ─────────────────────────────────────────────────────────
  return (
    <div className="tw-p-4 tw-max-w-4xl tw-mx-auto">
      <div className="tw-flex tw-items-center tw-justify-between tw-flex-wrap tw-gap-3 tw-mb-5">
        <div>
          <h1 className="tw-text-xl tw-font-bold tw-text-slate-800">Riunioni e colloqui</h1>
          <p className="tw-text-sm tw-text-slate-500">Colloqui intermediazione e riunioni con inviti e verbali</p>
        </div>
        <button onClick={() => setForm(v => !v)} className="tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-bold tw-bg-blue-800 tw-text-white tw-flex tw-items-center tw-gap-2"><Plus size={16} /> Nuovo colloquio</button>
      </div>
      {err && <p className="tw-text-red-600 tw-text-sm">{err}</p>}

      {form && (
        <form onSubmit={crea} className="tw-bg-white tw-rounded-xl tw-border tw-border-blue-200 tw-shadow-sm tw-p-4 tw-mb-5 tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3">
          <label className={lbl}>Titolo *<input className={inp} required value={f.titolo} onChange={e => setF(s => ({ ...s, titolo: e.target.value }))} /></label>
          <label className={lbl}>Data e ora *<input className={inp} type="datetime-local" required value={f.dataRiunione} onChange={e => setF(s => ({ ...s, dataRiunione: e.target.value }))} /></label>
          <label className={lbl}>Modalità
            <select className={inp} value={f.modalita} onChange={e => setF(s => ({ ...s, modalita: e.target.value }))}>
              {Object.entries(MODALITA).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </label>
          <label className={lbl}>Link videochiamata<input className={inp} value={f.linkCollegamento} onChange={e => setF(s => ({ ...s, linkCollegamento: e.target.value }))} placeholder="https://..." /></label>
          <label className={lbl + ' sm:tw-col-span-2'}>Ordine del giorno<textarea className={inp} rows={3} value={f.ordineDelGiorno} onChange={e => setF(s => ({ ...s, ordineDelGiorno: e.target.value }))} /></label>
          <button type="submit" className="tw-px-4 tw-py-2 tw-rounded-lg tw-bg-blue-800 tw-text-white tw-font-bold sm:tw-col-span-2">Crea e invia inviti</button>
        </form>
      )}

      {lista.length === 0 && <p className="tw-text-slate-400 tw-text-center tw-py-10">Nessun colloquio.</p>}
      <div className="tw-grid tw-gap-3">
        {lista.map((c: any) => {
          const Icon = MODALITA[c.modalita]?.icon || Video;
          return (
            <button key={c._id} onClick={() => nav(`/riunioni-colloquio/${c._id}`)}
              className="tw-text-left tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-shadow-sm tw-p-4 hover:tw-border-blue-300">
              <div className="tw-flex tw-items-center tw-gap-3">
                <Icon size={18} className="tw-text-blue-800 tw-shrink-0" />
                <div className="tw-flex-1 tw-min-w-0">
                  <strong className="tw-text-slate-800">{c.titolo || 'Colloquio'}</strong>
                  <div className="tw-text-xs tw-text-slate-500">
                    {c.dataRiunione ? new Date(c.dataRiunione).toLocaleString('it-IT') : '—'} · {MODALITA[c.modalita]?.label || c.modalita}
                    {c.stato ? ` · ${c.stato}` : ''}
                  </div>
                </div>
                {c.verbale && <FileText size={15} className="tw-text-emerald-600" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

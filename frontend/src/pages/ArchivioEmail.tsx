import { useEffect, useState } from 'react';
import api from '../api/api';
import { Mail, Inbox, Paperclip, RefreshCw, Eye, EyeOff, Pencil } from 'lucide-react';

function Allegati({ email }: { email: any }) {
  const scarica = (index: number, nome?: string) =>
    api.get(`/archivio-email/${email._id}/allegato/${index}`, { responseType: 'blob' })
      .then(r => {
        const url = URL.createObjectURL(new Blob([r.data]));
        const a = document.createElement('a');
        a.href = url; a.download = nome || `allegato-${index + 1}`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      });
  const allegati = email.allegati || email.attachments || [];
  if (!allegati.length) return null;
  return (
    <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mt-2">
      {allegati.map((a: any, i: number) => (
        <button key={i} onClick={() => scarica(i, a.filename || a.nome)}
          className="tw-flex tw-items-center tw-gap-1 tw-px-2 tw-py-1 tw-rounded-md tw-bg-slate-100 tw-text-slate-700 tw-text-xs hover:tw-bg-slate-200">
          <Paperclip size={12} /> {a.filename || a.nome || `allegato ${i + 1}`}
        </button>
      ))}
    </div>
  );
}

export default function ArchivioEmail() {
  const [tab, setTab] = useState<'inviate' | 'ricevute'>('inviate');
  const [email, setEmail] = useState<any[]>([]);
  const [ricevute, setRicevute] = useState<any[]>([]);
  const [tipi, setTipi] = useState<string[]>([]);
  const [tipo, setTipo] = useState('');
  const [aperta, setAperta] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState('');
  const [rettificaPer, setRettificaPer] = useState<any>(null);
  const [testoRettifica, setTestoRettifica] = useState('');

  const caricaInviate = () => api.get('/archivio-email', { params: tipo ? { tipo } : {} })
    .then(r => setEmail(r.data.email || r.data || [])).catch(() => setErr('Errore caricamento'));
  const caricaRicevute = () => api.get('/archivio-email/ricevute')
    .then(r => setRicevute(r.data.ricevute || r.data || [])).catch(() => setErr('Errore caricamento'));

  useEffect(() => {
    api.get('/archivio-email/tipi').then(r => setTipi(r.data.tipi || [])).catch(() => {});
    caricaInviate(); caricaRicevute();
  }, []);
  useEffect(() => { caricaInviate(); }, [tipo]);

  const sync = () => { setSyncing(true); api.post('/archivio-email/ricevute/sync').finally(() => { setSyncing(false); caricaRicevute(); }); };
  const segnaLetta = (id: string) => api.post(`/archivio-email/ricevute/${id}/letta`).then(caricaRicevute);
  const inviaRettifica = () => {
    api.post('/archivio-email/rettifica', { emailId: rettificaPer._id, testo: testoRettifica })
      .then(() => { setRettificaPer(null); setTestoRettifica(''); caricaInviate(); });
  };

  const fmt = (d: any) => d ? new Date(d).toLocaleString('it-IT') : '—';
  const card = 'tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-shadow-sm tw-p-4';

  return (
    <div className="tw-p-4 tw-max-w-4xl tw-mx-auto">
      <h1 className="tw-text-xl tw-font-bold tw-text-slate-800">Archivio email</h1>
      <p className="tw-text-sm tw-text-slate-500 tw-mb-4">Storico delle email inviate e casella di posta in entrata</p>

      <div className="tw-flex tw-gap-2 tw-mb-4">
        <button onClick={() => setTab('inviate')} className={`tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-bold tw-flex tw-items-center tw-gap-2 ${tab === 'inviate' ? 'tw-bg-blue-800 tw-text-white' : 'tw-bg-white tw-border tw-border-slate-300 tw-text-slate-600'}`}><Mail size={15} /> Inviate ({email.length})</button>
        <button onClick={() => setTab('ricevute')} className={`tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-bold tw-flex tw-items-center tw-gap-2 ${tab === 'ricevute' ? 'tw-bg-blue-800 tw-text-white' : 'tw-bg-white tw-border tw-border-slate-300 tw-text-slate-600'}`}><Inbox size={15} /> Ricevute ({ricevute.length})</button>
        {tab === 'ricevute' && (
          <button onClick={sync} disabled={syncing} className="tw-ml-auto tw-px-3 tw-py-2 tw-rounded-lg tw-bg-white tw-border tw-border-slate-300 tw-text-sm tw-font-semibold tw-flex tw-items-center tw-gap-2">
            <RefreshCw size={14} className={syncing ? 'tw-animate-spin' : ''} /> Sincronizza
          </button>
        )}
      </div>
      {err && <p className="tw-text-red-600 tw-text-sm tw-mb-3">{err}</p>}

      {tab === 'inviate' && (<>
        {tipi.length > 0 && (
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            className="tw-mb-3 tw-px-3 tw-py-2 tw-border tw-border-slate-300 tw-rounded-lg tw-text-sm">
            <option value="">Tutti i tipi</option>
            {tipi.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <div className="tw-grid tw-gap-3">
          {email.map((e: any) => (
            <div key={e._id} className={card}>
              <div className="tw-flex tw-items-start tw-gap-3">
                <div className="tw-flex-1 tw-min-w-0">
                  <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
                    <strong className="tw-text-slate-800 tw-text-sm">{e.oggetto || e.subject || '(senza oggetto)'}</strong>
                    {e.tipo && <span className="tw-text-[0.68rem] tw-font-bold tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-blue-50 tw-text-blue-800">{e.tipo}</span>}
                    {e.inviata === false && <span className="tw-text-[0.68rem] tw-font-bold tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-red-100 tw-text-red-700">FALLITA</span>}
                  </div>
                  <div className="tw-text-xs tw-text-slate-500 tw-mt-0.5">a: {e.destinatario || e.to} · {fmt(e.inviatoIl || e.createdAt)}</div>
                  <Allegati email={e} />
                  {aperta === e._id && e.html && (
                    <div className="tw-mt-2 tw-border tw-border-slate-200 tw-rounded-lg tw-p-3 tw-text-sm tw-bg-slate-50" dangerouslySetInnerHTML={{ __html: e.html }} />
                  )}
                  {aperta === e._id && e.testo && !e.html && <pre className="tw-mt-2 tw-text-xs tw-whitespace-pre-wrap tw-bg-slate-50 tw-p-3 tw-rounded-lg">{e.testo}</pre>}
                </div>
                <div className="tw-flex tw-gap-1 tw-shrink-0">
                  <button onClick={() => setAperta(aperta === e._id ? null : e._id)} className="tw-p-2 tw-rounded-lg tw-bg-slate-50 tw-text-slate-600 hover:tw-bg-slate-100" title="Apri">
                    {aperta === e._id ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button onClick={() => { setRettificaPer(e); setTestoRettifica(''); }} className="tw-p-2 tw-rounded-lg tw-bg-amber-50 tw-text-amber-700 hover:tw-bg-amber-100" title="Rettifica"><Pencil size={15} /></button>
                </div>
              </div>
            </div>
          ))}
          {email.length === 0 && <p className="tw-text-slate-400 tw-text-center tw-py-10">Nessuna email in archivio.</p>}
        </div>
      </>)}

      {tab === 'ricevute' && (
        <div className="tw-grid tw-gap-3">
          {ricevute.map((e: any) => (
            <div key={e._id} className={`${card} ${e.letta ? 'tw-opacity-70' : ''}`}>
              <div className="tw-flex tw-items-start tw-gap-3">
                <div className="tw-flex-1 tw-min-w-0">
                  <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
                    <strong className={`tw-text-sm ${e.letta ? 'tw-text-slate-500 tw-font-medium' : 'tw-text-slate-800'}`}>{e.oggetto || e.subject || '(senza oggetto)'}</strong>
                    {!e.letta && <span className="tw-w-2 tw-h-2 tw-rounded-full tw-bg-blue-600" />}
                  </div>
                  <div className="tw-text-xs tw-text-slate-500 tw-mt-0.5">da: {e.mittente || e.from} · {fmt(e.ricevutaIl || e.data || e.createdAt)}</div>
                  {e.testo && <p className="tw-text-sm tw-text-slate-600 tw-mt-1 tw-line-clamp-2">{e.testo}</p>}
                </div>
                {!e.letta && <button onClick={() => segnaLetta(e._id)} className="tw-p-2 tw-rounded-lg tw-bg-emerald-50 tw-text-emerald-700 hover:tw-bg-emerald-100" title="Segna letta"><Eye size={15} /></button>}
              </div>
            </div>
          ))}
          {ricevute.length === 0 && <p className="tw-text-slate-400 tw-text-center tw-py-10">Nessuna email ricevuta.</p>}
        </div>
      )}

      {rettificaPer && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/40 tw-flex tw-items-center tw-justify-center tw-p-4 tw-z-50">
          <div className="tw-bg-white tw-rounded-xl tw-p-5 tw-max-w-lg tw-w-full">
            <h3 className="tw-font-bold tw-text-slate-800 tw-mb-2">Rettifica email: {rettificaPer.oggetto || rettificaPer.subject}</h3>
            <textarea value={testoRettifica} onChange={e => setTestoRettifica(e.target.value)} rows={5}
              className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-slate-300 tw-rounded-lg tw-text-sm" placeholder="Testo della rettifica da inviare..." />
            <div className="tw-flex tw-gap-2 tw-mt-3">
              <button onClick={inviaRettifica} className="tw-px-4 tw-py-2 tw-rounded-lg tw-bg-amber-600 tw-text-white tw-font-bold tw-text-sm">Invia rettifica</button>
              <button onClick={() => setRettificaPer(null)} className="tw-px-4 tw-py-2 tw-rounded-lg tw-bg-slate-100 tw-text-slate-700 tw-text-sm">Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

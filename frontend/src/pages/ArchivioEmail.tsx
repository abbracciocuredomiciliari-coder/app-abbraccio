import { useEffect, useState } from 'react';
import api from '../api/api';
import { Mail, Search, RotateCcw, Paperclip, CheckCircle, AlertTriangle, X, Send } from 'lucide-react';
import { Button } from '../components/ui/Button';

// ═════════════════════════════════════════════════════════════════════════════
// ARCHIVIO EMAIL — registro progressivo di tutte le email inviate dal
// gestionale. Unico archivio condiviso tra Gestione Privata e Intermediazioni.
// Da ogni riga si può inviare la RETTIFICA ("non tenere conto della
// precedente"): l'email inviata non si può eliminare dal server remoto.
// ═════════════════════════════════════════════════════════════════════════════

interface EmailLogItem {
  _id: string;
  to: string;
  subject: string;
  tipo: string;
  area: 'privato' | 'intermediazione' | 'generale';
  riferimento?: string;
  allegati?: string[];
  inviataDaNome?: string;
  esito: 'inviata' | 'fallita';
  errore?: string;
  rettificata?: boolean;
  rettificaDaNome?: string;
  rettificaIl?: string;
  createdAt: string;
}

const AREA_LABEL: Record<string, string> = { privato: 'Gestione Privata', intermediazione: 'Intermediazioni', generale: 'Generale' };
const AREA_STYLE: Record<string, { bg: string; color: string }> = {
  privato: { bg: '#dbeafe', color: '#1d4ed8' },
  intermediazione: { bg: '#ffe4e6', color: '#be123c' },
  generale: { bg: '#f1f5f9', color: '#475569' },
};
const TIPO_LABEL: Record<string, string> = {
  preventivo: 'Preventivo', fattura: 'Fattura', preventivo_veloce: 'Preventivo veloce',
  preventivo_badante: 'Preventivo badante', contratto: 'Contratto', rettifica: '⚠️ Rettifica',
  notifica_firma: 'Notifica firma', notifica_rifiuto: 'Notifica rifiuto', conferma: 'Conferma',
  generica: 'Generica',
};

const fmtData = (d: string) => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ArchivioEmail() {
  const [email, setEmail] = useState<EmailLogItem[]>([]);
  const [totale, setTotale] = useState(0);
  const [tipi, setTipi] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('tutte');
  const [tipo, setTipo] = useState('tutti');
  const [esito, setEsito] = useState('tutti');
  const [dal, setDal] = useState('');
  const [al, setAl] = useState('');
  const [rettifica, setRettifica] = useState<EmailLogItem | null>(null);
  const [rettificaTesto, setRettificaTesto] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);

  const carica = async () => {
    try {
      const res = await api.get('/archivio-email', { params: { q: q || undefined, area, tipo, esito, dal: dal || undefined, al: al || undefined } });
      setEmail(res.data?.email || []);
      setTotale(res.data?.totale || 0);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { api.get('/archivio-email/tipi').then(r => setTipi(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { setLoading(true); carica(); }, [area, tipo, esito, dal, al]);

  const inviaRettifica = async () => {
    if (!rettifica) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/archivio-email/rettifica', {
        emailLogId: rettifica._id,
        to: rettifica.to,
        subjectOriginale: rettifica.subject,
        testo: rettificaTesto.trim() || undefined,
      });
      if (res.data?.inviata) {
        setMsg({ tipo: 'ok', testo: `Email di rettifica inviata a ${rettifica.to}. L'originale è marcata come rettificata.` });
        setRettifica(null);
        setRettificaTesto('');
        await carica();
      } else {
        setMsg({ tipo: 'err', testo: 'Invio rettifica non riuscito (server SMTP).' });
      }
    } catch (err: any) {
      setMsg({ tipo: 'err', testo: err?.response?.data?.message || 'Errore invio rettifica' });
    } finally {
      setBusy(false);
    }
  };

  const input: React.CSSProperties = { padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'inherit', background: '#fff' };
  const label: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' };

  return (
    <div className="page-container tw-p-5">
      <div className="tw-mb-5">
        <h1 className="tw-flex tw-items-center tw-gap-2 tw-text-blue-900 tw-m-0 tw-text-2xl tw-font-extrabold">
          <Mail size={26} /> Archivio email inviate
        </h1>
        <p className="tw-text-slate-500 tw-text-sm tw-mt-1.5 tw-mb-0">
          Registro progressivo di tutte le email inviate dal gestionale (Gestione Privata e Intermediazioni). Un'email inviata non si può cancellare: se è partita per errore usa <strong>Rettifica</strong> per chiedere al destinatario di ignorarla.
        </p>
      </div>

      {/* Filtri */}
      <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-4 tw-mb-4">
        <div className="tw-flex tw-flex-wrap tw-gap-3 tw-items-end">
          <div style={{ minWidth: '220px', flex: 2 }}>
            <span style={label}>Cerca (destinatario, oggetto, riferimento)</span>
            <input style={{ ...input, width: '100%' }} value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setLoading(true); carica(); } }} placeholder="Es. mario@email.it o PREV-2026-00012" />
          </div>
          <div>
            <span style={label}>Area</span>
            <select style={input} value={area} onChange={e => setArea(e.target.value)}>
              <option value="tutte">Tutte</option>
              <option value="privato">Gestione Privata</option>
              <option value="intermediazione">Intermediazioni</option>
              <option value="generale">Generale</option>
            </select>
          </div>
          <div>
            <span style={label}>Tipo</span>
            <select style={input} value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="tutti">Tutti</option>
              {tipi.map(t => <option key={t} value={t}>{TIPO_LABEL[t] || t}</option>)}
            </select>
          </div>
          <div>
            <span style={label}>Esito</span>
            <select style={input} value={esito} onChange={e => setEsito(e.target.value)}>
              <option value="tutti">Tutti</option>
              <option value="inviata">Inviate</option>
              <option value="fallita">Fallite</option>
            </select>
          </div>
          <div>
            <span style={label}>Dal</span>
            <input style={input} type="date" value={dal} onChange={e => setDal(e.target.value)} />
          </div>
          <div>
            <span style={label}>Al</span>
            <input style={input} type="date" value={al} onChange={e => setAl(e.target.value)} />
          </div>
          <Button onClick={() => { setLoading(true); carica(); }} className="tw-flex tw-items-center tw-gap-1.5">
            <Search size={16} /> Cerca
          </Button>
        </div>
      </div>

      {msg && (
        <div className={`tw-text-sm tw-font-semibold tw-rounded-lg tw-p-3 tw-mb-4 ${msg.tipo === 'ok' ? 'tw-bg-green-50 tw-text-green-700 tw-border tw-border-green-200' : 'tw-bg-red-50 tw-text-red-700 tw-border tw-border-red-200'}`}>
          {msg.tipo === 'ok' ? '✅' : '⚠️'} {msg.testo}
        </div>
      )}

      {/* Lista */}
      <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-overflow-hidden">
        <div className="tw-px-4 tw-py-3 tw-border-b tw-border-slate-100 tw-text-sm tw-font-bold tw-text-slate-600">
          {totale} email {loading && '· caricamento…'}
        </div>
        {!loading && email.length === 0 ? (
          <div className="tw-p-8 tw-text-center tw-text-slate-400">Nessuna email trovata con questi filtri.</div>
        ) : (
          <div className="tw-divide-y tw-divide-slate-100">
            {email.map(e => {
              const a = AREA_STYLE[e.area] || AREA_STYLE.generale;
              return (
                <div key={e._id} className="tw-px-4 tw-py-3 tw-flex tw-flex-wrap tw-items-center tw-gap-3">
                  <div className="tw-flex-1 tw-min-w-[260px]">
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mb-0.5">
                      <span className="tw-text-sm tw-font-bold tw-text-slate-800">{e.subject}</span>
                      {e.rettificata && <span className="tw-text-xs tw-font-bold tw-text-red-600 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-full tw-px-2 tw-py-0.5">↩️ RETTIFICATA</span>}
                    </div>
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-text-xs tw-text-slate-500">
                      <span>a <strong>{e.to}</strong></span>
                      <span>· {fmtData(e.createdAt)}</span>
                      {e.inviataDaNome && <span>· da {e.inviataDaNome}</span>}
                      {e.riferimento && <span>· rif: {e.riferimento}</span>}
                      {e.allegati && e.allegati.length > 0 && (
                        <span className="tw-flex tw-items-center tw-gap-1"><Paperclip size={11} />{e.allegati.join(', ')}</span>
                      )}
                      {e.rettificata && e.rettificaIl && <span className="tw-text-red-500">· rettificata il {fmtData(e.rettificaIl)}{e.rettificaDaNome ? ` da ${e.rettificaDaNome}` : ''}</span>}
                    </div>
                  </div>
                  <span className="tw-text-xs tw-font-bold tw-px-2 tw-py-1 tw-rounded-full" style={{ background: a.bg, color: a.color }}>{AREA_LABEL[e.area] || e.area}</span>
                  <span className="tw-text-xs tw-font-semibold tw-px-2 tw-py-1 tw-rounded-full tw-bg-slate-100 tw-text-slate-600">{TIPO_LABEL[e.tipo] || e.tipo}</span>
                  {e.esito === 'inviata'
                    ? <span className="tw-text-xs tw-font-bold tw-text-green-700 tw-flex tw-items-center tw-gap-1"><CheckCircle size={13} />Inviata</span>
                    : <span className="tw-text-xs tw-font-bold tw-text-red-600 tw-flex tw-items-center tw-gap-1" title={e.errore || ''}><AlertTriangle size={13} />Fallita</span>}
                  {e.esito === 'inviata' && !e.rettificata && (
                    <button type="button" onClick={() => { setRettifica(e); setRettificaTesto(''); }}
                      className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-font-bold tw-text-red-700 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-lg tw-px-2.5 tw-py-1.5 tw-cursor-pointer hover:tw-bg-red-100">
                      <RotateCcw size={12} /> Rettifica
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal rettifica */}
      {rettifica && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-p-4" style={{ background: 'rgba(15,23,42,0.45)' }}>
          <div className="tw-bg-white tw-rounded-2xl tw-shadow-xl tw-p-6 tw-w-full tw-max-w-lg">
            <div className="tw-flex tw-items-start tw-justify-between tw-mb-4">
              <h2 className="tw-m-0 tw-text-lg tw-font-bold tw-text-red-700 tw-flex tw-items-center tw-gap-2">
                <RotateCcw size={20} /> Invia email di rettifica
              </h2>
              <button type="button" onClick={() => setRettifica(null)} className="tw-border-0 tw-bg-transparent tw-cursor-pointer tw-text-slate-400"><X size={20} /></button>
            </div>
            <p className="tw-text-sm tw-text-slate-600 tw-mb-3">
              Verrà inviata a <strong>{rettifica.to}</strong> un'email che chiede di <strong>non tenere conto</strong> della precedente, con oggetto <em>"⚠️ RETTIFICA: {rettifica.subject}"</em>.
            </p>
            <span style={label}>Nota aggiuntiva (opzionale)</span>
            <textarea
              style={{ width: '100%', minHeight: '80px', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
              value={rettificaTesto} onChange={e => setRettificaTesto(e.target.value)}
              placeholder="Es. Il preventivo allegato conteneva un importo errato; ne seguirà uno corretto." />
            <div className="tw-flex tw-gap-2 tw-mt-4 tw-justify-end">
              <Button variant="secondary" onClick={() => setRettifica(null)}>Annulla</Button>
              <button type="button" onClick={inviaRettifica} disabled={busy}
                className="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-border-0 tw-bg-red-600 tw-text-white tw-font-bold tw-cursor-pointer disabled:tw-opacity-50">
                <Send size={16} /> {busy ? 'Invio…' : 'Invia rettifica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

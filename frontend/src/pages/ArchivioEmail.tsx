import { useEffect, useState } from 'react';
import api from '../api/api';
import { Mail, Search, RotateCcw, Paperclip, CheckCircle, AlertTriangle, X, Send, Inbox, RefreshCw, MailOpen } from 'lucide-react';
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
  storico?: boolean;
  dataStimata?: boolean;
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

interface EmailRicevutaItem {
  _id: string;
  uid: number;
  from: { nome?: string; email: string };
  subject: string;
  data: string;
  snippet?: string;
  testo?: string;
  html?: string;
  allegati?: { filename: string; contentType?: string; size: number }[];
  letta: boolean;
}

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
  const [loadingAllegato, setLoadingAllegato] = useState<string | null>(null);

  // Tab ricevute
  const [tab, setTab] = useState<'inviate' | 'ricevute'>('inviate');
  const [ricevute, setRicevute] = useState<EmailRicevutaItem[]>([]);
  const [totaleRicevute, setTotaleRicevute] = useState(0);
  const [nonLette, setNonLette] = useState(0);
  const [filtroLetta, setFiltroLetta] = useState('tutte');
  const [aperta, setAperta] = useState<string | null>(null);
  const [corpo, setCorpo] = useState<EmailRicevutaItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [erroreSync, setErroreSync] = useState<string | null>(null);

  const caricaRicevute = async () => {
    try {
      const res = await api.get('/archivio-email/ricevute', { params: { q: q || undefined, letta: filtroLetta, dal: dal || undefined, al: al || undefined } });
      setRicevute(res.data?.email || []);
      setTotaleRicevute(res.data?.totale || 0);
      setNonLette(res.data?.nonLette || 0);
    } catch { /* noop */ }
  };

  const sincronizza = async () => {
    setSyncing(true);
    setErroreSync(null);
    try {
      const res = await api.post('/archivio-email/ricevute/sync');
      if (res.data?.ok === false) setErroreSync(res.data.errore || 'Errore sincronizzazione');
      await caricaRicevute();
    } catch (e: any) {
      setErroreSync(e?.response?.data?.message || 'Errore sincronizzazione casella');
    } finally {
      setSyncing(false);
    }
  };

  const apriCorpo = async (e: EmailRicevutaItem) => {
    if (aperta === e._id) { setAperta(null); setCorpo(null); return; }
    setAperta(e._id);
    setCorpo(null);
    try {
      const res = await api.get(`/archivio-email/ricevute/${e._id}`);
      setCorpo(res.data);
      if (!e.letta) {
        api.post(`/archivio-email/ricevute/${e._id}/letta`, { letta: true }).then(() => caricaRicevute()).catch(() => {});
      }
    } catch { /* noop */ }
  };

  const toggleLetta = async (e: EmailRicevutaItem, ev: React.MouseEvent) => {
    ev.stopPropagation();
    try {
      await api.post(`/archivio-email/ricevute/${e._id}/letta`, { letta: !e.letta });
      await caricaRicevute();
    } catch { /* noop */ }
  };

  const apriAllegatoRicevuto = async (e: EmailRicevutaItem, index: number, ev: React.MouseEvent) => {
    ev.stopPropagation();
    const key = `r-${e._id}-${index}`;
    setLoadingAllegato(key);
    try {
      const res = await api.get(`/archivio-email/ricevute/${e._id}/allegato/${index}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setMsg({ tipo: 'err', testo: 'Allegato non conservato (troppo grande per l\'archivio).' });
    } finally {
      setLoadingAllegato(null);
    }
  };

  const apriAllegato = async (e: EmailLogItem, index: number) => {
    const key = `${e._id}-${index}`;
    setLoadingAllegato(key);
    try {
      const res = await api.get(`/archivio-email/${e._id}/allegato/${index}`, { responseType: 'blob' });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setMsg({ tipo: 'err', testo: 'Allegato non disponibile per questa email (inviata prima della conservazione allegati).' });
    } finally {
      setLoadingAllegato(null);
    }
  };

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
  useEffect(() => { if (tab === 'ricevute') caricaRicevute(); }, [tab, filtroLetta, dal, al]);

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
          <Mail size={26} /> Archivio email
        </h1>
        <p className="tw-text-slate-500 tw-text-sm tw-mt-1.5 tw-mb-0">
          {tab === 'inviate'
            ? <>Registro progressivo di tutte le email inviate dal gestionale. Un'email inviata non si può cancellare: se è partita per errore usa <strong>Rettifica</strong> per chiedere al destinatario di ignorarla.</>
            : <>Email arrivate sulla casella aziendale <strong>info@abbracciocuredomiciliari.it</strong> (sincronizzazione automatica ogni 5 minuti). Apri una riga per leggere il testo.</>}
        </p>
      </div>

      {/* Tab inviate / ricevute */}
      <div className="tw-flex tw-gap-2 tw-mb-4">
        <button type="button" onClick={() => setTab('inviate')}
          className={`tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-xl tw-border tw-font-bold tw-text-sm tw-cursor-pointer ${tab === 'inviate' ? 'tw-bg-blue-900 tw-text-white tw-border-blue-900' : 'tw-bg-white tw-text-slate-600 tw-border-slate-200'}`}>
          <Send size={15} /> Inviate
        </button>
        <button type="button" onClick={() => setTab('ricevute')}
          className={`tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-xl tw-border tw-font-bold tw-text-sm tw-cursor-pointer ${tab === 'ricevute' ? 'tw-bg-blue-900 tw-text-white tw-border-blue-900' : 'tw-bg-white tw-text-slate-600 tw-border-slate-200'}`}>
          <Inbox size={15} /> Ricevute
          {nonLette > 0 && <span className="tw-bg-red-500 tw-text-white tw-rounded-full tw-text-xs tw-px-2 tw-py-0.5 tw-font-extrabold">{nonLette}</span>}
        </button>
      </div>

      {/* Filtri */}
      <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-4 tw-mb-4">
        <div className="tw-flex tw-flex-wrap tw-gap-3 tw-items-end">
          <div style={{ minWidth: '220px', flex: 2 }}>
            <span style={label}>{tab === 'inviate' ? 'Cerca (destinatario, oggetto, riferimento)' : 'Cerca (mittente, oggetto)'}</span>
            <input style={{ ...input, width: '100%' }} value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { tab === 'inviate' ? (setLoading(true), carica()) : caricaRicevute(); } }} placeholder={tab === 'inviate' ? 'Es. mario@email.it o PREV-2026-00012' : 'Es. mario@email.it'} />
          </div>
          {tab === 'inviate' ? (
            <>
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
            </>
          ) : (
            <div>
              <span style={label}>Stato</span>
              <select style={input} value={filtroLetta} onChange={e => setFiltroLetta(e.target.value)}>
                <option value="tutte">Tutte</option>
                <option value="non-lette">Non lette</option>
                <option value="lette">Lette</option>
              </select>
            </div>
          )}
          <div>
            <span style={label}>Dal</span>
            <input style={input} type="date" value={dal} onChange={e => setDal(e.target.value)} />
          </div>
          <div>
            <span style={label}>Al</span>
            <input style={input} type="date" value={al} onChange={e => setAl(e.target.value)} />
          </div>
          <Button onClick={() => { tab === 'inviate' ? (setLoading(true), carica()) : caricaRicevute(); }} className="tw-flex tw-items-center tw-gap-1.5">
            <Search size={16} /> Cerca
          </Button>
          {tab === 'ricevute' && (
            <Button variant="secondary" onClick={sincronizza} disabled={syncing} className="tw-flex tw-items-center tw-gap-1.5">
              <RefreshCw size={16} className={syncing ? 'tw-animate-spin' : ''} /> {syncing ? 'Sync…' : 'Aggiorna ora'}
            </Button>
          )}
        </div>
        {tab === 'ricevute' && erroreSync && (
          <div className="tw-text-xs tw-text-amber-700 tw-bg-amber-50 tw-border tw-border-amber-200 tw-rounded-lg tw-p-2 tw-mt-3">
            ⚠️ Sincronizzazione casella non riuscita: {erroreSync}. Controlla che POP3/IMAP sia abilitato sulla casella Aruba.
          </div>
        )}
      </div>

      {msg && (
        <div className={`tw-text-sm tw-font-semibold tw-rounded-lg tw-p-3 tw-mb-4 ${msg.tipo === 'ok' ? 'tw-bg-green-50 tw-text-green-700 tw-border tw-border-green-200' : 'tw-bg-red-50 tw-text-red-700 tw-border tw-border-red-200'}`}>
          {msg.tipo === 'ok' ? '✅' : '⚠️'} {msg.testo}
        </div>
      )}

      {/* Lista inviate */}
      {tab === 'inviate' && <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-overflow-hidden">
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
                      {e.storico && <span className="tw-text-xs tw-font-bold tw-text-amber-700 tw-bg-amber-50 tw-border tw-border-amber-200 tw-rounded-full tw-px-2 tw-py-0.5" title={e.dataStimata ? 'Ricostruita dallo storico documenti — data approssimata' : 'Ricostruita dallo storico documenti'}>📜 STORICO{e.dataStimata ? ' (data stimata)' : ''}</span>}
                    </div>
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-text-xs tw-text-slate-500">
                      <span>a <strong>{e.to}</strong></span>
                      <span>· {fmtData(e.createdAt)}</span>
                      {e.inviataDaNome && <span>· da {e.inviataDaNome}</span>}
                      {e.riferimento && <span>· rif: {e.riferimento}</span>}
                      {e.allegati && e.allegati.length > 0 && (
                        <span className="tw-flex tw-items-center tw-gap-1.5 tw-flex-wrap">
                          <Paperclip size={11} />
                          {e.allegati.map((nome, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => apriAllegato(e, i)}
                              disabled={loadingAllegato === `${e._id}-${i}`}
                              title="Visualizza / scarica l'allegato inviato"
                              className="tw-text-blue-700 tw-bg-blue-50 tw-border tw-border-blue-200 tw-rounded tw-px-1.5 tw-py-0.5 tw-font-semibold tw-cursor-pointer hover:tw-bg-blue-100 tw-underline disabled:tw-opacity-50">
                              {loadingAllegato === `${e._id}-${i}` ? '⏳' : '📄'} {nome}
                            </button>
                          ))}
                        </span>
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
      </div>}

      {/* Lista ricevute */}
      {tab === 'ricevute' && (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-overflow-hidden">
          <div className="tw-px-4 tw-py-3 tw-border-b tw-border-slate-100 tw-text-sm tw-font-bold tw-text-slate-600">
            {totaleRicevute} email ricevute {nonLette > 0 && `· ${nonLette} non lette`}
          </div>
          {ricevute.length === 0 ? (
            <div className="tw-p-8 tw-text-center tw-text-slate-400">Nessuna email ricevuta. Premi "Aggiorna ora" per sincronizzare la casella.</div>
          ) : (
            <div className="tw-divide-y tw-divide-slate-100">
              {ricevute.map(e => (
                <div key={e._id} className="tw-px-4 tw-py-3 tw-cursor-pointer hover:tw-bg-slate-50" onClick={() => apriCorpo(e)}>
                  <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
                    {!e.letta
                      ? <span className="tw-w-2.5 tw-h-2.5 tw-rounded-full tw-bg-blue-600 tw-shrink-0" title="Non letta" />
                      : <span className="tw-w-2.5 tw-h-2.5 tw-rounded-full tw-bg-transparent tw-shrink-0" />}
                    <div className="tw-flex-1 tw-min-w-[260px]">
                      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mb-0.5">
                        <span className={`tw-text-sm ${e.letta ? 'tw-font-semibold tw-text-slate-600' : 'tw-font-extrabold tw-text-slate-900'}`}>{e.subject}</span>
                        {e.allegati && e.allegati.length > 0 && (
                          <span className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-slate-500">
                            <Paperclip size={11} /> {e.allegati.length}
                          </span>
                        )}
                      </div>
                      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-text-xs tw-text-slate-500">
                        <span>da <strong>{e.from.nome ? `${e.from.nome} <${e.from.email}>` : e.from.email}</strong></span>
                        <span>· {fmtData(e.data)}</span>
                        {e.snippet && <span className="tw-text-slate-400 tw-truncate tw-max-w-[420px]">· {e.snippet}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={ev => toggleLetta(e, ev)}
                      className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-font-bold tw-text-slate-600 tw-bg-slate-50 tw-border tw-border-slate-200 tw-rounded-lg tw-px-2.5 tw-py-1.5 tw-cursor-pointer hover:tw-bg-slate-100">
                      <MailOpen size={12} /> {e.letta ? 'Segna non letta' : 'Segna letta'}
                    </button>
                  </div>
                  {aperta === e._id && (
                    <div className="tw-mt-3 tw-ml-5 tw-border-l-4 tw-border-blue-100 tw-pl-4">
                      {!corpo ? <div className="tw-text-sm tw-text-slate-400">Caricamento…</div> : (
                        <>
                          {corpo.allegati && corpo.allegati.length > 0 && (
                            <div className="tw-flex tw-flex-wrap tw-gap-1.5 tw-mb-3">
                              {corpo.allegati.map((a, i) => (
                                <button key={i} type="button" onClick={ev => apriAllegatoRicevuto(e, i, ev)}
                                  disabled={loadingAllegato === `r-${e._id}-${i}`}
                                  className="tw-text-blue-700 tw-bg-blue-50 tw-border tw-border-blue-200 tw-rounded tw-px-1.5 tw-py-0.5 tw-text-xs tw-font-semibold tw-cursor-pointer hover:tw-bg-blue-100 tw-underline disabled:tw-opacity-50">
                                  {loadingAllegato === `r-${e._id}-${i}` ? '⏳' : '📄'} {a.filename} ({Math.round(a.size / 1024)} KB)
                                </button>
                              ))}
                            </div>
                          )}
                          {corpo.html ? (
                            <iframe title="corpo email" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={corpo.html}
                              className="tw-w-full tw-border tw-border-slate-100 tw-rounded-lg tw-bg-white" style={{ minHeight: '280px' }} />
                          ) : (
                            <pre className="tw-whitespace-pre-wrap tw-text-sm tw-text-slate-700 tw-font-sans tw-m-0">{corpo.testo || '(nessun contenuto testuale)'}</pre>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

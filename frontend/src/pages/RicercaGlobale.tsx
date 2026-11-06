import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, User, Users, FileText, Receipt, Mail, ClipboardList,
  Calendar, ArrowLeft, ExternalLink, UserCircle, Handshake,
} from 'lucide-react';
import api from '../api/api';
import { useModalita } from '../context/ModalitaContext';

const fmtData = (d?: string) => (d ? new Date(d).toLocaleDateString('it-IT') : '—');
const fmtEuro = (n?: number) => (typeof n === 'number' ? `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—');

// ═══ Pagina Ricerca Globale + dossier paziente ═══
// ?q=testo        → ricerca ovunque
// ?paziente=<id>  → storico completo di un paziente
export default function RicercaGlobale() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { isConsulenza } = useModalita();
  const area = isConsulenza ? 'consulenza' : 'privato';

  const q = params.get('q') || '';
  const pazienteId = params.get('paziente') || '';
  const [input, setInput] = useState(q);
  const [dati, setDati] = useState<any>(null);
  const [dossier, setDossier] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => { setInput(q); }, [q]);

  useEffect(() => {
    setErrore(''); setDati(null); setDossier(null);
    if (pazienteId) {
      setLoading(true);
      api.get(`/ricerca/paziente/${pazienteId}`)
        .then((r) => setDossier(r.data))
        .catch((e) => setErrore(e.response?.data?.message || 'Errore nel caricamento.'))
        .finally(() => setLoading(false));
    } else if (q.trim().length >= 2) {
      setLoading(true);
      api.get(`/ricerca?q=${encodeURIComponent(q)}&area=${area}`)
        .then((r) => setDati(r.data))
        .catch((e) => setErrore(e.response?.data?.message || 'Errore nella ricerca.'))
        .finally(() => setLoading(false));
    }
  }, [q, pazienteId, area]);

  const cerca = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim().length >= 2) setParams({ q: input.trim() });
  };

  // Apre il documento contratto del PAZIENTE (HTML stampabile) in una nuova
  // scheda — mai la pagina dei contratti operatori.
  const apriContratto = async (id: string) => {
    try {
      const res = await api.get(`/contratti-pazienti/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
      window.open(url, '_blank');
    } catch {
      alert('Errore nell\'apertura del contratto');
    }
  };

  const Sezione = ({ titolo, icona, count, children }: any) =>
    !count ? null : (
      <div className="tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-shadow-sm tw-mb-4 tw-overflow-hidden">
        <div className="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2.5 tw-bg-slate-50 tw-border-b tw-border-slate-200">
          <span className="tw-text-blue-800">{icona}</span>
          <span className="tw-font-bold tw-text-slate-800">{titolo}</span>
          <span className="tw-ml-auto tw-text-xs tw-bg-blue-100 tw-text-blue-800 tw-rounded-full tw-px-2 tw-py-0.5 tw-font-bold">{count}</span>
        </div>
        <div className="tw-divide-y tw-divide-slate-100">{children}</div>
      </div>
    );

  const Riga = ({ children, onClick }: any) => (
    <div
      onClick={onClick}
      className={`tw-px-4 tw-py-2.5 tw-text-sm tw-flex tw-flex-wrap tw-items-center tw-gap-x-3 tw-gap-y-1 ${onClick ? 'tw-cursor-pointer hover:tw-bg-blue-50/50' : ''}`}
    >
      {children}
      {onClick && <ExternalLink size={13} className="tw-ml-auto tw-text-slate-400 tw-shrink-0" />}
    </div>
  );

  const Badge = ({ children, tone = 'slate' }: any) => (
    <span className={`tw-text-[0.68rem] tw-font-bold tw-rounded-full tw-px-2 tw-py-0.5 tw-uppercase tw-tracking-wide ${
      tone === 'verde' ? 'tw-bg-emerald-100 tw-text-emerald-700'
      : tone === 'rosso' ? 'tw-bg-red-100 tw-text-red-700'
      : tone === 'blu' ? 'tw-bg-blue-100 tw-text-blue-700'
      : tone === 'giallo' ? 'tw-bg-amber-100 tw-text-amber-700'
      : 'tw-bg-slate-100 tw-text-slate-600'}`}
    >{children}</span>
  );

  // ════ VISTA DOSSIER PAZIENTE ════
  if (dossier) {
    const p = dossier.paziente;
    return (
      <div className="page-container tw-max-w-4xl">
        <button onClick={() => { setParams({}); setDossier(null); }} className="tw-mb-3 tw-flex tw-items-center tw-gap-1 tw-text-blue-800 tw-font-semibold">
          <ArrowLeft size={16} /> Torna alla ricerca
        </button>
        <div className="tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-shadow-sm tw-p-5 tw-mb-4">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
            <UserCircle size={40} className="tw-text-blue-800" />
            <div>
              <h1 className="tw-text-xl tw-font-bold tw-text-slate-900">{p.nome}</h1>
              <div className="tw-text-sm tw-text-slate-500">
                {p.tipoGestione === 'consulenza' ? 'Intermediazioni' : p.tipoGestione === 'convenzione' ? 'Convenzione SIAT' : 'Privato'}
                {p.indirizzo ? ` · ${p.indirizzo}` : ''}
              </div>
              <div className="tw-text-sm tw-text-slate-500">
                {p.email || '—'}{p.telefono ? ` · ${p.telefono}` : ''}
              </div>
            </div>
            <div className="tw-ml-auto tw-flex tw-gap-2">
              <button onClick={() => navigate('/patients')} className="tw-bg-blue-800 tw-text-white tw-text-sm">Apri in Pazienti</button>
              <button onClick={() => navigate('/gestione-fatturazione')} className="tw-bg-slate-700 tw-text-white tw-text-sm">Nuovo documento</button>
            </div>
          </div>
          {dossier.operatori?.length > 0 && (
            <div className="tw-mt-3 tw-pt-3 tw-border-t tw-border-slate-100 tw-text-sm">
              <span className="tw-font-semibold tw-text-slate-700">Operatori assegnati: </span>
              {dossier.operatori.map((o: string) => <Badge key={o} tone="blu">{o}</Badge>)}
            </div>
          )}
        </div>

        <Sezione titolo="Preventivi e fatture" icona={<Receipt size={17} />} count={dossier.documenti.length}>
          {dossier.documenti.map((d: any) => (
            <Riga key={d._id} onClick={() => navigate(d.tipo === 'fattura' ? `/archivio-fatture?paziente=${p._id}` : `/archivio-preventivi?paziente=${p._id}`)}>
              <span className="tw-font-bold">{d.numero}</span>
              <Badge tone={d.tipo === 'fattura' ? 'blu' : 'giallo'}>{d.tipo}</Badge>
              <span>{fmtEuro(d.totale)}</span>
              {d.totaleMensileStimato ? <span className="tw-text-slate-500">≈ {fmtEuro(d.totaleMensileStimato)}/mese</span> : null}
              <Badge tone={d.stato === 'firmato' ? 'verde' : d.stato === 'annullato' || d.stato === 'rifiutato' ? 'rosso' : 'slate'}>{d.stato}</Badge>
              <span className="tw-text-slate-500">{fmtData(d.data)}</span>
            </Riga>
          ))}
        </Sezione>

        <Sezione titolo="Piani / assegnazioni" icona={<Calendar size={17} />} count={dossier.piani.length}>
          {dossier.piani.map((w: any) => (
            <Riga key={w._id} onClick={() => navigate('/piani-lavorativi')}>
              <span className="tw-font-semibold">{w.task}</span>
              {w.operatore && <span className="tw-text-blue-800">→ {w.operatore}{w.ruoloOperatore ? ` (${w.ruoloOperatore})` : ''}</span>}
              <Badge>{w.status || 'pianificato'}</Badge>
              <span className="tw-text-slate-500">{fmtData(w.date)}</span>
            </Riga>
          ))}
        </Sezione>

        <Sezione titolo="Contratti" icona={<FileText size={17} />} count={dossier.contratti.length}>
          {dossier.contratti.map((c: any) => (
            <Riga key={c._id} onClick={() => apriContratto(c._id)}>
              <span className="tw-font-semibold">{c.profilo}</span>
              <Badge tone={c.stato === 'firmato' ? 'verde' : 'giallo'}>{c.stato || 'bozza'}</Badge>
              {c.firmatoIl && <span className="tw-text-slate-500">firmato il {fmtData(c.firmatoIl)}</span>}
              <span className="tw-text-slate-500">{fmtData(c.data)}</span>
            </Riga>
          ))}
        </Sezione>

        <Sezione titolo="Invii preventivi/contratti (WhatsApp · Email)" icona={<Handshake size={17} />} count={dossier.invii.length}>
          {dossier.invii.map((i: any) => (
            <Riga key={i._id} onClick={() => navigate(isConsulenza
              ? `/archivi-intermediazione?paziente=${p._id}&nome=${encodeURIComponent(p.nome)}`
              : `/archivio-preventivi?q=${encodeURIComponent(p.nome)}`)}>
              <Badge tone="blu">{i.canale}</Badge>
              <span className="tw-font-semibold">{i.tipo === 'contratto_firma' ? 'Contratto' : 'Preventivo'}</span>
              {i.totale ? <span>{fmtEuro(i.totale)}</span> : null}
              {i.inviatoDa && <span className="tw-text-slate-500">da {i.inviatoDa}</span>}
              <span className="tw-text-slate-500">{fmtData(i.data)}</span>
            </Riga>
          ))}
        </Sezione>

        <Sezione titolo="Richieste di servizio" icona={<ClipboardList size={17} />} count={dossier.richieste.length}>
          {dossier.richieste.map((r: any) => (
            <Riga key={r._id} onClick={() => navigate(isConsulenza ? '/badanti-intermediazione' : '/centro-prenotazioni')}>
              <span className="tw-font-semibold">{r.tipoServizio || 'Servizio'}</span>
              <Badge>{r.stato}</Badge>
              <span className="tw-text-slate-500">{fmtData(r.data)}</span>
            </Riga>
          ))}
        </Sezione>

        <Sezione titolo="Intermediazioni (badante/colf)" icona={<Users size={17} />} count={dossier.intermediazioni.length}>
          {dossier.intermediazioni.map((b: any) => (
            <Riga key={b._id} onClick={() => navigate('/badanti-intermediazione')}>
              <span className="tw-font-semibold">{b.contrattoTipo === 'convivente' ? 'Convivente' : 'Non convivente'}{b.livello ? ` · liv. ${b.livello}` : ''}</span>
              <Badge tone="giallo">{b.stato}</Badge>
              {b.costoMensile ? <span>{fmtEuro(b.costoMensile)}/mese</span> : null}
              <span className="tw-text-slate-500">{fmtData(b.data)}</span>
            </Riga>
          ))}
        </Sezione>

        <Sezione titolo="Email" icona={<Mail size={17} />} count={dossier.email.length}>
          {dossier.email.map((e: any) => (
            <Riga key={e._id} onClick={() => navigate(`/archivio-email?q=${encodeURIComponent(e.to || p.email || p.nome)}`)}>
              <span className="tw-font-semibold tw-truncate tw-max-w-[55%]">{e.subject}</span>
              <Badge tone={e.esito === 'inviata' ? 'verde' : 'rosso'}>{e.tipo}</Badge>
              {e.allegati > 0 && <span className="tw-text-slate-500">📎{e.allegati}</span>}
              <span className="tw-text-slate-500">{fmtData(e.data)}</span>
            </Riga>
          ))}
        </Sezione>

        <Sezione titolo="Consegne" icona={<ClipboardList size={17} />} count={dossier.consegne.length}>
          {dossier.consegne.map((c: any) => (
            <Riga key={c._id} onClick={() => navigate(`/consegne?q=${encodeURIComponent(p.nome)}`)}>
              <span className="tw-font-semibold">{c.titolo}</span>
              <Badge tone={c.priorita === 'urgente' ? 'rosso' : 'slate'}>{c.stato.replace(/_/g, ' ')}</Badge>
              <span className="tw-text-slate-500">{fmtData(c.data)}</span>
            </Riga>
          ))}
        </Sezione>

        <Sezione titolo="Consensi GDPR" icona={<FileText size={17} />} count={dossier.gdpr?.length || 0}>
          {(dossier.gdpr || []).map((g: any) => (
            <Riga key={g._id} onClick={isConsulenza ? () => navigate(`/archivi-intermediazione?paziente=${p._id}&nome=${encodeURIComponent(p.nome)}`) : undefined}>
              <span className="tw-font-semibold">{g.firmatario || 'Firmatario'}</span>
              <Badge tone={g.revocato ? 'rosso' : 'verde'}>{g.revocato ? 'Revocato' : 'Valido'}</Badge>
              {g.contesto && <Badge>{g.contesto}</Badge>}
              <span className="tw-text-slate-500">{fmtData(g.dataFirma)}</span>
            </Riga>
          ))}
        </Sezione>

        {!dossier.documenti.length && !dossier.piani.length && !dossier.contratti.length && !dossier.email.length && (
          <p className="tw-text-slate-500 tw-text-center tw-py-8">Nessun record collegato a questo paziente.</p>
        )}
      </div>
    );
  }

  // ════ VISTA RICERCA ════
  return (
    <div className="page-container tw-max-w-4xl">
      <h1 className="tw-text-2xl tw-font-bold tw-text-slate-900 tw-mb-1">Ricerca globale</h1>
      <p className="tw-text-sm tw-text-slate-500 tw-mb-4">
        Cerca in {isConsulenza ? 'Intermediazioni' : 'Gestione Privata'}: pazienti, operatori, preventivi, fatture, contratti, email, consegne.
      </p>

      <form onSubmit={cerca} className="tw-flex tw-gap-2 tw-mb-5">
        <div className="tw-relative tw-flex-1">
          <Search size={17} className="tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-slate-400" />
          <input
            value={input} onChange={(e) => setInput(e.target.value)} autoFocus
            placeholder="Nome paziente, operatore, n° preventivo, email, oggetto…"
            className="tw-w-full tw-pl-9 tw-pr-3 tw-py-2.5 tw-border tw-border-slate-300 tw-rounded-xl tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-300"
          />
        </div>
        <button type="submit" className="tw-bg-blue-800 tw-text-white tw-px-5 tw-rounded-xl tw-font-bold tw-text-sm">Cerca</button>
      </form>

      {loading && <p className="tw-text-slate-500 tw-text-center tw-py-8">Ricerca in corso…</p>}
      {errore && <p className="tw-text-red-600 tw-text-center tw-py-8">{errore}</p>}
      {!loading && !dati && !errore && (
        <div className="tw-text-center tw-py-12 tw-text-slate-400">
          <Search size={44} className="tw-mx-auto tw-mb-3 tw-opacity-40" />
          <p>Scrivi un nome o un termine e trovo tutto quello che lo riguarda nel gestionale.</p>
        </div>
      )}

      {dati && (
        <>
          <Sezione titolo="Pazienti" icona={<User size={17} />} count={dati.pazienti.length}>
            {dati.pazienti.map((p: any) => (
              <Riga key={p._id} onClick={() => setParams({ paziente: p._id })}>
                <span className="tw-font-bold">{p.nome}</span>
                <Badge tone={p.tipoGestione === 'consulenza' ? 'giallo' : 'blu'}>
                  {p.tipoGestione === 'consulenza' ? 'Intermediazione' : p.tipoGestione === 'convenzione' ? 'SIAT' : 'Privato'}
                </Badge>
                {p.indirizzo && <span className="tw-text-slate-500">{p.indirizzo}</span>}
                {p.telefono && <span className="tw-text-slate-500">{p.telefono}</span>}
                {p.email && <span className="tw-text-slate-500">{p.email}</span>}
              </Riga>
            ))}
          </Sezione>

          <Sezione titolo="Operatori / personale" icona={<Users size={17} />} count={dati.operatori.length + dati.candidati.length}>
            {dati.operatori.map((s: any) => (
              <Riga key={s._id} onClick={() => navigate('/staff')}>
                <span className="tw-font-bold">{s.nome}</span>
                <Badge tone="blu">{s.ruolo || s.categoria}</Badge>
                {s.citta && <span className="tw-text-slate-500">{s.citta}{s.indirizzo ? ` — ${s.indirizzo}` : ''}</span>}
                {s.telefono && <span className="tw-text-slate-500">{s.telefono}</span>}
              </Riga>
            ))}
            {dati.candidati.map((c: any) => (
              <Riga key={c._id} onClick={() => navigate('/badanti-intermediazione')}>
                <span className="tw-font-bold">{c.nome}</span>
                <Badge tone="giallo">Candidato · {c.ruolo}</Badge>
                <Badge tone={c.stato === 'accettato' ? 'verde' : c.stato === 'rifiutato' ? 'rosso' : 'slate'}>{c.stato}</Badge>
                {c.citta && <span className="tw-text-slate-500">{c.citta}</span>}
                {c.telefono && <span className="tw-text-slate-500">{c.telefono}</span>}
              </Riga>
            ))}
          </Sezione>

          <Sezione titolo="Preventivi e fatture" icona={<Receipt size={17} />} count={dati.documenti.length}>
            {dati.documenti.map((d: any) => (
              <Riga key={d._id} onClick={() => d.pazienteId && setParams({ paziente: d.pazienteId })}>
                <span className="tw-font-bold">{d.numero}</span>
                <Badge tone={d.tipo === 'fattura' ? 'blu' : 'giallo'}>{d.tipo}</Badge>
                <span>{fmtEuro(d.totale)}</span>
                {d.paziente && <span className="tw-text-blue-800">{d.paziente}</span>}
                <Badge>{d.stato}</Badge>
                <span className="tw-text-slate-500">{fmtData(d.data)}</span>
              </Riga>
            ))}
          </Sezione>

          <Sezione titolo="Contratti" icona={<FileText size={17} />} count={dati.contratti.length}>
            {dati.contratti.map((c: any) => (
              <Riga key={c._id} onClick={() => apriContratto(c._id)}>
                <span className="tw-font-semibold">{c.paziente}</span>
                <span className="tw-text-slate-600">{c.profilo}</span>
                <Badge tone={c.stato === 'firmato' ? 'verde' : 'giallo'}>{c.stato || 'bozza'}</Badge>
                <span className="tw-text-slate-500">{fmtData(c.data)}</span>
              </Riga>
            ))}
          </Sezione>

          <Sezione titolo="Richieste" icona={<ClipboardList size={17} />} count={dati.richieste.length}>
            {dati.richieste.map((r: any) => (
              <Riga key={r._id} onClick={() => navigate(isConsulenza ? '/badanti-intermediazione' : '/centro-prenotazioni')}>
                <span className="tw-font-semibold">{r.paziente}</span>
                <span className="tw-text-slate-600">{r.tipoServizio}</span>
                <Badge>{r.stato}</Badge>
                <span className="tw-text-slate-500">{fmtData(r.data)}</span>
              </Riga>
            ))}
          </Sezione>

          <Sezione titolo="Email" icona={<Mail size={17} />} count={dati.email.length}>
            {dati.email.map((e: any) => (
              <Riga key={e._id} onClick={() => navigate(`/archivio-email?q=${encodeURIComponent(e.to)}`)}>
                <span className="tw-font-semibold tw-truncate tw-max-w-[55%]">{e.subject}</span>
                <span className="tw-text-slate-500">→ {e.to}</span>
                <Badge tone={e.esito === 'inviata' ? 'verde' : 'rosso'}>{e.tipo}</Badge>
                <span className="tw-text-slate-500">{fmtData(e.data)}</span>
              </Riga>
            ))}
          </Sezione>

          <Sezione titolo="Consegne" icona={<ClipboardList size={17} />} count={dati.consegne.length}>
            {dati.consegne.map((c: any) => (
              <Riga key={c._id} onClick={() => navigate(`/consegne?q=${encodeURIComponent(q)}`)}>
                <span className="tw-font-semibold">{c.titolo}</span>
                <Badge tone={c.priorita === 'urgente' ? 'rosso' : 'slate'}>{c.stato.replace(/_/g, ' ')}</Badge>
                <span className="tw-text-slate-500">{fmtData(c.data)}</span>
              </Riga>
            ))}
          </Sezione>

          {!dati.pazienti.length && !dati.operatori.length && !dati.candidati.length &&
            !dati.documenti.length && !dati.contratti.length && !dati.richieste.length &&
            !dati.email.length && !dati.consegne.length && (
            <p className="tw-text-slate-500 tw-text-center tw-py-10">Nessun risultato per «{q}».</p>
          )}
        </>
      )}
    </div>
  );
}

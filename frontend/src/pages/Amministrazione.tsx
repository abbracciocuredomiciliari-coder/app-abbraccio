import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { Plus, Euro, Send, Paperclip, AlertTriangle, RefreshCw, FileDown, Receipt, Archive, ClipboardList, Calculator, Tag, Inbox, ArrowRight } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// AMMINISTRAZIONE UNICA — archivio condiviso dei documenti economici di tutte
// le aree autorizzate, organizzato in sezioni navigabili (stile demo back
// office). Distinti sempre: documento emesso ≠ trasmesso ≠ pagato ≠ archiviato
// ≠ consegnato al commercialista.
// ═════════════════════════════════════════════════════════════════════════════

interface Riga {
  id: string;
  origine: 'fattura' | 'preventivo' | 'nota_credito' | 'invio' | 'ritenuta' | 'fattura_ricevuta';
  area: string;
  numero: string;
  soggetto: string;
  data: string;
  totale?: number;
  statoDoc?: string;
  statoPagamento?: string;
  scadenzaPagamento?: string;
  dataTrasmissione?: string;
  incassato?: number;
  pagato?: number;
  nota?: string;
  hasAllegato?: boolean;
  praticaTipo?: string;
  praticaId?: string;
  praticaLabel?: string;
  aggiornatoIl?: string;
}

interface Conteggi { daIncassare: number; daPagare: number; fattureScadute: number; fattureRicevute: number }

type Sezione = 'panoramica' | 'documenti' | 'incassi' | 'fornitori' | 'scadenze' | 'lavorazioni' | 'commercialista' | 'archivio';

const SEZIONI: { id: Sezione; label: string }[] = [
  { id: 'panoramica', label: 'Panoramica' },
  { id: 'documenti', label: 'Documenti' },
  { id: 'incassi', label: 'Incassi e pagamenti' },
  { id: 'fornitori', label: 'Fornitori e pagamenti' },
  { id: 'scadenze', label: 'Scadenze' },
  { id: 'lavorazioni', label: 'Lavorazioni' },
  { id: 'commercialista', label: 'Commercialista' },
  { id: 'archivio', label: 'Archivio e consegne' },
];

const ORIGINE_LABEL: Record<string, string> = {
  fattura: '🧾 Fattura', preventivo: '📄 Preventivo', nota_credito: '↩️ Nota credito',
  invio: '📤 Invio', ritenuta: '💼 Ritenuta', fattura_ricevuta: '📥 Fatt. ricevuta',
};
const AREA_LABEL: Record<string, string> = {
  privato: 'Privato', intermediazione: 'Intermediazioni', convenzione: 'SIAT', trasversale: 'Trasversale',
};
const STATO_PAG_LABEL: Record<string, { testo: string; badge: string }> = {
  da_incassare: { testo: 'Da incassare', badge: 'ab-badge--warning' },
  parziale: { testo: 'Acconto', badge: 'ab-badge--info' },
  saldato: { testo: 'Saldato', badge: '' },
  da_pagare: { testo: 'Da pagare', badge: 'ab-badge--warning' },
  pagata: { testo: 'Pagata', badge: '' },
};

const euro = (n?: number) => `€ ${(Number(n) || 0).toFixed(2)}`;
const data = (d?: string) => { try { return d ? new Date(d).toLocaleDateString('it-IT') : '—'; } catch { return '—'; } };

export default function Amministrazione() {
  const [righe, setRighe] = useState<Riga[]>([]);
  const [conteggi, setConteggi] = useState<Conteggi | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtri, setFiltri] = useState({ area: 'tutte', origine: '', statoDoc: '', statoPagamento: '', dal: '', al: '', q: '' });
  const [showNuova, setShowNuova] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nuova, setNuova] = useState({
    fornitore: '', numero: '', data: new Date().toISOString().slice(0, 10),
    imponibile: '', iva: '', totale: '', descrizione: '', area: 'trasversale', scadenzaPagamento: '', praticaLabel: '',
  });
  const [allegato, setAllegato] = useState<{ fileName: string; contentType: string; dataBase64: string } | null>(null);
  // Selettore pratica reale per la fattura fornitore (non più testo libero)
  const [praticaTipo, setPraticaTipo] = useState('');
  const [praticaQ, setPraticaQ] = useState('');
  const [praticaRisultati, setPraticaRisultati] = useState<any[]>([]);
  const [praticaSel, setPraticaSel] = useState<{ id: string; label: string } | null>(null);
  // ── Preparazione commercialista ──
  const [commDal, setCommDal] = useState(`${new Date().getFullYear()}-01-01`);
  const [commAl, setCommAl] = useState(new Date().toISOString().slice(0, 10));
  const [commAree, setCommAree] = useState<string[]>([]);
  const [commOrigini, setCommOrigini] = useState<string[]>([]);
  const [anteprima, setAnteprima] = useState<{ totaleDocumenti: number; perOrigine: Record<string, number>; anomalie: string[]; ultimaConsegna?: any } | null>(null);
  const [consegne, setConsegne] = useState<any[]>([]);
  const [diff, setDiff] = useState<{ consegnaId: string; nuovi: any[]; modificati: any[] } | null>(null);
  const [lavorazioni, setLavorazioni] = useState<any[]>([]);
  // ── Controlli back office ──
  const [controlli, setControlli] = useState<any | null>(null);
  // ── Dettaglio laterale documento ──
  const [dettaglio, setDettaglio] = useState<Riga | null>(null);

  // ── Sezione corrente nel router: sopravvive al ritorno dal dettaglio ──
  const [searchParams, setSearchParams] = useSearchParams();
  const sezione = (searchParams.get('sezione') || 'panoramica') as Sezione;
  const setSezione = (s: Sezione) => {
    const p = new URLSearchParams(searchParams);
    p.set('sezione', s);
    setSearchParams(p, { replace: true });
  };

  const carica = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filtri.area !== 'tutte') params.area = filtri.area;
      if (filtri.statoDoc) params.statoDoc = filtri.statoDoc;
      if (filtri.statoPagamento) params.statoPagamento = filtri.statoPagamento;
      if (filtri.dal) params.dal = filtri.dal;
      if (filtri.al) params.al = filtri.al;
      if (filtri.q.trim()) params.q = filtri.q.trim();
      const [docRes, contRes, lavRes, chkRes] = await Promise.all([
        api.get('/amministrazione/documenti', { params }),
        api.get('/amministrazione/conteggi'),
        api.get('/attivita', { params: { area: 'organizzativa', vista: 'tutte' } }).catch(() => ({ data: [] })),
        api.get('/amministrazione/controlli').catch(() => ({ data: null })),
      ]);
      setRighe(docRes.data || []);
      setConteggi(contRes.data);
      setLavorazioni((lavRes.data || []).filter((a: any) => !['completata', 'annullata'].includes(a.stato)));
      setControlli(chkRes.data);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore caricamento archivio amministrativo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carica(); }, []);
  useEffect(() => { const t = setTimeout(carica, 400); return () => clearTimeout(t); }, [filtri]);

  // Righe visibili nella sezione corrente (stesso archivio, viste filtrate)
  const righeVisibili = useMemo(() => {
    switch (sezione) {
      case 'documenti':
        return filtri.origine ? righe.filter(r => r.origine === filtri.origine) : righe;
      case 'incassi':
        return righe.filter(r => r.origine === 'fattura' || r.origine === 'nota_credito');
      case 'fornitori':
        return righe.filter(r => r.origine === 'fattura_ricevuta');
      case 'scadenze':
        return righe
          .filter(r => r.scadenzaPagamento)
          .sort((a, b) => new Date(a.scadenzaPagamento!).getTime() - new Date(b.scadenzaPagamento!).getTime());
      default:
        return righe;
    }
  }, [righe, sezione, filtri.origine]);

  const conteggioControlli = controlli
    ? (controlli.totale ?? Object.values(controlli).reduce((s: number, v: any) => s + (Array.isArray(v) ? v.length : 0), 0))
    : 0;

  const registraIncasso = async (r: Riga) => {
    const residuo = (r.totale || 0) - (r.incassato || 0);
    const v = window.prompt(`Incasso per ${r.numero} — residuo ${euro(residuo)}.\nImporto incassato (€):`, residuo.toFixed(2));
    if (v === null) return;
    const importo = Number(v.replace(',', '.'));
    if (!Number.isFinite(importo) || importo <= 0) { alert('Importo non valido'); return; }
    const metodo = window.prompt('Metodo (bonifico, contanti, pos…):', 'bonifico');
    if (metodo === null) return;
    try {
      await api.post(`/amministrazione/documenti-emessi/${r.id}/incasso`, { importo, metodo: metodo.trim() || undefined });
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore registrazione incasso');
    }
  };

  const registraPagamento = async (r: Riga) => {
    const residuo = (r.totale || 0) - (r.pagato || 0);
    const v = window.prompt(`Pagamento a ${r.soggetto} — residuo ${euro(residuo)}.\nImporto pagato (€):`, residuo.toFixed(2));
    if (v === null) return;
    const importo = Number(v.replace(',', '.'));
    if (!Number.isFinite(importo) || importo <= 0) { alert('Importo non valido'); return; }
    const metodo = window.prompt('Metodo (bonifico, contanti…):', 'bonifico');
    if (metodo === null) return;
    try {
      await api.post(`/amministrazione/fatture-ricevute/${r.id}/pagamento`, { importo, metodo: metodo.trim() || undefined });
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore registrazione pagamento');
    }
  };

  const impostaScadenza = async (r: Riga) => {
    const d = window.prompt('Scadenza incasso (YYYY-MM-DD, vuoto = rimuovi):', r.scadenzaPagamento ? r.scadenzaPagamento.slice(0, 10) : '');
    if (d === null) return;
    try {
      await api.patch(`/amministrazione/documenti-emessi/${r.id}`, { scadenzaPagamento: d || undefined });
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiornamento scadenza');
    }
  };

  const segnaTrasmesso = async (r: Riga) => {
    const d = window.prompt('Data trasmissione (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!d) return;
    try {
      await api.patch(`/amministrazione/documenti-emessi/${r.id}`, { dataTrasmissione: d });
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiornamento');
    }
  };

  const apriAttivita = async (r: Riga) => {
    const titolo = window.prompt('Lavorazione back office (es. "Verifica dati fatturazione", "Sollecita incasso"):', `Verifica ${r.numero}`);
    if (!titolo) return;
    const scadenza = window.prompt('Scadenza (YYYY-MM-DD):', new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
    try {
      await api.post(`/amministrazione/documenti-emessi/${r.id}/apri-attivita`, { titolo: titolo.trim(), scadenza: scadenza || undefined });
      alert('Attività creata: la trovi in "Oggi" con responsabile e scadenza.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore creazione attività');
    }
  };

  const apriAttivitaDaControllo = async (item: any) => {
    const scadenza = window.prompt('Scadenza lavorazione (YYYY-MM-DD):', new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
    try {
      const res = await api.post('/amministrazione/controlli/apri-attivita', {
        titolo: item.titolo, dettaglio: item.dettaglio,
        praticaTipo: item.praticaTipo, praticaId: item.praticaId,
        scadenza: scadenza || undefined,
      });
      alert(res.data?.giaPresente
        ? 'Esiste già una lavorazione aperta su questo oggetto: la trovi in "Oggi".'
        : 'Lavorazione creata: la trovi in "Oggi" con responsabile e scadenza.');
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore creazione attività');
    }
  };

  const apriAllegato = async (r: Riga) => {
    try {
      const res = await api.get(`/amministrazione/fatture-ricevute/${r.id}/allegato`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      alert('Errore apertura allegato');
    }
  };

  const leggiFile = (f: File) => {
    if (f.size > 7 * 1024 * 1024) { alert('File troppo grande (max 7 MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => setAllegato({ fileName: f.name, contentType: f.type || 'application/pdf', dataBase64: String(reader.result).split(',')[1] });
    reader.readAsDataURL(f);
  };

  const salvaFatturaRicevuta = async (confermaDuplicato = false) => {
    if (!nuova.fornitore.trim() || !nuova.numero.trim() || !Number(nuova.totale)) {
      alert('Obbligatori: fornitore, numero e totale'); return;
    }
    setSaving(true);
    try {
      await api.post('/amministrazione/fatture-ricevute', {
        fornitore: { nome: nuova.fornitore.trim() },
        numero: nuova.numero.trim(), data: nuova.data,
        imponibile: nuova.imponibile ? Number(nuova.imponibile) : undefined,
        iva: nuova.iva ? Number(nuova.iva) : undefined,
        totale: Number(nuova.totale),
        descrizione: nuova.descrizione.trim() || undefined,
        area: nuova.area, scadenzaPagamento: nuova.scadenzaPagamento || undefined,
        praticaTipo: praticaSel ? praticaTipo : undefined,
        praticaId: praticaSel?.id,
        praticaLabel: praticaSel?.label,
        allegato, confermaDuplicato,
      });
      setShowNuova(false);
      setNuova({ fornitore: '', numero: '', data: new Date().toISOString().slice(0, 10), imponibile: '', iva: '', totale: '', descrizione: '', area: 'trasversale', scadenzaPagamento: '', praticaLabel: '' });
      setAllegato(null);
      setPraticaSel(null); setPraticaTipo(''); setPraticaQ(''); setPraticaRisultati([]);
      await carica();
    } catch (err: any) {
      if (err?.response?.status === 409 && window.confirm(`${err.response.data.message}\n\nRegistrare comunque?`)) {
        setSaving(false);
        return salvaFatturaRicevuta(true);
      }
      alert(err?.response?.data?.message || 'Errore registrazione fattura');
    } finally {
      setSaving(false);
    }
  };

  const caricaAnteprima = async () => {
    try {
      const res = await api.get('/amministrazione/commercialista/anteprima', { params: { dal: commDal, al: commAl, aree: commAree.join(','), origini: commOrigini.join(',') } });
      setAnteprima(res.data);
      const c = await api.get('/amministrazione/commercialista/consegne');
      setConsegne(c.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore anteprima');
    }
  };

  const registraPreparazione = async () => {
    if (!window.confirm(`Registrare la preparazione di ${anteprima?.totaleDocumenti || 0} documenti per il periodo ${commDal} → ${commAl}?\n\nQuesto NON invia nulla: crea il registro di cosa è stato preparato.`)) return;
    try {
      await api.post('/amministrazione/commercialista/consegne', { dal: commDal, al: commAl, aree: commAree, origini: commOrigini });
      await caricaAnteprima();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore registrazione preparazione');
    }
  };

  const marcaConsegnata = async (c: any) => {
    const modalita = window.prompt('Modalità di consegna (email, chiavetta, accesso diretto…):', 'email');
    if (modalita === null) return;
    try {
      await api.patch(`/amministrazione/commercialista/consegne/${c._id}`, { stato: 'consegnata', modalitaConsegna: modalita.trim() || undefined });
      await caricaAnteprima();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiornamento consegna');
    }
  };

  const vediDifferenze = async (c: any) => {
    try {
      const res = await api.get(`/amministrazione/commercialista/consegne/${c._id}/differenze`);
      setDiff({ consegnaId: c._id, nuovi: res.data.nuovi || [], modificati: res.data.modificati || [] });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore confronto');
    }
  };

  const scaricaCsv = async (c: any) => {
    try {
      const res = await api.get(`/amministrazione/commercialista/consegne/${c._id}/csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `commercialista-${c._id}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Errore esportazione CSV');
    }
  };

  const scaricaPacchetto = async (c: any) => {
    try {
      const res = await api.get(`/amministrazione/commercialista/consegne/${c._id}/pacchetto`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url; a.download = `pacchetto-commercialista-${c._id}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await caricaAnteprima();
    } catch {
      alert('Errore download pacchetto');
    }
  };

  const scaduta = (r: Riga) =>
    r.scadenzaPagamento && new Date(r.scadenzaPagamento) < new Date() &&
    r.statoPagamento && !['saldato', 'pagata'].includes(r.statoPagamento);

  // Quando si entra nella sezione commercialista carica l'anteprima una volta
  useEffect(() => {
    if (sezione === 'commercialista' && !anteprima) caricaAnteprima();
  }, [sezione]);

  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '5px' };

  // ── Tabella documenti condivisa dalle sezioni elenco ──
  const TabellaDocumenti = ({ rows }: { rows: Riga[] }) => (
    <div className="ab-table-wrap" role="region" aria-label="Elenco documenti" tabIndex={0}>
      <table className="ab-table">
        <thead>
          <tr>
            <th scope="col">Documento</th>
            <th scope="col">Area</th>
            <th scope="col">Soggetto</th>
            <th scope="col">Data</th>
            <th scope="col" style={{ textAlign: 'right' }}>Totale</th>
            <th scope="col" style={{ textAlign: 'center' }}>Stato doc.</th>
            <th scope="col" style={{ textAlign: 'center' }}>Incasso/Pagamento</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const stPag = r.statoPagamento ? STATO_PAG_LABEL[r.statoPagamento] : undefined;
            const residuo = r.origine === 'fattura' || r.origine === 'nota_credito' ? (r.totale || 0) - (r.incassato || 0)
              : r.origine === 'fattura_ricevuta' ? (r.totale || 0) - (r.pagato || 0) : 0;
            return (
              <tr key={`${r.origine}-${r.id}`}>
                <td>
                  <div style={{ fontWeight: 600 }}>{ORIGINE_LABEL[r.origine] || r.origine}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--gray-500)' }}>{r.numero}{r.nota ? ` · ${r.nota}` : ''}</div>
                </td>
                <td><span className="ab-badge">{AREA_LABEL[r.area] || r.area}</span></td>
                <td style={{ fontWeight: 600 }}>{r.soggetto}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{data(r.data)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {r.totale !== undefined ? euro(r.totale) : '—'}
                  {residuo > 0 && stPag && <div style={{ fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 600 }}>residuo {euro(residuo)}</div>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {r.statoDoc && <span className="ab-badge ab-badge--neutral">{r.statoDoc}{r.dataTrasmissione ? ' · trasm.' : ''}</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {stPag ? (
                    <span className={`ab-badge ${scaduta(r) ? 'ab-badge--danger' : stPag.badge}`}>
                      {stPag.testo}{scaduta(r) ? ' · scaduto' : ''}
                    </span>
                  ) : '—'}
                  {r.scadenzaPagamento && <div style={{ fontSize: '0.7rem', color: scaduta(r) ? 'var(--danger)' : 'var(--gray-500)', marginTop: '3px' }}>scad. {data(r.scadenzaPagamento)}</div>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="ab-btn ab-btn--sm" onClick={() => setDettaglio(r)} title="Apri dettaglio documento">Dettaglio →</button>
                    {r.origine === 'fattura' && r.statoPagamento !== 'saldato' && (
                      <button className="ab-btn ab-btn--sm" onClick={() => registraIncasso(r)} title="Registra incasso / acconto"><Euro size={12} /> Incasso</button>
                    )}
                    {r.origine === 'fattura' && (
                      <button className="ab-btn ab-btn--sm" onClick={() => impostaScadenza(r)} title="Scadenza incasso">📅</button>
                    )}
                    {(r.origine === 'fattura' || r.origine === 'nota_credito') && !r.dataTrasmissione && (
                      <button className="ab-btn ab-btn--sm" onClick={() => segnaTrasmesso(r)} title="Segna data trasmissione"><Send size={12} /></button>
                    )}
                    {['fattura', 'preventivo', 'nota_credito'].includes(r.origine) && (
                      <button className="ab-btn ab-btn--sm" onClick={() => apriAttivita(r)} title="Apri lavorazione back office su questo documento">☑ attività</button>
                    )}
                    {r.origine === 'fattura_ricevuta' && r.statoPagamento !== 'pagata' && (
                      <button className="ab-btn ab-btn--sm" onClick={() => registraPagamento(r)} title="Registra pagamento"><Euro size={12} /> Paga</button>
                    )}
                    {r.hasAllegato && (
                      <button className="ab-btn ab-btn--sm" onClick={() => apriAllegato(r)} title="Apri allegato"><Paperclip size={12} /></button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ── Barra filtri condivisa ──
  const BarraFiltri = ({ mostraOrigine }: { mostraOrigine: boolean }) => (
    <form className="ab-filters" onSubmit={e => { e.preventDefault(); carica(); }}>
      <label className="ab-field">Area
        <select className="ab-input" value={filtri.area} onChange={e => setFiltri({ ...filtri, area: e.target.value })}>
          <option value="tutte">Tutte le aree autorizzate</option>
          <option value="privato">Gestione privata</option>
          <option value="intermediazione">Intermediazioni</option>
          <option value="convenzione">Convenzione SIAT</option>
          <option value="trasversale">Trasversale</option>
        </select>
      </label>
      {mostraOrigine && (
        <label className="ab-field">Tipo documento
          <select className="ab-input" value={filtri.origine} onChange={e => setFiltri({ ...filtri, origine: e.target.value })}>
            <option value="">Tutti i documenti</option>
            <option value="fattura">Fatture emesse</option>
            <option value="preventivo">Preventivi</option>
            <option value="nota_credito">Note di credito</option>
            <option value="fattura_ricevuta">Fatture ricevute</option>
            <option value="invio">Invii senza paziente</option>
            <option value="ritenuta">Ritenute</option>
          </select>
        </label>
      )}
      <label className="ab-field">Stato incasso/pagamento
        <select className="ab-input" value={filtri.statoPagamento} onChange={e => setFiltri({ ...filtri, statoPagamento: e.target.value })}>
          <option value="">Tutti</option>
          <option value="da_incassare">Da incassare</option>
          <option value="parziale">Acconto</option>
          <option value="saldato">Saldato</option>
          <option value="da_pagare">Da pagare</option>
          <option value="pagata">Pagata</option>
        </select>
      </label>
      <label className="ab-field" style={{ minWidth: '130px' }}>Dal
        <input className="ab-input" type="date" value={filtri.dal} onChange={e => setFiltri({ ...filtri, dal: e.target.value })} />
      </label>
      <label className="ab-field" style={{ minWidth: '130px' }}>Al
        <input className="ab-input" type="date" min={filtri.dal || undefined} value={filtri.al} onChange={e => setFiltri({ ...filtri, al: e.target.value })} />
      </label>
      <label className="ab-field" style={{ flex: '1 1 180px' }}>Cerca documento o soggetto
        <input className="ab-input" type="search" value={filtri.q} onChange={e => setFiltri({ ...filtri, q: e.target.value })} placeholder="Numero, soggetto…" />
      </label>
      <button className="ab-btn ab-btn--primary" type="submit">Applica filtri</button>
      <button className="ab-btn" type="button" onClick={() => setFiltri({ area: 'tutte', origine: '', statoDoc: '', statoPagamento: '', dal: '', al: '', q: '' })}>Azzera</button>
    </form>
  );

  // ── Form nuova fattura fornitore ──
  const FormFatturaRicevuta = (
    <div className="ab-panel" style={{ borderLeft: '3px solid var(--brand-700)' }}>
      <div className="ab-panel-head"><h2 className="ab-h2">Registra fattura ricevuta (fornitore / professionista)</h2></div>
      <div className="ab-panel-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
          <div><span style={lbl}>Fornitore *</span><input className="ab-input" style={{ width: '100%' }} value={nuova.fornitore} onChange={e => setNuova({ ...nuova, fornitore: e.target.value })} placeholder="Ragione sociale" /></div>
          <div><span style={lbl}>Numero doc. *</span><input className="ab-input" style={{ width: '100%' }} value={nuova.numero} onChange={e => setNuova({ ...nuova, numero: e.target.value })} /></div>
          <div><span style={lbl}>Data</span><input className="ab-input" style={{ width: '100%' }} type="date" value={nuova.data} onChange={e => setNuova({ ...nuova, data: e.target.value })} /></div>
          <div><span style={lbl}>Imponibile €</span><input className="ab-input" style={{ width: '100%' }} type="number" step="0.01" value={nuova.imponibile} onChange={e => setNuova({ ...nuova, imponibile: e.target.value })} /></div>
          <div><span style={lbl}>IVA €</span><input className="ab-input" style={{ width: '100%' }} type="number" step="0.01" value={nuova.iva} onChange={e => setNuova({ ...nuova, iva: e.target.value })} /></div>
          <div><span style={lbl}>Totale € *</span><input className="ab-input" style={{ width: '100%' }} type="number" step="0.01" value={nuova.totale} onChange={e => setNuova({ ...nuova, totale: e.target.value })} /></div>
          <div><span style={lbl}>Scadenza pagamento</span><input className="ab-input" style={{ width: '100%' }} type="date" value={nuova.scadenzaPagamento} onChange={e => setNuova({ ...nuova, scadenzaPagamento: e.target.value })} /></div>
          <div><span style={lbl}>Area</span>
            <select className="ab-input" style={{ width: '100%' }} value={nuova.area} onChange={e => setNuova({ ...nuova, area: e.target.value })}>
              <option value="trasversale">Trasversale</option>
              <option value="privato">Gestione privata</option>
              <option value="intermediazione">Intermediazioni</option>
              <option value="convenzione">Convenzione SIAT</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div><span style={lbl}>Descrizione</span><input className="ab-input" style={{ width: '100%' }} value={nuova.descrizione} onChange={e => setNuova({ ...nuova, descrizione: e.target.value })} placeholder="Es. materiali sanitari ottobre" /></div>
          <div>
            <span style={lbl}>Pratica collegata (opz.)</span>
            {praticaSel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: '6px', padding: '8px 10px', fontSize: '0.84rem' }}>
                <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{praticaSel.label}</strong>
                <button type="button" onClick={() => setPraticaSel(null)} style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}>✕</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select className="ab-input" style={{ width: '130px', flexShrink: 0 }} value={praticaTipo} onChange={async e => {
                    setPraticaTipo(e.target.value);
                    if (e.target.value) {
                      const res = await api.get('/attivita/pratiche', { params: { tipo: e.target.value, q: praticaQ } }).catch(() => ({ data: [] }));
                      setPraticaRisultati(Array.isArray(res.data) ? res.data : []);
                    } else setPraticaRisultati([]);
                  }}>
                    <option value="">Tipo…</option>
                    <option value="paziente">Paziente</option>
                    <option value="richiesta">Richiesta</option>
                    <option value="intermediazione">Intermediazione</option>
                    <option value="consegna">Consegna</option>
                    <option value="documento">Documento</option>
                  </select>
                  <input className="ab-input" style={{ flex: 1 }} value={praticaQ} placeholder="Cerca pratica…" onChange={async e => {
                    setPraticaQ(e.target.value);
                    if (praticaTipo) {
                      const res = await api.get('/attivita/pratiche', { params: { tipo: praticaTipo, q: e.target.value } }).catch(() => ({ data: [] }));
                      setPraticaRisultati(Array.isArray(res.data) ? res.data : []);
                    }
                  }} />
                </div>
                {praticaRisultati.length > 0 && (
                  <div style={{ marginTop: '4px', border: '1px solid var(--gray-200)', borderRadius: '6px', maxHeight: '140px', overflowY: 'auto', background: 'white' }}>
                    {praticaRisultati.map((p: any) => (
                      <div key={p.id} onClick={() => { setPraticaSel({ id: p.id, label: p.label }); setPraticaRisultati([]); }}
                        style={{ padding: '7px 10px', fontSize: '0.82rem', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-50)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <strong>{p.label}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <span style={lbl}>Allegato PDF (max 7 MB)</span>
            <input type="file" accept="application/pdf,image/*" onChange={e => e.target.files?.[0] && leggiFile(e.target.files[0])} style={{ fontSize: '0.82rem' }} />
            {allegato && <span style={{ fontSize: '0.78rem', color: 'var(--success)' }}>📎 {allegato.fileName}</span>}
          </div>
        </div>
        <div className="ab-actions">
          <button className="ab-btn ab-btn--primary" onClick={() => salvaFatturaRicevuta()} disabled={saving}>{saving ? 'Salvataggio…' : 'Registra fattura'}</button>
          <button className="ab-btn" onClick={() => setShowNuova(false)}>Annulla</button>
        </div>
      </div>
    </div>
  );

  // ── Contenuto sezioni ──
  const sezioneContenuto = () => {
    if (loading) return <p role="status" className="ab-empty">Caricamento dati aggiornati…</p>;

    switch (sezione) {
      case 'panoramica':
        return (
          <>
            <div className="ab-kpis">
              <button type="button" className="ab-kpi ab-kpi--warn" onClick={() => setSezione('incassi')}>
                <div className="ab-kpi-label">Da incassare</div>
                <div className="ab-kpi-value">{conteggi ? euro(conteggi.daIncassare) : '—'}</div>
                <div className="ab-kpi-foot">fatture emesse non saldate</div>
              </button>
              <button type="button" className="ab-kpi ab-kpi--warn" onClick={() => setSezione('fornitori')}>
                <div className="ab-kpi-label">Da pagare (fornitori)</div>
                <div className="ab-kpi-value">{conteggi ? euro(conteggi.daPagare) : '—'}</div>
                <div className="ab-kpi-foot">fatture ricevute non pagate</div>
              </button>
              <button type="button" className="ab-kpi ab-kpi--danger" onClick={() => setSezione('scadenze')}>
                <div className="ab-kpi-label">Scadute</div>
                <div className="ab-kpi-value">{conteggi ? conteggi.fattureScadute : '—'}</div>
                <div className="ab-kpi-foot">incassi oltre la data di scadenza</div>
              </button>
              <button type="button" className="ab-kpi" onClick={() => setSezione('lavorazioni')}>
                <div className="ab-kpi-label">Controlli e lavorazioni</div>
                <div className="ab-kpi-value">{conteggioControlli + lavorazioni.length}</div>
                <div className="ab-kpi-foot">{conteggioControlli} controlli · {lavorazioni.length} lavorazioni aperte</div>
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', margin: '-10px 0 20px' }}>
              Valori sull'intero archivio autorizzato (non solo la pagina visibile). «Da incassare/da pagare» = residuo su documenti non saldati; «Scadute» = scadenza incasso/pagamento superata.
            </p>

            {conteggioControlli > 0 && (
              <div className="ab-notice ab-notice--danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span>⚠ {conteggioControlli} controlli amministrativi in sospeso (numerazioni, dati fiscali, scadenze).</span>
                <button className="ab-btn ab-btn--sm" onClick={() => setSezione('lavorazioni')}>Vai ai controlli</button>
              </div>
            )}

            <div className="ab-panel">
              <div className="ab-panel-head">
                <h2 className="ab-h2">Strumenti di gestione</h2>
                <span className="ab-count">accessi rapidi</span>
              </div>
              <div className="ab-panel-body" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  ['/gestione-fatturazione', <Receipt size={16} />, 'Nuova fattura / preventivo'],
                  ['/archivio-fatture', <Archive size={16} />, 'Archivio fatture'],
                  ['/archivio-preventivi', <ClipboardList size={16} />, 'Archivio preventivi'],
                  ['/compenso-incarichi', <Euro size={16} />, 'Compensi incarichi'],
                  ['/gestione-ritenute', <Euro size={16} />, 'Ritenute professionisti'],
                  ['/tariffario', <Tag size={16} />, 'Tariffario'],
                  ['/preventivo-veloce', <Calculator size={16} />, 'Preventivo veloce'],
                  ['/esportazione-siat', <FileDown size={16} />, 'Rendicontazione SIAT'],
                ].map(([to, icon, label]) => (
                  <Link key={to as string} to={to as string} className="ab-btn">{icon}{label}</Link>
                ))}
              </div>
            </div>

            <div className="ab-notice" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--warning)' }} />
              <span>Le numerazioni e le regole contabili (note di credito, acconti, registri IVA) vanno verificate con il commercialista prima dell'uso fiscale. I documenti esistenti restano nelle gestioni dedicate; questo archivio li aggrega per la direzione con origine e stato riconoscibili.</span>
            </div>
          </>
        );

      case 'documenti':
        return (
          <div className="ab-panel">
            <div className="ab-panel-head">
              <h2 className="ab-h2">Documenti</h2>
              <span className="ab-count">{righeVisibili.length} risultati</span>
            </div>
            <BarraFiltri mostraOrigine />
            {righeVisibili.length === 0
              ? <p className="ab-empty">Nessun documento corrisponde ai filtri selezionati.</p>
              : <TabellaDocumenti rows={righeVisibili} />}
          </div>
        );

      case 'incassi':
        return (
          <>
            <div className="ab-notice">
              Incassi su fatture emesse e note di credito: importo, data, metodo e residuo restano tracciati. Una registrazione qui non esegue nessuna transazione bancaria.
            </div>
            <div className="ab-panel">
              <div className="ab-panel-head">
                <h2 className="ab-h2">Incassi e pagamenti documenti emessi</h2>
                <span className="ab-count">{righeVisibili.length} documenti</span>
              </div>
              <BarraFiltri mostraOrigine={false} />
              {righeVisibili.length === 0
                ? <p className="ab-empty">Nessuna fattura emessa o nota di credito con questi filtri.</p>
                : <TabellaDocumenti rows={righeVisibili} />}
            </div>
          </>
        );

      case 'fornitori':
        return (
          <>
            <div className="ab-actions" style={{ marginBottom: '16px' }}>
              <button className="ab-btn ab-btn--primary" onClick={() => setShowNuova(v => !v)}>
                <Plus size={15} /> Fattura fornitore
              </button>
            </div>
            {showNuova && FormFatturaRicevuta}
            <div className="ab-panel">
              <div className="ab-panel-head">
                <h2 className="ab-h2">Fatture ricevute e pagamenti fornitori</h2>
                <span className="ab-count">{righeVisibili.length} documenti</span>
              </div>
              <BarraFiltri mostraOrigine={false} />
              {righeVisibili.length === 0
                ? <p className="ab-empty">Nessuna fattura ricevuta registrata con questi filtri. Registra la prima con «Fattura fornitore».</p>
                : <TabellaDocumenti rows={righeVisibili} />}
            </div>
          </>
        );

      case 'scadenze':
        return (
          <>
            <div className="ab-notice">
              Scadenze ordinate per data: incassi attesi e pagamenti dovuti. La scadenza si imposta su ciascun documento; gli elementi scaduti sono evidenziati.
            </div>
            <div className="ab-panel">
              <div className="ab-panel-head">
                <h2 className="ab-h2">Scadenzario</h2>
                <span className="ab-count">{righeVisibili.length} scadenze</span>
              </div>
              <BarraFiltri mostraOrigine={false} />
              {righeVisibili.length === 0
                ? <p className="ab-empty">Nessuna scadenza registrata sui documenti filtrati.</p>
                : <TabellaDocumenti rows={righeVisibili} />}
            </div>
          </>
        );

      case 'lavorazioni':
        return (
          <>
            {/* ── Controlli back office ── */}
            {controlli && (
              <div className="ab-panel" style={{ borderLeft: '3px solid var(--danger)' }}>
                <div className="ab-panel-head">
                  <h2 className="ab-h2">Controlli da fare</h2>
                  <span className="ab-count">{conteggioControlli} segnalazioni</span>
                </div>
                <div className="ab-panel-body" style={{ display: 'grid', gap: '14px' }}>
                  {([
                    ['cfMancanti', 'Fatture senza codice fiscale'],
                    ['incassiScaduti', 'Incassi scaduti non saldati'],
                    ['pagamentiScaduti', 'Pagamenti fornitori scaduti'],
                    ['inviiSenzaEsito', 'Preventivi inviati senza riscontro (>7gg)'],
                    ['consegneDaConsegnare', 'Preparazioni commercialista da consegnare'],
                    ['lavorazioniScadute', 'Lavorazioni back office scadute'],
                    ['buchiNumerazione', 'Buchi di numerazione'],
                  ] as const).map(([k, label]) => {
                    const items = (controlli[k] as any[]) || [];
                    if (items.length === 0) return null;
                    return (
                      <div key={k} style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '10px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '6px' }}>
                          {label} ({items.length})
                        </div>
                        {items.slice(0, 10).map((it: any) => (
                          <div key={it.id} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', padding: '5px 0', fontSize: '0.82rem' }}>
                            <strong>{it.titolo}</strong>
                            <span style={{ color: 'var(--gray-500)' }}>{it.dettaglio}</span>
                            {it.attivitaAperta ? (
                              <span className="ab-badge ab-badge--warning" style={{ marginLeft: 'auto' }} title={`${it.attivitaAperta.titolo} · ${it.attivitaAperta.responsabile || 'da assegnare'}${it.attivitaAperta.scadenza ? ` · scad. ${data(it.attivitaAperta.scadenza)}` : ''}`}>
                                ☑ già presa in carico
                              </span>
                            ) : it.praticaId ? (
                              <button onClick={() => apriAttivitaDaControllo(it)} className="ab-btn ab-btn--sm" style={{ marginLeft: 'auto' }}>☑ attività</button>
                            ) : null}
                          </div>
                        ))}
                        {items.length > 10 && <div style={{ fontSize: '0.76rem', color: 'var(--gray-500)' }}>…e altri {items.length - 10}</div>}
                      </div>
                    );
                  })}
                  {!(conteggioControlli > 0) && (
                    <div className="ab-notice" style={{ margin: 0 }}>✓ Nessun controllo in sospeso.</div>
                  )}
                </div>
              </div>
            )}

            {/* ── Lavorazioni back office ── */}
            <div className="ab-panel" style={{ borderLeft: '3px solid var(--info)' }}>
              <div className="ab-panel-head">
                <h2 className="ab-h2">Lavorazioni back office aperte</h2>
                <span className="ab-count">{lavorazioni.length}</span>
              </div>
              <div className="ab-panel-body">
                {lavorazioni.length === 0 && <p className="ab-empty" style={{ padding: '18px' }}>Nessuna lavorazione aperta.</p>}
                {lavorazioni.slice(0, 8).map(a => {
                  const scad = a.scadenza && new Date(a.scadenza) < new Date();
                  return (
                    <div key={a._id} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--gray-100)', fontSize: '0.84rem' }}>
                      <strong>{a.titolo}</strong>
                      {a.praticaLabel && <span style={{ color: 'var(--gray-500)' }}>· {a.praticaLabel}</span>}
                      <span style={{ color: 'var(--gray-500)' }}>👤 {a.responsabileNome || 'da assegnare'}</span>
                      {a.scadenza && <span style={{ color: scad ? 'var(--danger)' : 'var(--gray-500)', fontWeight: scad ? 700 : 400 }}>⏰ {data(a.scadenza)}{scad ? ' — scaduta' : ''}</span>}
                      <span className="ab-badge ab-badge--neutral" style={{ marginLeft: 'auto' }}>{a.stato}</span>
                      <Link to="/oggi" className="ab-link" style={{ fontSize: '0.78rem' }}>apri →</Link>
                    </div>
                  );
                })}
                {lavorazioni.length > 8 && <Link to="/oggi" className="ab-link" style={{ fontSize: '0.8rem' }}>Vedi tutte in "Oggi" →</Link>}
              </div>
            </div>
          </>
        );

      case 'commercialista':
        return (
          <div className="ab-panel" style={{ borderLeft: '3px solid var(--purple)' }}>
            <div className="ab-panel-head">
              <h2 className="ab-h2">Prepara documenti per il commercialista</h2>
            </div>
            <div className="ab-panel-body">
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
                <label className="ab-field" style={{ minWidth: '140px' }}>Dal
                  <input className="ab-input" type="date" value={commDal} onChange={e => { setCommDal(e.target.value); setAnteprima(null); }} />
                </label>
                <label className="ab-field" style={{ minWidth: '140px' }}>Al
                  <input className="ab-input" type="date" value={commAl} onChange={e => { setCommAl(e.target.value); setAnteprima(null); }} />
                </label>
                <div>
                  <span style={lbl}>Aree (vuoto = tutte)</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {(['privato', 'intermediazione', 'convenzione', 'trasversale'] as const).map(a => (
                      <button key={a} type="button" onClick={() => { setCommAree(v => v.includes(a) ? v.filter(x => x !== a) : [...v, a]); setAnteprima(null); }}
                        style={{ border: 'none', borderRadius: '12px', padding: '5px 12px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', background: commAree.includes(a) ? 'var(--brand-700)' : 'var(--gray-100)', color: commAree.includes(a) ? 'white' : 'var(--gray-600)' }}>
                        {AREA_LABEL[a]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span style={lbl}>Tipi documento (vuoto = tutti)</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {(['fattura', 'preventivo', 'nota_credito', 'fattura_ricevuta', 'ritenuta', 'invio'] as const).map(o => (
                      <button key={o} type="button" onClick={() => { setCommOrigini(v => v.includes(o) ? v.filter(x => x !== o) : [...v, o]); setAnteprima(null); }}
                        style={{ border: 'none', borderRadius: '12px', padding: '5px 12px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', background: commOrigini.includes(o) ? 'var(--brand-700)' : 'var(--gray-100)', color: commOrigini.includes(o) ? 'white' : 'var(--gray-600)' }}>
                        {(ORIGINE_LABEL[o] || o).replace(/^\S+\s/, '')}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="ab-btn" onClick={caricaAnteprima}>Aggiorna riepilogo</button>
                {anteprima && <button className="ab-btn ab-btn--primary" onClick={registraPreparazione}><FileDown size={15} /> Registra preparazione</button>}
              </div>

              {anteprima && (
                <>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {Object.entries(anteprima.perOrigine).map(([o, n]) => (
                      <span key={o} className="ab-badge ab-badge--info">
                        {ORIGINE_LABEL[o] || o}: {n}
                      </span>
                    ))}
                    <span className="ab-badge" style={{ fontWeight: 800 }}>Totale: {anteprima.totaleDocumenti}</span>
                  </div>
                  {anteprima.anomalie.length > 0 ? (
                    <div className="ab-notice ab-notice--warning">
                      <strong>⚠ {anteprima.anomalie.length} anomalie da verificare prima della consegna:</strong>
                      <ul style={{ margin: '6px 0 0', paddingLeft: '18px', maxHeight: '160px', overflowY: 'auto' }}>
                        {anteprima.anomalie.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <div className="ab-notice">✓ Nessuna anomalia rilevata nel periodo (buchi numerazione, CF mancanti, duplicati, importi a zero).</div>
                  )}
                  {anteprima.ultimaConsegna && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                      Ultima preparazione: {data(anteprima.ultimaConsegna.preparataIl)} — stato {anteprima.ultimaConsegna.stato}
                    </p>
                  )}
                </>
              )}

              {/* Registro consegne */}
              {consegne.length > 0 && (
                <>
                  <h4 style={{ margin: '16px 0 8px', fontSize: '0.9rem', color: 'var(--gray-600)' }}>Registro preparazioni</h4>
                  {consegne.map(c => (
                    <div key={c._id} style={{ border: '1px solid var(--gray-200)', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', fontSize: '0.84rem' }}>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <strong>{data(c.periodoDal)} → {data(c.periodoAl)}</strong>
                        <span style={{ color: 'var(--gray-500)' }}>{c.tipologie?.length ? c.tipologie.length : 0} tipologie · preparata il {data(c.preparataIl)}{c.preparataDa ? ` da ${c.preparataDa}` : ''}</span>
                        <span className={`ab-badge ${c.stato === 'verificata' ? '' : c.stato === 'consegnata' ? 'ab-badge--info' : 'ab-badge--warning'}`}>
                          {c.stato}{c.scaricataIl ? ` · scaricata il ${data(c.scaricataIl)}` : ''}{c.consegnataIl ? ` · consegnata il ${data(c.consegnataIl)}` : ''}{c.modalitaConsegna ? ` · ${c.modalitaConsegna}` : ''}
                        </span>
                        {c.anomalie?.length > 0 && <span style={{ fontSize: '0.74rem', color: 'var(--warning)' }}>⚠ {c.anomalie.length} anomalie</span>}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button onClick={() => scaricaPacchetto(c)} className="ab-btn ab-btn--sm ab-btn--primary" title="ZIP con indice e originali disponibili — registrato come download, NON come consegna">⬇ pacchetto</button>
                          <button onClick={() => scaricaCsv(c)} className="ab-btn ab-btn--sm">CSV</button>
                          <button onClick={() => vediDifferenze(c)} className="ab-btn ab-btn--sm">differenze</button>
                          {['preparata', 'scaricata'].includes(c.stato) && (
                            <button onClick={() => marcaConsegnata(c)} className="ab-btn ab-btn--sm">Marca consegnata</button>
                          )}
                        </div>
                      </div>
                      {diff && diff.consegnaId === c._id && (
                        <div style={{ marginTop: '10px', borderTop: '1px solid var(--gray-100)', paddingTop: '8px' }}>
                          {diff.nuovi.length === 0 && diff.modificati.length === 0 ? (
                            <span style={{ color: 'var(--success)' }}>✓ Nessun documento aggiunto o modificato dopo questa preparazione.</span>
                          ) : (
                            <>
                              {diff.nuovi.length > 0 && <div><strong>Aggiunti dopo ({diff.nuovi.length}):</strong> {diff.nuovi.slice(0, 8).map(r => `${r.numero} (${r.soggetto})`).join(' · ')}{diff.nuovi.length > 8 ? ' …' : ''}</div>}
                              {diff.modificati.length > 0 && <div><strong>Modificati dopo ({diff.modificati.length}):</strong> {diff.modificati.slice(0, 8).map(r => `${r.numero} (${r.soggetto})`).join(' · ')}{diff.modificati.length > 8 ? ' …' : ''}</div>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
              <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: '10px' }}>
                L'esportazione non è un invio: la consegna va marcata esplicitamente. I formati definitivi (XML, rendiconti) vanno concordati con il commercialista.
              </p>
            </div>
          </div>
        );

      case 'archivio':
        return (
          <>
            <div className="ab-notice">
              Gli archivi di dettaglio e il registro delle consegne restano nelle gestioni dedicate: questo hub li raggiunge senza duplicare i dati.
            </div>
            <div className="ab-panel">
              <div className="ab-panel-head"><h2 className="ab-h2">Archivi e consegne</h2></div>
              <div className="ab-panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                {[
                  ['/archivio-fatture', <Archive size={18} />, 'Archivio fatture', 'fatture emesse con storico e documenti'],
                  ['/archivio-preventivi', <ClipboardList size={18} />, 'Archivio preventivi', 'preventivi e versioni'],
                  ['/archivi-intermediazione', <Archive size={18} />, 'Archivi intermediazione', 'documenti dell\'area intermediazioni'],
                  ['/consegne', <Inbox size={18} />, 'Consegne amministrative', 'bacheca consegne ufficio ↔ esterno'],
                  ['/gestione-fatturazione', <Receipt size={18} />, 'Gestione fatturazione', 'emissione fatture e preventivi'],
                  ['/compenso-incarichi', <Euro size={18} />, 'Compensi incarichi', 'compensi e rendiconti operatori'],
                ].map(([to, icon, label, desc]) => (
                  <Link key={to as string} to={to as string} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: '9px', padding: '16px 18px', background: 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-700)', fontWeight: 700, fontSize: '0.88rem' }}>
                        {icon}{label}<ArrowRight size={14} style={{ marginLeft: 'auto' }} />
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: '6px' }}>{desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <section className="fade-in section-wide">
      <header className="ab-heading">
        <div>
          <p className="ab-eyebrow">Back office condiviso</p>
          <h1 className="ab-title">Amministrazione unica</h1>
          <p className="ab-subtitle">Documenti, incassi e scadenze di tutte le aree autorizzate. Emesso ≠ trasmesso ≠ pagato: ogni stato resta separato.</p>
        </div>
        <div className="ab-actions">
          <button className="ab-btn" onClick={carica} title="Ricarica"><RefreshCw size={15} /></button>
          <button className="ab-btn" onClick={() => { setSezione('fornitori'); setShowNuova(true); }}>Fattura fornitore</button>
          <Link to="/gestione-fatturazione" className="ab-btn ab-btn--primary"><Plus size={15} /> Nuovo documento</Link>
        </div>
      </header>

      <nav className="ab-tabs" aria-label="Sezioni amministrative">
        {SEZIONI.map(s => (
          <button key={s.id} type="button" className="ab-tab" aria-current={s.id === sezione ? 'page' : undefined} onClick={() => setSezione(s.id)}>
            {s.label}
            {s.id === 'lavorazioni' && conteggioControlli + lavorazioni.length > 0 ? ` (${conteggioControlli + lavorazioni.length})` : ''}
          </button>
        ))}
      </nav>

      {sezioneContenuto()}

      {/* ── Dettaglio laterale documento ── */}
      {dettaglio && (
        <div role="dialog" aria-modal="true" aria-label="Dettaglio documento"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,35,40,0.4)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setDettaglio(null); }}
          onKeyDown={e => { if (e.key === 'Escape') setDettaglio(null); }}>
          <aside style={{ background: '#fff', width: 'min(430px, 100%)', height: '100%', overflowY: 'auto', padding: '26px 24px', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <p className="ab-eyebrow" style={{ marginBottom: '4px' }}>{ORIGINE_LABEL[dettaglio.origine] || dettaglio.origine}</p>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-head)', fontSize: '1.3rem', color: 'var(--gray-900)' }}>{dettaglio.numero}</h2>
              </div>
              <button className="ab-btn ab-btn--sm" onClick={() => setDettaglio(null)} aria-label="Chiudi dettaglio">✕ Chiudi</button>
            </div>

            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', margin: '0 0 20px' }}>
              {[
                ['Soggetto', dettaglio.soggetto],
                ['Area', AREA_LABEL[dettaglio.area] || dettaglio.area],
                ['Data documento', data(dettaglio.data)],
                ['Totale', dettaglio.totale !== undefined ? euro(dettaglio.totale) : '—'],
                dettaglio.incassato !== undefined ? ['Incassato', euro(dettaglio.incassato)] : null,
                dettaglio.pagato !== undefined ? ['Pagato', euro(dettaglio.pagato)] : null,
                dettaglio.statoDoc ? ['Stato documento', `${dettaglio.statoDoc}${dettaglio.dataTrasmissione ? ` · trasmesso il ${data(dettaglio.dataTrasmissione)}` : ''}`] : null,
                dettaglio.statoPagamento ? ['Stato pagamento', STATO_PAG_LABEL[dettaglio.statoPagamento]?.testo || dettaglio.statoPagamento] : null,
                dettaglio.scadenzaPagamento ? ['Scadenza', `${data(dettaglio.scadenzaPagamento)}${scaduta(dettaglio) ? ' — scaduta' : ''}`] : null,
                dettaglio.praticaLabel || dettaglio.praticaId ? ['Pratica', dettaglio.praticaLabel || `${dettaglio.praticaTipo || ''} ${dettaglio.praticaId}`] : null,
                dettaglio.nota ? ['Nota', dettaglio.nota] : null,
                dettaglio.aggiornatoIl ? ['Ultimo aggiornamento', data(dettaglio.aggiornatoIl)] : null,
              ].filter(Boolean).map((kv: any) => (
                <div key={kv[0]}>
                  <dt style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{kv[0]}</dt>
                  <dd style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--gray-900)', overflowWrap: 'anywhere' }}>{kv[1]}</dd>
                </div>
              ))}
            </dl>

            <div className="ab-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {dettaglio.origine === 'fattura' && dettaglio.statoPagamento !== 'saldato' && (
                <button className="ab-btn ab-btn--primary" onClick={() => { const r = dettaglio; setDettaglio(null); registraIncasso(r); }}><Euro size={15} /> Registra incasso / acconto</button>
              )}
              {dettaglio.origine === 'fattura_ricevuta' && dettaglio.statoPagamento !== 'pagata' && (
                <button className="ab-btn ab-btn--primary" onClick={() => { const r = dettaglio; setDettaglio(null); registraPagamento(r); }}><Euro size={15} /> Registra pagamento</button>
              )}
              {dettaglio.origine === 'fattura' && (
                <button className="ab-btn" onClick={() => { const r = dettaglio; setDettaglio(null); impostaScadenza(r); }}>Imposta scadenza incasso</button>
              )}
              {(dettaglio.origine === 'fattura' || dettaglio.origine === 'nota_credito') && !dettaglio.dataTrasmissione && (
                <button className="ab-btn" onClick={() => { const r = dettaglio; setDettaglio(null); segnaTrasmesso(r); }}><Send size={15} /> Segna data trasmissione</button>
              )}
              {['fattura', 'preventivo', 'nota_credito'].includes(dettaglio.origine) && (
                <button className="ab-btn" onClick={() => { const r = dettaglio; setDettaglio(null); apriAttivita(r); }}>Apri lavorazione back office</button>
              )}
              {dettaglio.hasAllegato && (
                <button className="ab-btn" onClick={() => apriAllegato(dettaglio)}><Paperclip size={15} /> Apri allegato originale</button>
              )}
            </div>

            <p style={{ fontSize: '0.76rem', color: 'var(--gray-500)', marginTop: '18px', borderTop: '1px solid var(--gray-100)', paddingTop: '12px' }}>
              I documenti restano nella gestione di origine: qui vedi gli stati condivisi (emesso ≠ trasmesso ≠ pagato ≠ consegnato).
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}

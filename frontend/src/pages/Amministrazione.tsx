import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { Calculator, Plus, Euro, Send, Paperclip, AlertTriangle, RefreshCw, FileDown } from 'lucide-react';
import { Button } from '../components/ui/Button';

// ═════════════════════════════════════════════════════════════════════════════
// AMMINISTRAZIONE — archivio unico dei documenti economici di tutte le aree.
// Distinti sempre: documento emesso ≠ trasmesso ≠ pagato ≠ archiviato.
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
  aggiornatoIl?: string;
}

interface Conteggi { daIncassare: number; daPagare: number; fattureScadute: number; fattureRicevute: number }

const ORIGINE_LABEL: Record<string, string> = {
  fattura: '🧾 Fattura', preventivo: '📄 Preventivo', nota_credito: '↩️ Nota credito',
  invio: '📤 Invio', ritenuta: '💼 Ritenuta', fattura_ricevuta: '📥 Fatt. ricevuta',
};
const AREA_LABEL: Record<string, string> = {
  privato: 'Privato', intermediazione: 'Intermediazioni', convenzione: 'SIAT', trasversale: 'Trasversale',
};
const STATO_PAG_LABEL: Record<string, { testo: string; bg: string; color: string }> = {
  da_incassare: { testo: 'Da incassare', bg: '#fef3c7', color: '#92400e' },
  parziale: { testo: 'Acconto', bg: '#dbeafe', color: '#1e40af' },
  saldato: { testo: 'Saldato', bg: '#dcfce7', color: '#166534' },
  da_pagare: { testo: 'Da pagare', bg: '#fef3c7', color: '#92400e' },
  pagata: { testo: 'Pagata', bg: '#dcfce7', color: '#166534' },
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
  // ── Preparazione commercialista ──
  const [showComm, setShowComm] = useState(false);
  const [commDal, setCommDal] = useState(`${new Date().getFullYear()}-01-01`);
  const [commAl, setCommAl] = useState(new Date().toISOString().slice(0, 10));
  const [anteprima, setAnteprima] = useState<{ totaleDocumenti: number; perOrigine: Record<string, number>; anomalie: string[]; ultimaConsegna?: any } | null>(null);
  const [consegne, setConsegne] = useState<any[]>([]);
  const [diff, setDiff] = useState<{ consegnaId: string; nuovi: any[]; modificati: any[] } | null>(null);
  const [lavorazioni, setLavorazioni] = useState<any[]>([]);

  const carica = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filtri.area !== 'tutte') params.area = filtri.area;
      if (filtri.origine) params.origine = filtri.origine;
      if (filtri.statoDoc) params.statoDoc = filtri.statoDoc;
      if (filtri.statoPagamento) params.statoPagamento = filtri.statoPagamento;
      if (filtri.dal) params.dal = filtri.dal;
      if (filtri.al) params.al = filtri.al;
      if (filtri.q.trim()) params.q = filtri.q.trim();
      const [docRes, contRes, lavRes] = await Promise.all([
        api.get('/amministrazione/documenti', { params }),
        api.get('/amministrazione/conteggi'),
        api.get('/attivita', { params: { area: 'organizzativa', vista: 'tutte' } }).catch(() => ({ data: [] })),
      ]);
      setRighe(docRes.data || []);
      setConteggi(contRes.data);
      setLavorazioni((lavRes.data || []).filter((a: any) => !['completata', 'annullata'].includes(a.stato)));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore caricamento archivio amministrativo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carica(); }, []);
  useEffect(() => { const t = setTimeout(carica, 400); return () => clearTimeout(t); }, [filtri]);

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
        praticaLabel: nuova.praticaLabel.trim() || undefined,
        allegato, confermaDuplicato,
      });
      setShowNuova(false);
      setNuova({ fornitore: '', numero: '', data: new Date().toISOString().slice(0, 10), imponibile: '', iva: '', totale: '', descrizione: '', area: 'trasversale', scadenzaPagamento: '', praticaLabel: '' });
      setAllegato(null);
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
      const res = await api.get('/amministrazione/commercialista/anteprima', { params: { dal: commDal, al: commAl } });
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
      await api.post('/amministrazione/commercialista/consegne', { dal: commDal, al: commAl });
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

  const scaduta = (r: Riga) =>
    r.scadenzaPagamento && new Date(r.scadenzaPagamento) < new Date() &&
    r.statoPagamento && !['saldato', 'pagata'].includes(r.statoPagamento);

  const input: React.CSSProperties = { width: '100%', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.88rem', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' };
  const btnPiccolo: React.CSSProperties = { border: 'none', borderRadius: '6px', padding: '5px 9px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 };

  const conteggiCard = useMemo(() => [
    { label: 'Da incassare', valore: conteggi ? euro(conteggi.daIncassare) : '—', color: '#d97706' },
    { label: 'Da pagare (fornitori)', valore: conteggi ? euro(conteggi.daPagare) : '—', color: '#dc2626' },
    { label: 'Fatture scadute', valore: conteggi ? String(conteggi.fattureScadute) : '—', color: '#b91c1c' },
    { label: 'Fatture ricevute', valore: conteggi ? String(conteggi.fattureRicevute) : '—', color: '#1e4d8c' },
  ], [conteggi]);

  return (
    <section className="fade-in section-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e4d8c' }}>
            <Calculator size={26} /> Amministrazione
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '6px 0 0' }}>
            Tutti i documenti economici delle aree in un unico archivio. Emesso ≠ trasmesso ≠ pagato: ogni stato resta separato.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={carica}><RefreshCw size={15} /></Button>
          <Button variant="primary" onClick={() => setShowNuova(v => !v)} icon={<Plus size={16} />}>Fattura ricevuta</Button>
        </div>
      </div>

      {/* Conteggi direzione */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', margin: '16px 0' }}>
        {conteggiCard.map(c => (
          <div key={c.label} style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', border: '1px solid #e2e8f0', borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.color, marginTop: '4px' }}>{c.valore}</div>
          </div>
        ))}
      </div>

      {/* Nuova fattura ricevuta */}
      {showNuova && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #bfdbfe', borderLeft: '4px solid #1e4d8c', padding: '18px', marginBottom: '18px' }}>
          <h3 style={{ margin: '0 0 12px', color: '#1e4d8c', fontSize: '1rem' }}>📥 Registra fattura ricevuta (fornitore / professionista)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
            <div><span style={lbl}>Fornitore *</span><input style={input} value={nuova.fornitore} onChange={e => setNuova({ ...nuova, fornitore: e.target.value })} placeholder="Ragione sociale" /></div>
            <div><span style={lbl}>Numero doc. *</span><input style={input} value={nuova.numero} onChange={e => setNuova({ ...nuova, numero: e.target.value })} /></div>
            <div><span style={lbl}>Data</span><input style={input} type="date" value={nuova.data} onChange={e => setNuova({ ...nuova, data: e.target.value })} /></div>
            <div><span style={lbl}>Imponibile €</span><input style={input} type="number" step="0.01" value={nuova.imponibile} onChange={e => setNuova({ ...nuova, imponibile: e.target.value })} /></div>
            <div><span style={lbl}>IVA €</span><input style={input} type="number" step="0.01" value={nuova.iva} onChange={e => setNuova({ ...nuova, iva: e.target.value })} /></div>
            <div><span style={lbl}>Totale € *</span><input style={input} type="number" step="0.01" value={nuova.totale} onChange={e => setNuova({ ...nuova, totale: e.target.value })} /></div>
            <div><span style={lbl}>Scadenza pagamento</span><input style={input} type="date" value={nuova.scadenzaPagamento} onChange={e => setNuova({ ...nuova, scadenzaPagamento: e.target.value })} /></div>
            <div><span style={lbl}>Area</span>
              <select style={input} value={nuova.area} onChange={e => setNuova({ ...nuova, area: e.target.value })}>
                <option value="trasversale">Trasversale</option>
                <option value="privato">Gestione privata</option>
                <option value="intermediazione">Intermediazioni</option>
                <option value="convenzione">Convenzione SIAT</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div><span style={lbl}>Descrizione</span><input style={input} value={nuova.descrizione} onChange={e => setNuova({ ...nuova, descrizione: e.target.value })} placeholder="Es. materiali sanitari ottobre" /></div>
            <div><span style={lbl}>Pratica collegata (opz.)</span><input style={input} value={nuova.praticaLabel} onChange={e => setNuova({ ...nuova, praticaLabel: e.target.value })} placeholder="Es. PAI Rossi, fornitura ufficio" /></div>
            <div>
              <span style={lbl}>Allegato PDF (max 7 MB)</span>
              <input type="file" accept="application/pdf,image/*" onChange={e => e.target.files?.[0] && leggiFile(e.target.files[0])} style={{ fontSize: '0.82rem' }} />
              {allegato && <span style={{ fontSize: '0.78rem', color: '#166534' }}>📎 {allegato.fileName}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="primary" onClick={() => salvaFatturaRicevuta()} disabled={saving}>{saving ? 'Salvataggio…' : 'Registra fattura'}</Button>
            <Button variant="secondary" onClick={() => setShowNuova(false)}>Annulla</Button>
          </div>
        </div>
      )}

      {/* Filtri */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px 14px', marginBottom: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ ...input, width: 'auto' }} value={filtri.area} onChange={e => setFiltri({ ...filtri, area: e.target.value })}>
          <option value="tutte">Tutte le aree</option>
          <option value="privato">Gestione privata</option>
          <option value="intermediazione">Intermediazioni</option>
          <option value="convenzione">Convenzione SIAT</option>
          <option value="trasversale">Trasversale</option>
        </select>
        <select style={{ ...input, width: 'auto' }} value={filtri.origine} onChange={e => setFiltri({ ...filtri, origine: e.target.value })}>
          <option value="">Tutti i documenti</option>
          <option value="fattura">Fatture emesse</option>
          <option value="preventivo">Preventivi</option>
          <option value="nota_credito">Note di credito</option>
          <option value="fattura_ricevuta">Fatture ricevute</option>
          <option value="invio">Invii senza paziente</option>
          <option value="ritenuta">Ritenute</option>
        </select>
        <select style={{ ...input, width: 'auto' }} value={filtri.statoPagamento} onChange={e => setFiltri({ ...filtri, statoPagamento: e.target.value })}>
          <option value="">Stato incasso — tutti</option>
          <option value="da_incassare">Da incassare</option>
          <option value="parziale">Acconto</option>
          <option value="saldato">Saldato</option>
          <option value="da_pagare">Da pagare</option>
          <option value="pagata">Pagata</option>
        </select>
        <input style={{ ...input, width: '140px' }} type="date" value={filtri.dal} onChange={e => setFiltri({ ...filtri, dal: e.target.value })} title="Dal" />
        <input style={{ ...input, width: '140px' }} type="date" value={filtri.al} onChange={e => setFiltri({ ...filtri, al: e.target.value })} title="Al" />
        <input style={{ ...input, flex: '1 1 180px' }} value={filtri.q} onChange={e => setFiltri({ ...filtri, q: e.target.value })} placeholder="Cerca soggetto o numero…" />
      </div>

      {/* Archivio unico */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>Caricamento archivio…</p>
      ) : righe.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Nessun documento trovato con questi filtri.</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.78rem', color: '#64748b' }}>Documento</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.78rem', color: '#64748b' }}>Area</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.78rem', color: '#64748b' }}>Soggetto</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.78rem', color: '#64748b' }}>Data</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '0.78rem', color: '#64748b' }}>Totale</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '0.78rem', color: '#64748b' }}>Stato doc.</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '0.78rem', color: '#64748b' }}>Incasso/Pagamento</th>
                <th style={{ padding: '10px 12px' }} />
              </tr>
            </thead>
            <tbody>
              {righe.map(r => {
                const stPag = r.statoPagamento ? STATO_PAG_LABEL[r.statoPagamento] : undefined;
                const residuo = r.origine === 'fattura' || r.origine === 'nota_credito' ? (r.totale || 0) - (r.incassato || 0)
                  : r.origine === 'fattura_ricevuta' ? (r.totale || 0) - (r.pagato || 0) : 0;
                return (
                  <tr key={`${r.origine}-${r.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700 }}>{ORIGINE_LABEL[r.origine] || r.origine}</div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{r.numero}{r.nota ? ` · ${r.nota}` : ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#475569' }}>{AREA_LABEL[r.area] || r.area}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.soggetto}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{data(r.data)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                      {r.totale !== undefined ? euro(r.totale) : '—'}
                      {residuo > 0 && stPag && <div style={{ fontSize: '0.72rem', color: '#b91c1c' }}>residuo {euro(residuo)}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {r.statoDoc && <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: '10px', padding: '2px 9px', fontSize: '0.74rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.statoDoc}{r.dataTrasmissione ? ' · trasm.' : ''}</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {stPag ? (
                        <span style={{ background: scaduta(r) ? '#fee2e2' : stPag.bg, color: scaduta(r) ? '#b91c1c' : stPag.color, borderRadius: '10px', padding: '2px 9px', fontSize: '0.74rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {stPag.testo}{scaduta(r) ? ' ⚠' : ''}
                        </span>
                      ) : '—'}
                      {r.scadenzaPagamento && <div style={{ fontSize: '0.7rem', color: scaduta(r) ? '#b91c1c' : '#94a3b8', marginTop: '2px' }}>scad. {data(r.scadenzaPagamento)}</div>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {r.origine === 'fattura' && r.statoPagamento !== 'saldato' && (
                          <button onClick={() => registraIncasso(r)} title="Registra incasso / acconto" style={{ ...btnPiccolo, background: '#dcfce7', color: '#166534' }}><Euro size={12} style={{ verticalAlign: '-2px' }} /> Incasso</button>
                        )}
                        {r.origine === 'fattura' && (
                          <button onClick={() => impostaScadenza(r)} title="Scadenza incasso" style={{ ...btnPiccolo, background: '#fef3c7', color: '#92400e' }}>📅</button>
                        )}
                        {(r.origine === 'fattura' || r.origine === 'nota_credito') && !r.dataTrasmissione && (
                          <button onClick={() => segnaTrasmesso(r)} title="Segna data trasmissione" style={{ ...btnPiccolo, background: '#e0e7ff', color: '#3730a3' }}><Send size={12} style={{ verticalAlign: '-2px' }} /></button>
                        )}
                        {r.origine === 'fattura' && (
                          <button onClick={() => apriAttivita(r)} title="Apri lavorazione back office su questo documento" style={{ ...btnPiccolo, background: '#f1f5f9', color: '#334155' }}>☑ attività</button>
                        )}
                        {r.origine === 'fattura_ricevuta' && r.statoPagamento !== 'pagata' && (
                          <button onClick={() => registraPagamento(r)} title="Registra pagamento" style={{ ...btnPiccolo, background: '#dcfce7', color: '#166534' }}><Euro size={12} style={{ verticalAlign: '-2px' }} /> Paga</button>
                        )}
                        {r.hasAllegato && (
                          <button onClick={() => apriAllegato(r)} title="Apri allegato" style={{ ...btnPiccolo, background: '#eff6ff', color: '#2563eb' }}><Paperclip size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Lavorazioni back office ── */}
      {lavorazioni.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px 18px', marginTop: '18px', border: '1px solid #bae6fd', borderLeft: '4px solid #0284c7' }}>
          <h3 style={{ margin: '0 0 10px', color: '#0369a1', fontSize: '1rem' }}>
            ☑ Lavorazioni back office aperte ({lavorazioni.length})
          </h3>
          {lavorazioni.slice(0, 8).map(a => {
            const scad = a.scadenza && new Date(a.scadenza) < new Date();
            return (
              <div key={a._id} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', padding: '7px 0', borderTop: '1px solid #f1f5f9', fontSize: '0.84rem' }}>
                <strong>{a.titolo}</strong>
                {a.praticaLabel && <span style={{ color: '#64748b' }}>· {a.praticaLabel}</span>}
                <span style={{ color: '#64748b' }}>👤 {a.responsabileNome || 'da assegnare'}</span>
                {a.scadenza && <span style={{ color: scad ? '#b91c1c' : '#64748b', fontWeight: scad ? 700 : 400 }}>⏰ {data(a.scadenza)}{scad ? ' — scaduta' : ''}</span>}
                <span style={{ marginLeft: 'auto', borderRadius: '10px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, background: '#f1f5f9', color: '#475569' }}>{a.stato}</span>
                <Link to="/oggi" style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 700 }}>apri →</Link>
              </div>
            );
          })}
          {lavorazioni.length > 8 && <Link to="/oggi" style={{ fontSize: '0.8rem', color: '#0284c7', fontWeight: 700 }}>Vedi tutte in "Oggi" →</Link>}
        </div>
      )}

      {/* ── Prepara documenti per il commercialista ── */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '18px', marginTop: '18px', border: '1px solid #e9d5ff', borderLeft: '4px solid #7c3aed' }}>
        <div onClick={() => { setShowComm(!showComm); if (!showComm && !anteprima) caricaAnteprima(); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <h3 style={{ margin: 0, color: '#6d28d9', fontSize: '1rem' }}>
            🧾 Prepara documenti per il commercialista
          </h3>
          <span style={{ color: '#94a3b8' }}>{showComm ? '▲' : '▼'}</span>
        </div>
        {showComm && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '14px' }}>
              <div><span style={lbl}>Dal</span><input style={{ ...input, width: '150px' }} type="date" value={commDal} onChange={e => { setCommDal(e.target.value); setAnteprima(null); }} /></div>
              <div><span style={lbl}>Al</span><input style={{ ...input, width: '150px' }} type="date" value={commAl} onChange={e => { setCommAl(e.target.value); setAnteprima(null); }} /></div>
              <Button variant="secondary" onClick={caricaAnteprima}>Aggiorna riepilogo</Button>
              {anteprima && <Button variant="primary" onClick={registraPreparazione} icon={<FileDown size={15} />}>Registra preparazione</Button>}
            </div>

            {anteprima && (
              <>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {Object.entries(anteprima.perOrigine).map(([o, n]) => (
                    <span key={o} style={{ background: '#f5f3ff', color: '#6d28d9', borderRadius: '12px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
                      {ORIGINE_LABEL[o] || o}: {n}
                    </span>
                  ))}
                  <span style={{ background: '#ede9fe', color: '#5b21b6', borderRadius: '12px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 800 }}>
                    Totale: {anteprima.totaleDocumenti}
                  </span>
                </div>
                {anteprima.anomalie.length > 0 ? (
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '0.82rem', color: '#9a3412' }}>
                    <strong>⚠ {anteprima.anomalie.length} anomalie da verificare prima della consegna:</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px', maxHeight: '160px', overflowY: 'auto' }}>
                      {anteprima.anomalie.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '0.82rem', color: '#166534' }}>
                    ✓ Nessuna anomalia rilevata nel periodo (buchi numerazione, CF mancanti, duplicati, importi a zero).
                  </div>
                )}
                {anteprima.ultimaConsegna && (
                  <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Ultima preparazione: {data(anteprima.ultimaConsegna.preparataIl)} — stato {anteprima.ultimaConsegna.stato}
                  </p>
                )}
              </>
            )}

            {/* Registro consegne */}
            {consegne.length > 0 && (
              <>
                <h4 style={{ margin: '14px 0 8px', fontSize: '0.9rem', color: '#475569' }}>Registro preparazioni</h4>
                {consegne.map(c => (
                  <div key={c._id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', fontSize: '0.84rem' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <strong>{data(c.periodoDal)} → {data(c.periodoAl)}</strong>
                      <span style={{ color: '#64748b' }}>{c.tipologie?.length ? c.tipologie.length : 0} tipologie · preparata il {data(c.preparataIl)}{c.preparataDa ? ` da ${c.preparataDa}` : ''}</span>
                      <span style={{ borderRadius: '10px', padding: '2px 10px', fontSize: '0.74rem', fontWeight: 700, background: c.stato === 'verificata' ? '#dcfce7' : c.stato === 'consegnata' ? '#dbeafe' : '#fef3c7', color: c.stato === 'verificata' ? '#166534' : c.stato === 'consegnata' ? '#1e40af' : '#92400e' }}>
                        {c.stato}{c.consegnataIl ? ` il ${data(c.consegnataIl)}` : ''}{c.modalitaConsegna ? ` · ${c.modalitaConsegna}` : ''}
                      </span>
                      {c.anomalie?.length > 0 && <span style={{ fontSize: '0.74rem', color: '#b45309' }}>⚠ {c.anomalie.length} anomalie</span>}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                        <button onClick={() => scaricaCsv(c)} style={{ ...btnPiccolo, background: '#f5f3ff', color: '#6d28d9' }}>CSV</button>
                        <button onClick={() => vediDifferenze(c)} style={{ ...btnPiccolo, background: '#f1f5f9', color: '#334155' }}>differenze</button>
                        {c.stato === 'preparata' && (
                          <button onClick={() => marcaConsegnata(c)} style={{ ...btnPiccolo, background: '#dbeafe', color: '#1e40af' }}>Marca consegnata</button>
                        )}
                      </div>
                    </div>
                    {diff && diff.consegnaId === c._id && (
                      <div style={{ marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                        {diff.nuovi.length === 0 && diff.modificati.length === 0 ? (
                          <span style={{ color: '#166534' }}>✓ Nessun documento aggiunto o modificato dopo questa preparazione.</span>
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
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '10px' }}>
              L'esportazione non è un invio: la consegna va marcata esplicitamente. I formati definitivi (XML, rendiconti) vanno concordati con il commercialista.
            </p>
          </div>
        )}
      </div>

      {/* Collegamenti alle gestioni di dettaglio esistenti */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px', fontSize: '0.85rem' }}>
        <Link to="/gestione-fatturazione" style={{ color: '#1e4d8c', fontWeight: 600 }}>→ Gestione fatturazione</Link>
        <Link to="/archivio-preventivi" style={{ color: '#1e4d8c', fontWeight: 600 }}>→ Archivio preventivi</Link>
        <Link to="/gestione-ritenute" style={{ color: '#1e4d8c', fontWeight: 600 }}>→ Ritenute e compensi</Link>
        <Link to="/esportazione-siat" style={{ color: '#1e4d8c', fontWeight: 600 }}>→ Rendicontazione SIAT</Link>
        <Link to="/oggi" style={{ color: '#1e4d8c', fontWeight: 600 }}>→ Lavorazioni (Oggi)</Link>
      </div>

      <div style={{ marginTop: '14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: '#92400e', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>Le numerazioni e le regole contabili (note di credito, acconti, registri IVA) vanno verificate con il commercialista prima dell'uso fiscale. I documenti esistenti restano nelle gestioni dedicate; questo archivio li aggrega in sola lettura per la direzione.</span>
      </div>
    </section>
  );
}

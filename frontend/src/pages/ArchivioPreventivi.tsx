import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
import api from '../api/api';
import { ClipboardList, ChevronUp, ChevronDown, Eye, Download, Trash2, FileText, Mail, Globe, Send } from 'lucide-react';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
}

interface DocumentoFatturazione {
  _id: string;
  numero: string;
  tipo: 'preventivo' | 'fattura';
  riferimentoTipo?: string; // 'landing' = generato dal calcolatore pubblico
  patient: Patient;
  prestazioni: { descrizione: string; quantita: number; prezzoUnitario: number; importo: number }[];
  totale: number;
  data: string;
  dataPrestazione?: string;
  stato: 'emesso' | 'firmato' | 'annullato' | 'rifiutato';
  motivazioneRifiuto?: string;
  rifiutatoIl?: string;
  note?: string;
  documentoOrigineId?: string;
  firma?: {
    firmato: boolean;
    firmatoIl?: string;
    inviatoIl?: string;
    nome?: string;
    email?: string;
    token?: string;
    rifiutoRegistro?: boolean;
  };
}

function formatData(d?: string) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function formatEuro(n: number) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}

function badgeStato(doc: DocumentoFatturazione) {
  if (doc.stato === 'firmato' || doc.firma?.firmato) {
    return { testo: '✍️ Firmato', bg: '#dcfce7', color: '#166534' };
  }
  if (doc.stato === 'rifiutato') {
    return { testo: '🚫 Rifiutato', bg: '#fee2e2', color: '#b91c1c' };
  }
  return { testo: '✅ Emesso', bg: '#fef3c7', color: '#92400e' };
}

interface PreventivoInviato {
  _id: string;
  tipo: 'preventivo_veloce' | 'costo_badante';
  canale: 'whatsapp' | 'email';
  nomeCliente?: string;
  email?: string;
  telefono?: string;
  prestazioni: { descrizione: string; quantita: number; prezzoUnitario: number; importo: number }[];
  totale?: number;
  inviatoDa?: string;
  stato?: 'inviato' | 'accettato' | 'rifiutato' | 'sostituito';
  esitoNote?: string;
  ricontattoIl?: string;
  versione?: number;
  createdAt: string;
}

const STATO_INVIO: Record<string, { testo: string; bg: string; color: string }> = {
  inviato: { testo: '📤 Inviato', bg: '#dbeafe', color: '#1e40af' },
  accettato: { testo: '✅ Accettato', bg: '#dcfce7', color: '#166534' },
  rifiutato: { testo: '🚫 Rifiutato', bg: '#fee2e2', color: '#b91c1c' },
  sostituito: { testo: '↺ Sostituito', bg: '#f1f5f9', color: '#64748b' },
};

export default function ArchivioPreventivi() {
  const { user } = useAuth();
  const { isConvenzione, isConsulenza } = useModalita();
  const [documenti, setDocumenti] = useState<DocumentoFatturazione[]>([]);
  const [inviati, setInviati] = useState<PreventivoInviato[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchivio, setShowArchivio] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [showInviati, setShowInviati] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [ricerca, setRicerca] = useState(searchParams.get('q') || '');
  // ?paziente=<id> — arriva dal dossier/storico: mostra SOLO i documenti di quel paziente
  const pazienteFiltro = searchParams.get('paziente') || '';

  const filtraRicerca = (d: DocumentoFatturazione) => {
    if (pazienteFiltro && String(d.patient?._id || '') !== pazienteFiltro) return false;
    if (!ricerca.trim()) return true;
    const q = ricerca.trim().toLowerCase();
    const nomeCompleto = `${d.patient?.firstName || ''} ${d.patient?.lastName || ''}`.toLowerCase();
    return nomeCompleto.includes(q) || d.numero.toLowerCase().includes(q);
  };

  // Archivio preventivi: tutti i preventivi (emessi, firmati, rifiutati) tranne gli annullati
  // e tranne quelli nati dal calcolatore pubblico, che hanno una sezione dedicata.
  const archivioPreventivi = useMemo(() => {
    return documenti
      .filter(d => d.tipo === 'preventivo' && d.stato !== 'annullato' && d.riferimentoTipo !== 'landing')
      .filter(filtraRicerca);
  }, [documenti, ricerca]);

  // Preventivi generati dal calcolatore online (/preventivo): lead da ricontattare
  const preventiviOnline = useMemo(() => {
    return documenti
      .filter(d => d.tipo === 'preventivo' && d.stato !== 'annullato' && d.riferimentoTipo === 'landing')
      .filter(filtraRicerca);
  }, [documenti, ricerca]);

  // Invii WhatsApp/email filtrati dalla stessa ricerca (nome cliente, contatto, telefono)
  const inviatiVisibili = useMemo(() => {
    if (!ricerca.trim()) return inviati;
    const q = ricerca.trim().toLowerCase();
    return inviati.filter(i =>
      (i.nomeCliente || '').toLowerCase().includes(q) ||
      (i.email || '').toLowerCase().includes(q) ||
      (i.telefono || '').includes(q));
  }, [inviati, ricerca]);

  const caricaDocumenti = async () => {
    setLoading(true);
    try {
      const [docRes, invRes] = await Promise.all([
        api.get('/fatturazione-documenti', { params: { area: isConsulenza ? 'consulenza' : 'gestionale' } }),
        isConsulenza ? Promise.resolve({ data: [] }) : api.get('/preventivi-inviati', { params: { area: 'privato' } }),
      ]);
      setDocumenti(docRes.data);
      setInviati(invRes.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel caricamento dei documenti');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    caricaDocumenti();
  }, []);

  const isFirmato = (doc: DocumentoFatturazione) => doc.stato === 'firmato' || !!doc.firma?.firmato;

  const endpointPdf = (doc: DocumentoFatturazione) =>
    isFirmato(doc) ? `/fatturazione-documenti/${doc._id}/firmato` : `/fatturazione-documenti/${doc._id}/pdf`;

  const nomeFilePdf = (doc: DocumentoFatturazione) =>
    `PREVENTIVO-${doc.numero}${isFirmato(doc) ? '-firmato' : ''}.pdf`;

  const anteprimaDocumento = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(endpointPdf(doc), { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella generazione anteprima PDF');
    }
  };

  const scaricaDocumentoPDF = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(endpointPdf(doc), { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeFilePdf(doc);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel download PDF');
    }
  };

  const rinviaDocumento = async (doc: DocumentoFatturazione) => {
    const email = window.prompt('Email del destinatario', doc.firma?.email || (doc.patient as any)?.email || '');
    if (!email) return;
    try {
      await api.post(`/fatturazione-documenti/${doc._id}/rinvia-email`, { email });
      alert(`Preventivo ${doc.numero} rispedito a ${email}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Errore nell'invio");
    }
  };

  const eliminaDocumento = async (doc: DocumentoFatturazione) => {
    if (!confirm(`Eliminare definitivamente il preventivo ${doc.numero}?\n\nQuesta azione non può essere annullata.`)) return;
    try {
      await api.delete(`/fatturazione-documenti/${doc._id}`);
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella eliminazione');
    }
  };

  const pdfInviato = async (inv: PreventivoInviato, apri: boolean) => {
    try {
      const res = await api.get(`/preventivi-inviati/${inv._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (apri) {
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `PREVENTIVO-${(inv.nomeCliente || 'bozza').replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella rigenerazione del PDF');
    }
  };

  // Esito commerciale dell'invio: accettato/rifiutato + prossima azione datata
  const esitoInviato = async (inv: PreventivoInviato, stato: 'accettato' | 'rifiutato' | 'inviato') => {
    let esitoNote: string | undefined;
    let ricontattoIl: string | undefined;
    if (stato === 'rifiutato' || stato === 'accettato') {
      const n = window.prompt(stato === 'rifiutato' ? 'Motivo del rifiuto (opzionale):' : 'Nota di accettazione (opzionale):', '');
      if (n === null) return;
      esitoNote = n.trim() || undefined;
    }
    if (stato === 'inviato' || stato === 'accettato') {
      const d = window.prompt('Data ricontatto (YYYY-MM-DD, vuoto = nessun ricontatto):', inv.ricontattoIl ? inv.ricontattoIl.slice(0, 10) : '');
      if (d === null) return;
      ricontattoIl = d || undefined;
    }
    try {
      await api.patch(`/preventivi-inviati/${inv._id}/stato`, { stato, esitoNote, ricontattoIl });
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiornamento esito');
    }
  };

  const impostaRicontatto = async (inv: PreventivoInviato) => {
    const d = window.prompt('Data ricontatto (YYYY-MM-DD, vuoto = rimuovi):', inv.ricontattoIl ? inv.ricontattoIl.slice(0, 10) : '');
    if (d === null) return;
    try {
      await api.patch(`/preventivi-inviati/${inv._id}/stato`, { stato: inv.stato || 'inviato', ricontattoIl: d || undefined });
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiornamento ricontatto');
    }
  };

  const eliminaInviato = async (inv: PreventivoInviato) => {
    if (!confirm(`Eliminare questo invio archiviato${inv.nomeCliente ? ` (${inv.nomeCliente})` : ''}?`)) return;
    try {
      await api.delete(`/preventivi-inviati/${inv._id}`);
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella eliminazione');
    }
  };

  if (isConvenzione) {
    return (
      <section className="fade-in section-wide">
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: '#1e4d8c' }}>
          <ClipboardList size={28} />Archivio Preventivi
        </h1>
        <p style={{ color: '#6b7280', marginTop: '24px' }}>L&apos;archivio preventivi è disponibile solo nella modalità privata.</p>
      </section>
    );
  }

  return (
    <section className="fade-in section-wide">
      <h1 style={{ margin: 0, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: '#1e4d8c' }}>
        <ClipboardList size={28} />Archivio Preventivi
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><p>Caricamento...</p></div>
      ) : (
        <>
        {/* ── Preventivi dal calcolatore online (/preventivo) ── */}
        {!isConsulenza && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #bfdbfe', borderLeft: '4px solid #1e4d8c' }}>
          <div onClick={() => setShowOnline(!showOnline)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d8c' }}>
              <Globe size={20} />Preventivi dal calcolatore online
              <span style={{ background: '#dbeafe', color: '#1e3a8a', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{preventiviOnline.length}</span>
            </h3>
            {showOnline ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {showOnline && (
            <>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '10px 0 0' }}>
                Generati dal link pubblico <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>/preventivo</code>: il richiedente è stato inserito come paziente in accettazione. Ricontattalo per confermare tariffa e disponibilità.
              </p>
              {preventiviOnline.length === 0 ? (
                <p style={{ color: '#9ca3af', marginTop: '14px', marginBottom: 0 }}>Nessun preventivo dal calcolatore online.</p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '14px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Preventivo</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Richiedente</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Data</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Prestazioni</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Totale</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>Stato</th>
                        <th style={{ padding: '8px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {preventiviOnline.map(prev => {
                        const badge = badgeStato(prev);
                        return (
                          <tr key={prev._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{prev.numero}</td>
                            <td style={{ padding: '8px' }}>{prev.patient?.firstName} {prev.patient?.lastName}</td>
                            <td style={{ padding: '8px' }}>{formatData(prev.data)}</td>
                            <td style={{ padding: '8px', fontSize: '0.82rem', color: '#475569', maxWidth: '320px' }} title={prev.prestazioni.map(p => `${p.descrizione} ×${p.quantita} a €${p.prezzoUnitario}`).join('\n')}>
                              {prev.prestazioni.slice(0, 2).map(p => `${p.descrizione.replace(/ — PROMO.*$/, '')} ×${p.quantita}`).join(', ')}{prev.prestazioni.length > 2 ? ` +${prev.prestazioni.length - 2}` : ''}
                              {prev.prestazioni.some(p => / — PROMO/.test(p.descrizione)) && (
                                <span title="Prestazioni a prezzo promozionale" style={{ marginLeft: '6px', background: '#fee2e2', color: '#b91c1c', borderRadius: '10px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>🏷 promo</span>
                              )}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{formatEuro(prev.totale)}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.testo}</span>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button onClick={() => anteprimaDocumento(prev)} title="Visualizza / stampa PDF" style={{ background: '#f0f9ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#0ea5e9' }}><Eye size={14} /></button>
                                <button onClick={() => scaricaDocumentoPDF(prev)} title="Scarica PDF" style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }}><Download size={14} /></button>
                                <button onClick={() => rinviaDocumento(prev)} title="Invia per email" style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }}><Mail size={14} /></button>
                                {user?.role === 'admin' && (
                                  <button onClick={() => eliminaDocumento(prev)} title="Elimina definitivamente" style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#b91c1c' }}><Trash2 size={14} /></button>
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
            </>
          )}
        </div>
        )}

        {/* ── Preventivi veloci inviati via WhatsApp/email senza paziente ── */}
        {!isConsulenza && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #fde68a', borderLeft: '4px solid #d97706' }}>
          <div onClick={() => setShowInviati(!showInviati)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e' }}>
              <Send size={20} />Preventivi veloci inviati (senza paziente)
              <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{inviatiVisibili.length}</span>
            </h3>
            {showInviati ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {showInviati && (
            <>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '10px 0 0' }}>
                Inviati da <strong>Preventivo veloce</strong> via WhatsApp o email senza creare il paziente: se il cliente accetta, qui ritrovi cosa gli è stato mandato.
              </p>
              {inviatiVisibili.length === 0 ? (
                <p style={{ color: '#9ca3af', marginTop: '14px', marginBottom: 0 }}>Nessun preventivo inviato senza paziente.</p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '14px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Data</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Cliente</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Contatto</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>Canale</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>Esito</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Prestazioni</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Totale</th>
                        <th style={{ padding: '8px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {inviatiVisibili.map(inv => {
                        const badgeInvio = STATO_INVIO[inv.stato || 'inviato'] || STATO_INVIO.inviato;
                        const ricontattoScaduto = inv.ricontattoIl && new Date(inv.ricontattoIl) <= new Date() && (!inv.stato || inv.stato === 'inviato');
                        return (
                        <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9', opacity: inv.stato === 'sostituito' ? 0.55 : 1 }}>
                          <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                            {formatData(inv.createdAt)}
                            {(inv.versione || 1) > 1 && <span title={`Versione ${inv.versione}`} style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#e0e7ff', color: '#4338ca', borderRadius: '8px', padding: '1px 6px', fontWeight: 700 }}>v{inv.versione}</span>}
                            {inv.ricontattoIl && (
                              <div style={{ fontSize: '0.72rem', color: ricontattoScaduto ? '#dc2626' : '#64748b', fontWeight: ricontattoScaduto ? 700 : 400 }}>
                                📅 ricontatto {formatData(inv.ricontattoIl)}{ricontattoScaduto ? ' — SCADUTO' : ''}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px', fontWeight: 600 }}>{inv.nomeCliente || '—'}</td>
                          <td style={{ padding: '8px', fontSize: '0.82rem', color: '#475569' }}>
                            {inv.email && <div>✉️ {inv.email}</div>}
                            {inv.telefono && <div>📞 {inv.telefono}</div>}
                            {!inv.email && !inv.telefono && '—'}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', background: inv.canale === 'whatsapp' ? '#dcfce7' : '#dbeafe', color: inv.canale === 'whatsapp' ? '#166534' : '#1e40af' }}>
                              {inv.canale === 'whatsapp' ? '💬 WhatsApp' : '✉️ Email'}
                            </span>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span
                              title={inv.esitoNote || undefined}
                              style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', background: badgeInvio.bg, color: badgeInvio.color }}
                            >
                              {badgeInvio.testo}
                            </span>
                          </td>
                          <td style={{ padding: '8px', fontSize: '0.82rem', color: '#475569', maxWidth: '300px' }} title={(inv.prestazioni || []).map(p => `${p.descrizione} ×${p.quantita} a €${p.prezzoUnitario}`).join('\n')}>
                            {(inv.prestazioni || []).slice(0, 2).map(p => `${p.descrizione} ×${p.quantita}`).join(', ')}{(inv.prestazioni || []).length > 2 ? ` +${inv.prestazioni.length - 2}` : ''}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{inv.totale !== undefined ? formatEuro(inv.totale) : '—'}</td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {(!inv.stato || inv.stato === 'inviato') && (
                                <>
                                  <button onClick={() => esitoInviato(inv, 'accettato')} title="Segna come accettato" style={{ background: '#dcfce7', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>✅</button>
                                  <button onClick={() => esitoInviato(inv, 'rifiutato')} title="Segna come rifiutato" style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c' }}>🚫</button>
                                  <button onClick={() => impostaRicontatto(inv)} title="Imposta data ricontatto" style={{ background: '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#92400e' }}>📅</button>
                                </>
                              )}
                              <button onClick={() => pdfInviato(inv, true)} title="Visualizza PDF inviato" style={{ background: '#f0f9ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#0ea5e9' }}><Eye size={14} /></button>
                              <button onClick={() => pdfInviato(inv, false)} title="Scarica PDF" style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }}><Download size={14} /></button>
                              {user?.role === 'admin' && (
                                <button onClick={() => eliminaInviato(inv)} title="Elimina" style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#b91c1c' }}><Trash2 size={14} /></button>
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
            </>
          )}
        </div>
        )}

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div onClick={() => setShowArchivio(!showArchivio)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
              <FileText size={20} />Preventivi emessi e firmati
              <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{archivioPreventivi.length}</span>
            </h3>
            {showArchivio ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {showArchivio && (
            <>
              {pazienteFiltro && (
                <div style={{ marginTop: '12px', background: '#eff6ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px 12px', fontSize: '0.83rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔎 Stai vedendo solo i documenti di questo paziente.
                  <button type="button" onClick={() => { setSearchParams({}); setRicerca(''); }} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem' }}>Mostra tutti</button>
                </div>
              )}
              <div style={{ marginTop: '14px', marginBottom: '4px' }}>
                <input
                  type="text"
                  value={ricerca}
                  onChange={e => setRicerca(e.target.value)}
                  placeholder="Cerca per paziente o numero preventivo..."
                  style={{ width: '100%', maxWidth: '380px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                />
              </div>
              {archivioPreventivi.length === 0 ? (
                <p style={{ color: '#9ca3af', marginTop: '14px', marginBottom: 0 }}>Nessun preventivo in archivio.</p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '14px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Preventivo</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Paziente</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Data doc.</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Firmato/Rifiutato il</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Totale</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>Stato</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Fattura collegata</th>
                        <th style={{ padding: '8px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {archivioPreventivi.map(prev => {
                        const fattura = documenti.find(d => d.tipo === 'fattura' && d.documentoOrigineId === prev._id);
                        const badge = badgeStato(prev);
                        const rigaOpacity = prev.stato === 'rifiutato' ? 0.65 : 1;
                        return (
                          <tr key={prev._id} style={{ borderBottom: '1px solid #f1f5f9', opacity: rigaOpacity }}>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{prev.numero}</td>
                            <td style={{ padding: '8px' }}>{prev.patient?.firstName} {prev.patient?.lastName}</td>
                            <td style={{ padding: '8px' }}>{formatData(prev.data)}</td>
                            <td style={{ padding: '8px' }}>
                              {prev.firma?.firmato && prev.firma.firmatoIl
                                ? formatData(prev.firma.firmatoIl)
                                : prev.stato === 'rifiutato'
                                  ? formatData(prev.rifiutatoIl)
                                  : '-'}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{formatEuro(prev.totale)}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span
                                title={prev.stato === 'rifiutato' ? (prev.motivazioneRifiuto || 'Motivazione non indicata') : undefined}
                                style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}
                              >
                                {badge.testo}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>{fattura ? fattura.numero : '-'}</td>
                            <td style={{ padding: '8px' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => anteprimaDocumento(prev)}
                                  title={prev.firma?.firmato ? 'Anteprima preventivo firmato' : 'Anteprima preventivo'}
                                  style={{ background: '#f0f9ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#0ea5e9' }}
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => scaricaDocumentoPDF(prev)}
                                  title={prev.firma?.firmato ? 'Scarica preventivo firmato' : 'Scarica preventivo'}
                                  style={{ background: prev.firma?.firmato ? '#dcfce7' : '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: prev.firma?.firmato ? '#166534' : '#2563eb' }}
                                >
                                  <Download size={14} />
                                </button>
                                <button
                                  onClick={() => rinviaDocumento(prev)}
                                  title="Rinvia per email"
                                  style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }}
                                >
                                  <Mail size={14} />
                                </button>
                                {user?.role === 'admin' && (
                                  <button
                                    onClick={() => eliminaDocumento(prev)}
                                    title="Elimina definitivamente"
                                    style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#b91c1c' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
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
            </>
          )}
        </div>
        </>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  Archive,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  Printer,
  Activity,
  Clock,
  Lock,
  Paperclip,
  FileText,
  Image,
  File,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface ArchivioSummary {
  _id: string;
  paziente: { firstName: string; lastName: string; codiceFiscale?: string; address?: string };
  workPlan: {
    type: string;
    category: string;
    task: string;
    date: string;
    dataFine?: string;
    status: string;
    notes?: string;
  };
  operatore: { firstName: string; lastName: string; role: string };
  dataArchiviazione: string;
  archiviatoDa: string;
  note?: string;
}

interface ArchivioDettaglio extends ArchivioSummary {
  accessi: Array<{
    staffName: string;
    staffRole: string;
    oraEntrata: string;
    oraUscita?: string;
    durataMinuti?: number;
    note?: string;
    firmaLogin: string;
  }>;
  diario: Array<{
    dataRegistrazione: string;
    staffName: string;
    firmaLogin: string;
    testo: string;
    firmato: boolean;
    dataFirma?: string;
    parametriVitali?: {
      pressioneSistolica?: number;
      pressioneDiastolica?: number;
      frequenzaCardiaca?: number;
      frequenzaRespiratoria?: number;
      temperatura?: number;
      saturazione?: number;
      glicemia?: number;
      peso?: number;
      dolore?: number;
    };
  }>;
  allegati: Array<{
    nomeFile: string;
    mimeType: string;
    dimensione: number;
    descrizione?: string;
    caricatoDa: string;
    dataCaricamento: string;
    urlCloudinary?: string;
  }>;
}

export default function ArchivioCartelle() {
  const { user } = useAuth();
  const [archivi, setArchivi] = useState<ArchivioSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dettaglio, setDettaglio] = useState<ArchivioDettaglio | null>(null);
  const [loadingDettaglio, setLoadingDettaglio] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const canDelete = user?.role === 'admin' || user?.role === 'direttore';

  useEffect(() => {
    caricaArchivio();
  }, []);

  const caricaArchivio = async (paziente = '') => {
    setLoading(true);
    try {
      const params = paziente ? `?paziente=${encodeURIComponent(paziente)}` : '';
      const res = await api.get(`/archivio${params}`);
      setArchivi(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nel caricamento dell\'archivio');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    caricaArchivio(searchTerm);
  };

  const toggleDettaglio = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      setDettaglio(null);
      return;
    }
    setExpanded(id);
    setLoadingDettaglio(true);
    try {
      const res = await api.get(`/archivio/${id}`);
      setDettaglio(res.data);
    } catch (err) {
      console.error('Errore caricamento dettaglio', err);
    } finally {
      setLoadingDettaglio(false);
    }
  };

  const eliminaArchivio = async (id: string, nomePaziente: string) => {
    if (!confirm(`⚠️ ATTENZIONE: Stai per eliminare definitivamente la cartella archiviata di ${nomePaziente}.\n\nQuesta operazione è IRREVERSIBILE. Continuare?`)) return;
    try {
      await api.delete(`/archivio/${id}`);
      setArchivi(prev => prev.filter(a => a._id !== id));
      if (expanded === id) { setExpanded(null); setDettaglio(null); }
      setSuccess('Cartella eliminata dall\'archivio.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nell\'eliminazione');
      setTimeout(() => setError(''), 4000);
    }
  };

  const formatData = (d: string) => new Date(d).toLocaleDateString('it-IT');
  const formatDataOra = (d: string) => new Date(d).toLocaleString('it-IT');
  const formatOra = (d: string) => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const formatDimensione = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return <Image size={14} color="#0284c7" />;
    if (mimeType === 'application/pdf') return <FileText size={14} color="#dc2626" />;
    return <File size={14} color="#6b7280" />;
  };

  const calcolaDurata = (entrata: string, uscita?: string) => {
    if (!uscita) return '—';
    const minuti = Math.round((new Date(uscita).getTime() - new Date(entrata).getTime()) / 60000);
    const ore = Math.floor(minuti / 60);
    const min = minuti % 60;
    return ore > 0 ? `${ore}h ${min}min` : `${min}min`;
  };

  const stampaCartella = (archivio: ArchivioDettaglio) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Archivio Cartella — ${archivio.paziente.firstName} ${archivio.paziente.lastName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 20px; }
    .logo-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; border-bottom: 2px solid #7c3aed; padding-bottom: 12px; }
    .logo-header img { height: 60px; width: auto; }
    .logo-header .title-block h1 { margin: 0; font-size: 18px; color: #7c3aed; }
    .logo-header .title-block p { margin: 2px 0 0; font-size: 11px; color: #666; }
    h2 { font-size: 14px; color: #444; margin-top: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .header-info { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .info-block { background: #f5f3ff; padding: 8px 12px; border-radius: 4px; border: 1px solid #ddd6fe; font-size: 11px; }
    .entry { border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; }
    .entry.firmato { border-color: #86efac; background: #f0fdf4; }
    .entry-header { font-size: 11px; color: #666; margin-bottom: 6px; }
    .firma-badge { display: inline-block; background: #dcfce7; color: #16a34a; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; }
    .testo { white-space: pre-wrap; line-height: 1.5; }
    .parametri { background: #f0f9ff; padding: 6px 10px; border-radius: 4px; margin-top: 6px; font-size: 11px; }
    .param-badge { display: inline-block; background: white; border: 1px solid #bae6fd; padding: 1px 6px; border-radius: 3px; margin: 2px; }
    .accesso-row { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; margin-bottom: 6px; font-size: 11px; }
    .footer { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 10px; color: #888; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="logo-header">
    <img src="${window.location.origin}/logo.png" alt="Abbraccio" onerror="this.style.display='none'" />
    <div class="title-block">
      <h1>🗄️ Archivio Cartella Clinica</h1>
      <p>Abbraccio Cure Domiciliari — Documento archiviato</p>
    </div>
  </div>
  <div class="header-info">
    <div class="info-block"><strong>Paziente:</strong> ${archivio.paziente.firstName} ${archivio.paziente.lastName}${archivio.paziente.codiceFiscale ? ` — CF: ${archivio.paziente.codiceFiscale}` : ''}</div>
    <div class="info-block"><strong>Piano:</strong> ${archivio.workPlan.task} (${archivio.workPlan.type})</div>
    <div class="info-block"><strong>Periodo:</strong> ${archivio.workPlan.date ? formatData(archivio.workPlan.date) : '—'}${archivio.workPlan.dataFine ? ` → ${formatData(archivio.workPlan.dataFine)}` : ''}</div>
    <div class="info-block"><strong>Operatore:</strong> ${archivio.operatore.firstName} ${archivio.operatore.lastName} (${archivio.operatore.role})</div>
    <div class="info-block"><strong>Archiviato il:</strong> ${formatData(archivio.dataArchiviazione)} da ${archivio.archiviatoDa}</div>
  </div>

  <h2>📋 Accessi Registrati (${archivio.accessi.length})</h2>
  ${archivio.accessi.length === 0 ? '<p style="color:#888;font-style:italic;">Nessun accesso registrato.</p>' : archivio.accessi.map(a => `
  <div class="accesso-row">
    <strong>${a.staffName}</strong> (${a.staffRole}) — 
    🟢 ${formatOra(a.oraEntrata)} ${a.oraUscita ? `→ 🔴 ${formatOra(a.oraUscita)} — ⏱️ ${calcolaDurata(a.oraEntrata, a.oraUscita)}` : '(aperto)'}
    — 📅 ${formatData(a.oraEntrata)}
    ${a.note ? `<br/><em>📝 ${a.note}</em>` : ''}
  </div>`).join('')}

  <h2>📓 Diario Clinico (${archivio.diario.length} voci)</h2>
  ${archivio.diario.length === 0 ? '<p style="color:#888;font-style:italic;">Nessuna voce nel diario.</p>' : archivio.diario.map(e => `
  <div class="entry ${e.firmato ? 'firmato' : ''}">
    <div class="entry-header">
      📅 ${formatDataOra(e.dataRegistrazione)} — ✍️ ${e.firmaLogin}
      ${e.firmato ? `<span class="firma-badge">🔒 Firmato ${e.dataFirma ? formatData(e.dataFirma) : ''}</span>` : ''}
    </div>
    <div class="testo">${e.testo}</div>
    ${e.parametriVitali && Object.values(e.parametriVitali).some(v => v !== undefined) ? `
    <div class="parametri">
      <strong>Parametri vitali:</strong>
      ${e.parametriVitali.pressioneSistolica && e.parametriVitali.pressioneDiastolica ? `<span class="param-badge">🩺 ${e.parametriVitali.pressioneSistolica}/${e.parametriVitali.pressioneDiastolica} mmHg</span>` : ''}
      ${e.parametriVitali.frequenzaCardiaca ? `<span class="param-badge">❤️ ${e.parametriVitali.frequenzaCardiaca} bpm</span>` : ''}
      ${e.parametriVitali.temperatura ? `<span class="param-badge">🌡️ ${e.parametriVitali.temperatura}°C</span>` : ''}
      ${e.parametriVitali.saturazione ? `<span class="param-badge">💨 SpO₂ ${e.parametriVitali.saturazione}%</span>` : ''}
      ${e.parametriVitali.glicemia ? `<span class="param-badge">🩸 ${e.parametriVitali.glicemia} mg/dL</span>` : ''}
      ${e.parametriVitali.peso ? `<span class="param-badge">⚖️ ${e.parametriVitali.peso} kg</span>` : ''}
      ${e.parametriVitali.dolore !== undefined ? `<span class="param-badge">😣 Dolore: ${e.parametriVitali.dolore}/10</span>` : ''}
    </div>` : ''}
  </div>`).join('')}

  ${archivio.allegati.length > 0 ? `
  <h2>📎 Allegati (${archivio.allegati.length})</h2>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <thead><tr style="background:#f5f3ff;"><th style="padding:6px;border:1px solid #ddd6fe;text-align:left;">File</th><th style="padding:6px;border:1px solid #ddd6fe;">Dimensione</th><th style="padding:6px;border:1px solid #ddd6fe;">Caricato da</th><th style="padding:6px;border:1px solid #ddd6fe;">Data</th></tr></thead>
    <tbody>${archivio.allegati.map(a => `<tr><td style="padding:5px;border:1px solid #e5e7eb;">${a.nomeFile}</td><td style="padding:5px;border:1px solid #e5e7eb;text-align:center;">${formatDimensione(a.dimensione)}</td><td style="padding:5px;border:1px solid #e5e7eb;">${a.caricatoDa}</td><td style="padding:5px;border:1px solid #e5e7eb;">${formatData(a.dataCaricamento)}</td></tr>`).join('')}</tbody>
  </table>` : ''}

  <div class="footer">
    Documento archiviato il ${formatDataOra(archivio.dataArchiviazione)} da ${archivio.archiviatoDa} — App Abbraccio Cure Domiciliari
  </div>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  return (
    <section>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Archive size={28} color="#7c3aed" />
        Archivio Cartelle Cliniche
      </h2>

      <div style={{ padding: '12px 16px', backgroundColor: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe', marginBottom: '20px', fontSize: '0.88rem', color: '#5b21b6' }}>
        🗄️ <strong>Archivio permanente</strong> — Le cartelle archiviate sono snapshot immutabili del piano di lavoro, diario clinico, accessi e allegati al momento dell'archiviazione.
        {canDelete && <span style={{ color: '#dc2626', marginLeft: '8px' }}>Solo admin e direttore sanitario possono eliminare le cartelle dall'archivio.</span>}
      </div>

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', marginBottom: '16px' }}>
          <CheckCircle size={18} /> {success}
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', marginBottom: '16px' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Barra di ricerca */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Cerca per nome o cognome paziente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '12px 14px 12px 44px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit" style={{ padding: '12px 20px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Search size={16} /> Cerca
        </button>
        {searchTerm && (
          <button type="button" onClick={() => { setSearchTerm(''); caricaArchivio(); }} style={{ padding: '12px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Tutti
          </button>
        )}
      </form>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#666', padding: '32px' }}>⏳ Caricamento archivio...</p>
      ) : archivi.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <Archive size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p>Nessuna cartella archiviata trovata.</p>
          <p style={{ fontSize: '0.85rem' }}>Le cartelle vengono archiviate dalla sezione Piano di Lavoro quando un incarico viene completato.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {archivi.map(archivio => {
            const isOpen = expanded === archivio._id;
            return (
              <div key={archivio._id} style={{ border: '1px solid #ddd6fe', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(124,58,237,0.08)', borderLeft: '4px solid #7c3aed' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: '#faf5ff', borderBottom: isOpen ? '1px solid #ddd6fe' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1rem' }}>
                        {archivio.paziente.firstName} {archivio.paziente.lastName}
                      </strong>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', backgroundColor: '#ede9fe', color: '#7c3aed', borderRadius: '10px', fontWeight: '600' }}>
                        {archivio.workPlan.type === 'prestazionale' ? 'Prestazionale' : 'Assistenziale'}
                      </span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '10px', fontWeight: '600' }}>
                        🗄️ Archiviato
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#555' }}>
                      📋 {archivio.workPlan.task}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span>👤 {archivio.operatore.firstName} {archivio.operatore.lastName} ({archivio.operatore.role})</span>
                      {archivio.workPlan.date && <span>📅 {formatData(archivio.workPlan.date)}{archivio.workPlan.dataFine ? ` → ${formatData(archivio.workPlan.dataFine)}` : ''}</span>}
                      <span>🗄️ Archiviato il {formatData(archivio.dataArchiviazione)} da {archivio.archiviatoDa}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isOpen && dettaglio && (
                      <button
                        type="button"
                        onClick={() => stampaCartella(dettaglio)}
                        style={{ padding: '8px 12px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}
                      >
                        <Printer size={15} /> Stampa PDF
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => eliminaArchivio(archivio._id, `${archivio.paziente.firstName} ${archivio.paziente.lastName}`)}
                        style={{ padding: '8px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}
                        title="Elimina dall'archivio (solo admin/direttore)"
                      >
                        <Trash2 size={15} /> Elimina
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleDettaglio(archivio._id)}
                      style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: '#475569' }}
                    >
                      {isOpen ? <><ChevronUp size={15} /> Chiudi</> : <><ChevronDown size={15} /> Visualizza</>}
                    </button>
                  </div>
                </div>

                {/* Dettaglio */}
                {isOpen && (
                  <div style={{ padding: '20px' }} ref={printRef}>
                    {loadingDettaglio ? (
                      <p style={{ textAlign: 'center', color: '#666' }}>⏳ Caricamento dettaglio...</p>
                    ) : dettaglio ? (
                      <>
                        {/* Accessi */}
                        <div style={{ marginBottom: '20px' }}>
                          <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151' }}>
                            <Clock size={16} /> Accessi Registrati ({dettaglio.accessi.length})
                          </h4>
                          {dettaglio.accessi.length === 0 ? (
                            <p style={{ color: '#888', fontStyle: 'italic' }}>Nessun accesso registrato.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {dettaglio.accessi.map((acc, idx) => (
                                <div key={idx} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '0.85rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                    <div>
                                      <strong>{acc.staffName}</strong>
                                      <span style={{ color: '#666', marginLeft: '6px', fontSize: '0.8rem' }}>({acc.staffRole})</span>
                                      <span style={{ marginLeft: '12px' }}>🟢 {formatOra(acc.oraEntrata)}</span>
                                      {acc.oraUscita && <span style={{ marginLeft: '8px' }}>🔴 {formatOra(acc.oraUscita)}</span>}
                                      {acc.oraUscita && <span style={{ marginLeft: '8px', color: '#7c3aed' }}>⏱️ {calcolaDurata(acc.oraEntrata, acc.oraUscita)}</span>}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                      📅 {formatData(acc.oraEntrata)} — ✍️ {acc.firmaLogin}
                                    </div>
                                  </div>
                                  {acc.note && <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#555', fontStyle: 'italic' }}>📝 {acc.note}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Diario clinico */}
                        <div style={{ marginBottom: '20px' }}>
                          <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151' }}>
                            <Activity size={16} /> Diario Clinico ({dettaglio.diario.length} voci)
                          </h4>
                          {dettaglio.diario.length === 0 ? (
                            <p style={{ color: '#888', fontStyle: 'italic' }}>Nessuna voce nel diario.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                              {dettaglio.diario.map((entry, idx) => (
                                <div key={idx} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${entry.firmato ? '#86efac' : '#e5e7eb'}`, backgroundColor: entry.firmato ? '#f0fdf4' : '#fafafa' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#888' }}>
                                    📅 {formatDataOra(entry.dataRegistrazione)} — ✍️ {entry.firmaLogin}
                                    {entry.firmato && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '600' }}>
                                        <Lock size={10} /> Firmato {entry.dataFirma ? formatData(entry.dataFirma) : ''}
                                      </span>
                                    )}
                                  </div>
                                  <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.testo}</p>
                                  {entry.parametriVitali && Object.values(entry.parametriVitali).some(v => v !== undefined && v !== null) && (
                                    <div style={{ padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                                      <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: '600', marginBottom: '4px' }}>Parametri vitali</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {entry.parametriVitali.pressioneSistolica && entry.parametriVitali.pressioneDiastolica && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🩺 {entry.parametriVitali.pressioneSistolica}/{entry.parametriVitali.pressioneDiastolica} mmHg</span>}
                                        {entry.parametriVitali.frequenzaCardiaca && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>❤️ {entry.parametriVitali.frequenzaCardiaca} bpm</span>}
                                        {entry.parametriVitali.temperatura && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🌡️ {entry.parametriVitali.temperatura}°C</span>}
                                        {entry.parametriVitali.saturazione && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>💨 SpO₂ {entry.parametriVitali.saturazione}%</span>}
                                        {entry.parametriVitali.glicemia && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🩸 {entry.parametriVitali.glicemia} mg/dL</span>}
                                        {entry.parametriVitali.peso && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>⚖️ {entry.parametriVitali.peso} kg</span>}
                                        {entry.parametriVitali.dolore !== undefined && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd', color: entry.parametriVitali.dolore >= 7 ? '#dc2626' : entry.parametriVitali.dolore >= 4 ? '#d97706' : '#16a34a' }}>😣 Dolore: {entry.parametriVitali.dolore}/10</span>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Allegati */}
                        {dettaglio.allegati.length > 0 && (
                          <div>
                            <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151' }}>
                              <Paperclip size={16} /> Allegati ({dettaglio.allegati.length})
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {dettaglio.allegati.map((all, idx) => (
                                <div key={idx} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #fed7aa', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ flexShrink: 0 }}>{getFileIcon(all.mimeType)}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: '600', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{all.nomeFile}</div>
                                    <div style={{ fontSize: '0.72rem', color: '#888', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                      <span>{formatDimensione(all.dimensione)}</span>
                                      <span>📅 {formatData(all.dataCaricamento)}</span>
                                      <span>👤 {all.caricatoDa}</span>
                                      {all.descrizione && <span style={{ fontStyle: 'italic' }}>{all.descrizione}</span>}
                                    </div>
                                  </div>
                                  {all.urlCloudinary && (
                                    <button type="button" onClick={() => window.open(all.urlCloudinary, '_blank')} style={{ background: '#0284c7', border: 'none', cursor: 'pointer', color: 'white', padding: '5px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', flexShrink: 0 }}>
                                      <ExternalLink size={12} /> Apri
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { Search, BookOpen, Activity, Printer, ChevronDown, ChevronUp, Lock, Paperclip, FileText, Image, File, ExternalLink, Eye } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

interface CartellaSummary {
  _id: { patient: string; workPlan: string };
  paziente: { _id: string; firstName: string; lastName: string };
  workPlan: { _id: string; task: string; date: string; type: string; category: string; status: string };
  ultimaRegistrazione: string;
  primaRegistrazione: string;
  totaleVoci: number;
  vociFirmate: number;
}

interface DiarioEntry {
  _id: string;
  testo: string;
  dataRegistrazione: string;
  staffName: string;
  firmaLogin: string;
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
}

interface AllegatoInfo {
  _id: string;
  nomeFile: string;
  mimeType: string;
  dimensione: number;
  descrizione?: string;
  caricatoDa: string;
  dataCaricamento: string;
  urlCloudinary?: string;
}

export default function StoricoCliniche() {
  const navigate = useNavigate();
  const [cartelle, setCartelle] = useState<CartellaSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dettaglio, setDettaglio] = useState<DiarioEntry[]>([]);
  const [allegatiDettaglio, setAllegatiDettaglio] = useState<AllegatoInfo[]>([]);
  const [loadingDettaglio, setLoadingDettaglio] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    caricaStorico();
  }, []);

  const caricaStorico = async (paziente = '') => {
    setLoading(true);
    try {
      const params = paziente ? `?paziente=${encodeURIComponent(paziente)}` : '';
      const res = await api.get(`/diario/storico/tutti${params}`);
      setCartelle(res.data);
    } catch (err) {
      console.error('Errore caricamento storico', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    caricaStorico(searchTerm);
  };

  const toggleDettaglio = async (key: string, workPlanId: string) => {
    if (expanded === key) {
      setExpanded(null);
      setDettaglio([]);
      setAllegatiDettaglio([]);
      return;
    }
    setExpanded(key);
    setLoadingDettaglio(true);
    try {
      const [diarioRes, allegatiRes] = await Promise.all([
        api.get(`/diario/${workPlanId}`),
        api.get(`/allegati/${workPlanId}`),
      ]);
      setDettaglio(diarioRes.data);
      setAllegatiDettaglio(allegatiRes.data);
    } catch (err) {
      console.error('Errore caricamento dettaglio', err);
    } finally {
      setLoadingDettaglio(false);
    }
  };

  const apriAllegato = (allegato: AllegatoInfo) => {
    // Se l'allegato è su Cloudinary, apri direttamente l'URL (nessun token necessario)
    if (allegato.urlCloudinary) {
      window.open(allegato.urlCloudinary, '_blank');
      return;
    }
    // Fallback: usa l'endpoint backend con token (storage locale)
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Sessione scaduta. Effettua nuovamente il login.');
      return;
    }
    window.open(`${API_BASE}/allegati/file/${allegato._id}?token=${encodeURIComponent(token)}`, '_blank');
  };

  const formatDimensione = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image size={14} color="#0284c7" />;
    if (mimeType === 'application/pdf') return <FileText size={14} color="#dc2626" />;
    return <File size={14} color="#6b7280" />;
  };

  const stampaCartella = (cartella: CartellaSummary) => {
    const entries = dettaglio;
    const win = window.open('', '_blank');
    if (!win) return;

    const html = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Cartella Clinica — ${cartella.paziente?.firstName} ${cartella.paziente?.lastName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 20px; }
    .logo-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; border-bottom: 2px solid #1e40af; padding-bottom: 12px; }
    .logo-header img { height: 60px; width: auto; }
    .logo-header .title-block h1 { margin: 0; font-size: 18px; color: #1e40af; }
    .logo-header .title-block p { margin: 2px 0 0; font-size: 11px; color: #666; }
    h1 { font-size: 18px; border-bottom: 2px solid #1e40af; padding-bottom: 8px; color: #1e40af; }
    h2 { font-size: 14px; color: #444; margin-top: 16px; }
    .header-info { display: flex; gap: 32px; margin-bottom: 16px; flex-wrap: wrap; }
    .info-block { background: #f0f9ff; padding: 8px 12px; border-radius: 4px; border: 1px solid #bae6fd; }
    .entry { border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; }
    .entry.firmato { border-color: #86efac; background: #f0fdf4; }
    .entry-header { font-size: 11px; color: #666; margin-bottom: 6px; }
    .firma-badge { display: inline-block; background: #dcfce7; color: #16a34a; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; }
    .testo { white-space: pre-wrap; line-height: 1.5; }
    .parametri { background: #f0f9ff; padding: 6px 10px; border-radius: 4px; margin-top: 6px; font-size: 11px; }
    .param-badge { display: inline-block; background: white; border: 1px solid #bae6fd; padding: 1px 6px; border-radius: 3px; margin: 2px; }
    .footer { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 10px; color: #888; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="logo-header">
    <img src="${window.location.origin}/logo.png" alt="Abbraccio" onerror="this.style.display='none'" />
    <div class="title-block">
      <h1>📋 Cartella Clinica</h1>
      <p>Abbraccio Cure Domiciliari</p>
    </div>
  </div>
  <div class="header-info">
    <div class="info-block"><strong>Paziente:</strong> ${cartella.paziente?.firstName} ${cartella.paziente?.lastName}</div>
    <div class="info-block"><strong>Piano:</strong> ${cartella.workPlan?.task || 'N/D'}</div>
    <div class="info-block"><strong>Periodo:</strong> ${new Date(cartella.primaRegistrazione).toLocaleDateString('it-IT')} — ${new Date(cartella.ultimaRegistrazione).toLocaleDateString('it-IT')}</div>
    <div class="info-block"><strong>Voci:</strong> ${cartella.totaleVoci} (${cartella.vociFirmate} firmate)</div>
  </div>
  <h2>Diario Clinico</h2>
  ${entries.map(e => `
  <div class="entry ${e.firmato ? 'firmato' : ''}">
    <div class="entry-header">
      📅 ${new Date(e.dataRegistrazione).toLocaleString('it-IT')} — ✍️ ${e.firmaLogin}
      ${e.firmato ? `<span class="firma-badge">🔒 Firmato ${e.dataFirma ? new Date(e.dataFirma).toLocaleDateString('it-IT') : ''}</span>` : ''}
    </div>
    <div class="testo">${e.testo}</div>
    ${e.parametriVitali && Object.values(e.parametriVitali).some(v => v !== undefined) ? `
    <div class="parametri">
      <strong>Parametri vitali:</strong><br/>
      ${e.parametriVitali.pressioneSistolica && e.parametriVitali.pressioneDiastolica ? `<span class="param-badge">🩺 ${e.parametriVitali.pressioneSistolica}/${e.parametriVitali.pressioneDiastolica} mmHg</span>` : ''}
      ${e.parametriVitali.frequenzaCardiaca ? `<span class="param-badge">❤️ ${e.parametriVitali.frequenzaCardiaca} bpm</span>` : ''}
      ${e.parametriVitali.temperatura ? `<span class="param-badge">🌡️ ${e.parametriVitali.temperatura}°C</span>` : ''}
      ${e.parametriVitali.saturazione ? `<span class="param-badge">💨 SpO₂ ${e.parametriVitali.saturazione}%</span>` : ''}
      ${e.parametriVitali.glicemia ? `<span class="param-badge">🩸 ${e.parametriVitali.glicemia} mg/dL</span>` : ''}
      ${e.parametriVitali.peso ? `<span class="param-badge">⚖️ ${e.parametriVitali.peso} kg</span>` : ''}
      ${e.parametriVitali.dolore !== undefined ? `<span class="param-badge">😣 Dolore: ${e.parametriVitali.dolore}/10</span>` : ''}
    </div>` : ''}
  </div>`).join('')}
    ${allegatiDettaglio.length > 0 ? `
  <h2>📎 Allegati (${allegatiDettaglio.length})</h2>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <thead><tr style="background:#f0f9ff;"><th style="padding:6px;border:1px solid #bae6fd;text-align:left;">File</th><th style="padding:6px;border:1px solid #bae6fd;">Dimensione</th><th style="padding:6px;border:1px solid #bae6fd;">Caricato da</th><th style="padding:6px;border:1px solid #bae6fd;">Data</th><th style="padding:6px;border:1px solid #bae6fd;">Descrizione</th></tr></thead>
    <tbody>${allegatiDettaglio.map(a => `<tr><td style="padding:5px;border:1px solid #e5e7eb;">${a.nomeFile}</td><td style="padding:5px;border:1px solid #e5e7eb;text-align:center;">${a.dimensione < 1024*1024 ? (a.dimensione/1024).toFixed(1)+' KB' : (a.dimensione/(1024*1024)).toFixed(1)+' MB'}</td><td style="padding:5px;border:1px solid #e5e7eb;">${a.caricatoDa}</td><td style="padding:5px;border:1px solid #e5e7eb;">${new Date(a.dataCaricamento).toLocaleDateString('it-IT')}</td><td style="padding:5px;border:1px solid #e5e7eb;font-style:italic;">${a.descrizione || ''}</td></tr>`).join('')}</tbody>
  </table>` : ''}
  <div class="footer">
    Documento generato il ${new Date().toLocaleString('it-IT')} — App Abbraccio
  </div>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const formatData = (d: string) => new Date(d).toLocaleDateString('it-IT');
  const formatDataOra = (d: string) => new Date(d).toLocaleString('it-IT');

  return (
    <section>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <BookOpen size={28} />
        Storico Cartelle Cliniche
      </h2>

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
        <button type="submit" style={{ padding: '12px 20px', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Search size={16} /> Cerca
        </button>
        {searchTerm && (
          <button type="button" onClick={() => { setSearchTerm(''); caricaStorico(); }} style={{ padding: '12px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Tutti
          </button>
        )}
      </form>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#666', padding: '32px' }}>⏳ Caricamento...</p>
      ) : cartelle.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <BookOpen size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p>Nessuna cartella clinica trovata.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cartelle.map(c => {
            const key = `${c._id.patient}-${c._id.workPlan}`;
            const isOpen = expanded === key;
            const tuttiSegnati = c.vociFirmate === c.totaleVoci && c.totaleVoci > 0;
            return (
              <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {/* Header cartella */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: '#f8fafc', borderBottom: isOpen ? '1px solid #e5e7eb' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1rem' }}>
                        {c.paziente?.firstName} {c.paziente?.lastName}
                      </strong>
                      {tuttiSegnati && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '600' }}>
                          <Lock size={10} /> Tutte firmate
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '10px' }}>
                        {c.workPlan?.type === 'prestazionale' ? 'Prestazionale' : 'Assistenziale'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#555' }}>
                      📋 {c.workPlan?.task || 'Piano di lavoro'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span>📅 {formatData(c.primaRegistrazione)} → {formatData(c.ultimaRegistrazione)}</span>
                      <span>📝 {c.totaleVoci} voci ({c.vociFirmate} firmate)</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/workplan-access/${c._id.workPlan}`)}
                      style={{ padding: '8px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}
                      title="Apri la cartella completa"
                    >
                      <Eye size={15} /> Consulta
                    </button>
                    {isOpen && (
                      <button
                        type="button"
                        onClick={() => stampaCartella(c)}
                        style={{ padding: '8px 12px', background: '#1e40af', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}
                        title="Stampa cartella"
                      >
                        <Printer size={15} /> Stampa
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleDettaglio(key, c._id.workPlan)}
                      style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: '#475569' }}
                    >
                      {isOpen ? <><ChevronUp size={15} /> Chiudi</> : <><ChevronDown size={15} /> Anteprima</>}
                    </button>
                  </div>
                </div>

                {/* Dettaglio voci */}
                {isOpen && (
                  <div style={{ padding: '16px' }} ref={printRef}>
                    {loadingDettaglio ? (
                      <p style={{ textAlign: 'center', color: '#666' }}>⏳ Caricamento voci...</p>
                    ) : dettaglio.length === 0 ? (
                      <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center' }}>Nessuna voce nel diario.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {dettaglio.map(entry => (
                          <div key={entry._id} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${entry.firmato ? '#86efac' : '#e5e7eb'}`, backgroundColor: entry.firmato ? '#f0fdf4' : '#fafafa' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#888' }}>
                              📅 {formatDataOra(entry.dataRegistrazione)} — ✍️ {entry.firmaLogin}
                              {entry.firmato && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '600' }}>
                                  <Lock size={10} /> Firmato {entry.dataFirma ? new Date(entry.dataFirma).toLocaleDateString('it-IT') : ''}
                                </span>
                              )}
                            </div>
                            <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.testo}</p>
                            {entry.parametriVitali && Object.values(entry.parametriVitali).some(v => v !== undefined && v !== null) && (
                              <div style={{ padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                                <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Activity size={12} /> Parametri vitali
                                </div>
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

                    {/* Sezione allegati */}
                    {!loadingDettaglio && allegatiDettaglio.length > 0 && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontWeight: '600', color: '#c2410c', marginBottom: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Paperclip size={16} /> Allegati ({allegatiDettaglio.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {allegatiDettaglio.map(all => (
                            <div key={all._id} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #fed7aa', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ flexShrink: 0 }}>{getFileIcon(all.mimeType)}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: '600', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{all.nomeFile}</div>
                                <div style={{ fontSize: '0.72rem', color: '#888', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <span>{formatDimensione(all.dimensione)}</span>
                                  <span>📅 {new Date(all.dataCaricamento).toLocaleDateString('it-IT')}</span>
                                  <span>👤 {all.caricatoDa}</span>
                                  {all.descrizione && <span style={{ fontStyle: 'italic' }}>{all.descrizione}</span>}
                                </div>
                              </div>
                              <button type="button" onClick={() => apriAllegato(all)} style={{ background: '#0284c7', border: 'none', cursor: 'pointer', color: 'white', padding: '5px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', flexShrink: 0 }}>
                                <ExternalLink size={12} /> Apri
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

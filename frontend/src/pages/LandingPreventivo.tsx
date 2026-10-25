import { useEffect, useRef, useState, FormEvent } from 'react';
import axios from 'axios';
import { Calculator, CheckCircle, Send, FileText, Info, Plus, Minus, Trash2, Phone, MessageCircle, Stethoscope, Tag } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.abbracciocuredomiciliari.it/api';
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '';
const TELEFONO = '0601905242';
const TELEFONO_LABEL = '06 01905242';
const WHATSAPP = '393514175117';

interface VoceListino { id: string; nome: string; prezzo: number; prezzoListino: number; promo: boolean; unitaMisura: string | null; note: string | null }
interface CategoriaListino { key: string; label: string; descrizione: string; ordine: number; voci: VoceListino[] }
interface Riga { voceId: string; categoria: string; descrizione: string; unitaMisura?: string; note?: string; quantita: number; prezzoUnitario: number; prezzoListino: number; promo: boolean; importo: number }
interface Preventivo { righe: Riga[]; subtotale: number; scontoPerc: number; sconto: number; totale: number; scontoApplicato: boolean; minServiziPerSconto: number }
const SCONTO_PERC = 5; // sconto "più servizi": allineato al server

// Preselezione da link del sito (?servizio=<slug pagina>): categoria da aprire
// e, se univoca, la voce di listino da aggiungere gia' al preventivo.
// `voce` e' una regex sul nome della voce, cosi' regge piccoli rinomini del listino.
const PRESELEZIONE: Record<string, { cat: string; voce?: RegExp; label: string }> = {
  'holter-pressorio':         { cat: 'esami_strumentali', voce: /holter\s*pressorio/i, label: 'Holter pressorio' },
  'holter-ecg':               { cat: 'esami_strumentali', voce: /holter\s*(cardiaco|ecg)/i, label: 'Holter ECG' },
  'apnee-sonno':              { cat: 'esami_strumentali', voce: /polisonn/i, label: 'Polisonnografia (apnee del sonno)' },
  'screening-cardiaci':       { cat: 'esami_strumentali', voce: /^ecg$/i, label: 'ECG' },
  'saturimetria-spirometria': { cat: 'esami_strumentali', voce: /spirometria/i, label: 'Spirometria' },
  'emogasanalisi':            { cat: 'esami_strumentali', voce: /emogas|^ega$/i, label: 'Emogasanalisi' },
  'prelievi-ematici':         { cat: 'prelievi', voce: /prelievo\s*ematico/i, label: 'Prelievo ematico' },
  'rx-domiciliare':           { cat: 'radiologia', label: 'Radiologia a domicilio' },
  'ecografia-domiciliare':    { cat: 'ecografia', label: 'Ecografia a domicilio' },
  'esami-strumentali':        { cat: 'esami_strumentali', label: 'Esami strumentali' },
  'infermiere-a-domicilio':   { cat: 'prestazioni_infermieristiche', label: 'Assistenza infermieristica' },
  'cure-pazienti-cronici':    { cat: 'prestazioni_infermieristiche', label: 'Cure pazienti cronici' },
  'cure-palliative':          { cat: 'prestazioni_infermieristiche', label: 'Cure palliative' },
  'fisioterapia-a-domicilio': { cat: 'riabilitazione', voce: /fisioterap/i, label: 'Fisioterapia' },
  'assistenza-anziani':       { cat: 'assistenza_domiciliare', voce: /assistenza\s*oss/i, label: 'Assistenza OSS' },
  'assistenza-notturna':      { cat: 'assistenza_domiciliare', voce: /^assistenza\s*notturna/i, label: 'Assistenza notturna' },
  'servizio-ambulanza':       { cat: 'trasporto', label: 'Trasporto in ambulanza' },
  'visite-specialistiche':    { cat: 'visite_mediche', label: 'Visite specialistiche' },
  'psicologia-a-domicilio':   { cat: 'visite_mediche', voce: /psicolog/i, label: 'Colloquio psicologico' },
};

declare global {
  interface Window { fbq?: (...args: any[]) => void; }
}

function tracciaPixel(evento: string, dati?: Record<string, any>) {
  try {
    if (window.fbq) window.fbq('track', evento, dati);
  } catch { /* pixel non disponibile */ }
}

// Icona "i" con spiegazione al tocco (funziona anche su mobile)
function InfoNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }} title={text} aria-label="Cosa significa questa voce"
        style={{ border: 'none', background: 'none', padding: '0 0 0 6px', cursor: 'pointer', color: '#0284c7', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
        <Info size={15} />
      </button>
      {open && (
        <div style={{ fontWeight: 400, fontSize: '0.76rem', color: '#0c4a6e', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px 10px', marginTop: '5px', lineHeight: 1.45 }}>
          {text}
        </div>
      )}
    </>
  );
}

const euro = (n: number) => `€ ${Number(n || 0).toFixed(2).replace('.', ',')}`;

export default function LandingPreventivo() {
  const [categorie, setCategorie] = useState<CategoriaListino[]>([]);
  const [listinoErr, setListinoErr] = useState('');
  const [categoriaAttiva, setCategoriaAttiva] = useState('');
  const [selezione, setSelezione] = useState<Record<string, number>>({}); // voceId -> quantita (ore/giorno per i servizi orari)
  const [giorniVoci, setGiorniVoci] = useState<Record<string, number>>({}); // voceId -> giorni (solo servizi orari)
  const [preselezione, setPreselezione] = useState<{ label: string; voceNome?: string } | null>(null);
  const [showLegenda, setShowLegenda] = useState(false);

  const [prev, setPrev] = useState<Preventivo | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ numero: string; totale: number } | null>(null);
  const [sendError, setSendError] = useState('');

  const utmRef = useRef<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement | null>(null);

  // ─── Listino dal gestionale (stessi prezzi dell'area riservata) ─────────────
  useEffect(() => {
    axios.get(`${API_BASE}/landing-preventivo/listino`)
      .then(res => {
        const cats: CategoriaListino[] = res.data?.categorie || [];
        setCategorie(cats);
        if (cats.length === 0) return;
        // Arrivo da una pagina servizio del sito: apri la categoria giusta e,
        // se la voce e' univoca, aggiungila gia' al preventivo (quantita' 1).
        const slug = new URLSearchParams(window.location.search).get('servizio') || '';
        const pre = PRESELEZIONE[slug];
        const cat = pre ? cats.find(c => c.key === pre.cat) : undefined;
        if (pre && cat) {
          setCategoriaAttiva(cat.key);
          const voce = pre.voce ? cat.voci.find(v => pre.voce!.test(v.nome)) : undefined;
          if (voce) setSelezione({ [voce.id]: 1 });
          setPreselezione({ label: pre.label, voceNome: voce?.nome });
        } else {
          setCategoriaAttiva(cats[0].key);
        }
      })
      .catch(() => setListinoErr('Listino non disponibile al momento. Riprova tra poco o chiamaci.'));
  }, []);

  // ─── Meta Pixel + parametri UTM ─────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'gad_source', 'msclkid'].forEach(k => {
      const v = params.get(k);
      if (v) utm[k] = v;
    });
    utmRef.current = utm;

    if (META_PIXEL_ID && !window.fbq) {
      try {
        const w = window as any;
        const f: any = function () { f.queue.push(arguments); };
        f.queue = []; f.loaded = true; f.version = '2.0';
        w.fbq = f; w._fbq = f;
        const s = document.createElement('script');
        s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(s);
        window.fbq!('init', META_PIXEL_ID);
      } catch { /* ignorato */ }
    }
    tracciaPixel('PageView');
  }, []);

  const tutteVoci = categorie.flatMap(c => c.voci);
  const isOraria = (v: VoceListino) => v.unitaMisura === 'ora';
  const vociBody = () => Object.entries(selezione).filter(([, q]) => q > 0).map(([id, quantita]) => ({ id, quantita, giorni: giorniVoci[id] || 1 }));
  const numSelezionate = vociBody().length;

  // Qualunque modifica alla selezione azzera il preventivo: va rigenerato
  const invalida = () => setPrev(null);
  const setQta = (id: string, q: number) => {
    setSelezione(s => {
      const n = { ...s };
      if (q <= 0) delete n[id]; else n[id] = Math.min(q, 999);
      return n;
    });
    invalida();
  };
  const setGiorniVoce = (id: string, g: number) => {
    setGiorniVoci(s => {
      const n = { ...s };
      if (g <= 1) delete n[id]; else n[id] = Math.min(g, 365);
      return n;
    });
    invalida();
  };

  // Prezzo: listino barrato + promo in evidenza, altrimenti solo il prezzo corrente
  const Prezzo = ({ v, suffisso }: { v: VoceListino; suffisso?: string }) => v.promo ? (
    <>
      <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{euro(v.prezzoListino)}</span>{' '}
      <span style={{ color: '#b91c1c', fontWeight: 800 }}>{euro(v.prezzo)}</span>{suffisso}
      <span style={{ marginLeft: '6px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle' }}><Tag size={10} /> PROMO</span>
    </>
  ) : <>{euro(v.prezzo)}{suffisso}</>;

  async function genera() {
    if (numSelezionate === 0) { setPreviewError('Seleziona almeno una prestazione dal listino.'); return; }
    try {
      setPreviewLoading(true);
      setPreviewError('');
      const res = await axios.post(`${API_BASE}/landing-preventivo/preview`, { voci: vociBody() });
      setPrev(res.data);
      tracciaPixel('ViewContent', { content_name: 'Preventivo prestazioni generato' });
    } catch (err: any) {
      setPrev(null);
      setPreviewError(err?.response?.data?.message || 'Controlla le prestazioni selezionate');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function inviaRichiesta(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !telefono.trim()) { setSendError('Inserisci nome e numero di telefono.'); return; }
    if (!prev) {
      setSendError('Genera prima il preventivo con il pulsante "Genera preventivo".');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      setSending(true);
      setSendError('');
      const res = await axios.post(`${API_BASE}/landing-preventivo/richiesta`, {
        nome: nome.trim(), telefono: telefono.trim(), email: email.trim() || undefined, messaggio: messaggio.trim() || undefined,
        voci: vociBody(), utm: utmRef.current,
      });
      setSent({ numero: res.data?.preventivo?.numero || '', totale: res.data?.preventivo?.totale ?? prev.totale });
      tracciaPixel('Lead', { content_name: 'Preventivo prestazioni' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setSendError(err?.response?.data?.message || 'Errore nell\'invio. Riprova.');
    } finally {
      setSending(false);
    }
  }

  // Testo del preventivo da condividere su WhatsApp
  const testoWhatsApp = () => {
    const righe = prev ? prev.righe.map(r => `• ${r.descrizione}${r.unitaMisura ? ` (${r.unitaMisura})` : ''} x${r.quantita} a ${euro(r.prezzoUnitario)}${r.promo ? ' (PROMO)' : ''} = ${euro(r.importo)}`).join('\n') : '';
    const scontoTxt = prev?.scontoApplicato ? `\nSubtotale: ${euro(prev.subtotale)}\nSconto più servizi ${prev.scontoPerc}%: -${euro(prev.sconto)}` : '';
    const intro = nome.trim() ? `Buongiorno, sono ${nome.trim()}.` : 'Buongiorno,';
    const corpo = prev
      ? `${intro} ho calcolato questo preventivo sul vostro sito:\n${righe}${scontoTxt}\nTOTALE: ${euro(prev.totale)}\n\nVorrei maggiori informazioni e confermare disponibilità e tariffa nella mia zona.${messaggio.trim() ? `\n\nMessaggio: ${messaggio.trim()}` : ''}`
      : `${intro} vorrei informazioni sulle vostre prestazioni a domicilio e un preventivo.${messaggio.trim() ? `\n\nMessaggio: ${messaggio.trim()}` : ''}`;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(corpo)}`;
  };

  const input: React.CSSProperties = { width: '100%', padding: '11px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' };
  const label: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '5px' };
  // Menu a tendina categoria: evidenziato e leggibile
  const selectCat: React.CSSProperties = { ...input, padding: '14px 16px', fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', background: 'linear-gradient(180deg,#dbeafe,#eff6ff)', border: '2px solid #3b82f6', borderRadius: '12px', boxShadow: '0 3px 10px rgba(30,77,140,.18)', cursor: 'pointer' };
  const btnWa: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', background: '#25d366', color: '#fff', fontWeight: 800, textDecoration: 'none', fontSize: '0.95rem', border: 'none', cursor: 'pointer' };
  const btnTel: React.CSSProperties = { ...btnWa, background: '#1e4d8c' };

  const catCorrente = categorie.find(c => c.key === categoriaAttiva);

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eff6ff,#ffffff 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '44px 36px', maxWidth: '540px', textAlign: 'center', border: '1px solid #dbeafe' }}>
          <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 16px' }} />
          <h1 style={{ color: '#1e293b', fontSize: '1.5rem', margin: '0 0 10px' }}>Richiesta inviata!</h1>
          <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 14px' }}>
            Grazie <strong>{nome.split(' ')[0]}</strong>, ti ricontatteremo al più presto al numero <strong>{telefono}</strong>.
          </p>
          <p style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px', color: '#1e3a8a', fontSize: '0.9rem' }}>
            Preventivo <strong>{sent.numero}</strong> registrato — totale <strong>{euro(sent.totale)}</strong>.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '18px' }}>
            <a href={testoWhatsApp()} target="_blank" rel="noopener" style={btnWa}><MessageCircle size={18} /> Scrivici su WhatsApp</a>
            <a href={`tel:${TELEFONO}`} style={btnTel}><Phone size={18} /> Chiama {TELEFONO_LABEL}</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eff6ff,#ffffff 55%)', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      {/* Header — solo brand Abbraccio */}
      <header style={{ background: '#fff', borderBottom: '1px solid #dbeafe', padding: '12px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ height: '46px', width: 'auto', display: 'block' }} />
          <div>
            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', lineHeight: 1.1 }}>Abbraccio Cure Domiciliari</div>
            <div style={{ fontSize: '0.75rem', color: '#1e4d8c', fontWeight: 600 }}>Infermieri · OSS · Visite mediche · Esami a domicilio</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <a href={`tel:${TELEFONO}`} style={{ ...btnTel, padding: '8px 12px', fontSize: '0.82rem' }}><Phone size={15} /> <span className="landing-hide-mobile">{TELEFONO_LABEL}</span></a>
            <a href={testoWhatsApp()} target="_blank" rel="noopener" style={{ ...btnWa, padding: '8px 12px', fontSize: '0.82rem' }}><MessageCircle size={15} /> <span className="landing-hide-mobile">WhatsApp</span></a>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '28px 16px 48px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ background: '#dbeafe', color: '#1e3a8a', padding: '6px 14px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
            Preventivo online gratuito
          </span>
          <h1 style={{ color: '#1e293b', fontSize: 'clamp(1.5rem,4vw,2.2rem)', margin: '14px 0 8px', fontWeight: 800 }}>
            Calcola il costo delle prestazioni sanitarie a domicilio
          </h1>
          <p style={{ color: '#64748b', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
            Accessi infermieristici, assistenza OSS, visite specialistiche, prelievi, fisioterapia ed esami direttamente a casa tua, a Roma e provincia. Scegli le prestazioni dal nostro listino e genera il preventivo in 1 minuto.
          </p>
          <span style={{ display: 'inline-block', marginTop: '12px', background: '#dcfce7', color: '#166534', padding: '6px 14px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
            🎉 Combina 2 o più servizi nello stesso preventivo: sconto {SCONTO_PERC}% automatico
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '20px', alignItems: 'start' }}>
          {/* Calcolatore */}
          <div style={{ background: 'linear-gradient(165deg,#eff6ff 0%,#ffffff 55%)', borderRadius: '16px', border: '1px solid #93c5fd', boxShadow: '0 8px 24px rgba(30,77,140,.10)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#1e3a8a,#1e4d8c)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calculator size={20} color="#fff" />
              <div>
                <h2 style={{ fontSize: '1.05rem', color: '#fff', margin: 0, fontWeight: 800 }}>Calcolatore prestazioni</h2>
                <div style={{ fontSize: '0.72rem', color: '#dbeafe' }}>listino ufficiale Abbraccio Cure Domiciliari</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '14px', padding: '22px 24px 24px' }}>
              {preselezione && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '10px 12px', fontSize: '0.82rem', color: '#065f46', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <Stethoscope size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    Stai calcolando il preventivo per <strong>{preselezione.label}</strong>.
                    {preselezione.voceNome
                      ? <> La prestazione <strong>«{preselezione.voceNome}»</strong> è già nel preventivo: regola la quantità o aggiungi altri servizi (sconto {SCONTO_PERC}% dal secondo).</>
                      : <> Scegli qui sotto la prestazione specifica dal listino.</>}
                  </span>
                </div>
              )}
              {listinoErr && <p style={{ color: '#dc2626', fontSize: '0.88rem', margin: 0 }}>{listinoErr}</p>}
              {!listinoErr && categorie.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>⏳ Caricamento listino...</p>}

              {categorie.length > 0 && (
                <>
                  <div>
                    <span style={{ ...label, fontSize: '1rem', color: '#1e4d8c', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center' }}>📋 SCEGLI IL TIPO DI PRESTAZIONE <InfoNote text="Scegli la categoria: ogni categoria raggruppa le prestazioni del nostro listino. Puoi aggiungere prestazioni da più categorie allo stesso preventivo." /></span>
                    <select value={categoriaAttiva} onChange={e => setCategoriaAttiva(e.target.value)} style={selectCat}>
                      {categorie.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    {catCorrente && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{catCorrente.descrizione}</span>}
                    <button type="button" onClick={() => setShowLegenda(o => !o)}
                      style={{ marginTop: '6px', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#1e4d8c', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Info size={14} /> {showLegenda ? 'Nascondi la legenda delle categorie' : 'Quale categoria scegliere? Legenda'}
                    </button>
                    {showLegenda && (
                      <div style={{ marginTop: '8px', background: '#fff', border: '1px solid #bfdbfe', borderRadius: '10px', overflow: 'hidden' }}>
                        {categorie.map(c => (
                          <button key={c.key} type="button" onClick={() => { setCategoriaAttiva(c.key); setShowLegenda(false); }}
                            style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #eff6ff', padding: '9px 12px', cursor: 'pointer', background: c.key === categoriaAttiva ? '#dbeafe' : '#fff', fontFamily: 'inherit' }}>
                            <Stethoscope size={16} color="#1e4d8c" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>
                              <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{c.label} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {c.voci.length} voci</span></span>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>{c.descrizione}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Voci della categoria */}
                  {catCorrente && (
                    <div style={{ background: '#fff', border: '1px solid #dbeafe', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Prestazione</span><span>Prezzo · Quantità <InfoNote text="I prezzi sono quelli del listino ufficiale Abbraccio. Le prestazioni contrassegnate PROMO hanno un prezzo promozionale: il listino è mostrato barrato. La quantità indica accessi, ore o esami." /></span>
                      </div>
                      <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                        {catCorrente.voci.map(v => {
                          const q = selezione[v.id] || 0;
                          const gg = giorniVoci[v.id] || 1;
                          return (
                            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderBottom: '1px solid #f1f5f9', background: q > 0 ? '#eff6ff' : v.promo ? '#fff7f7' : '#fff', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{v.nome}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  <Prezzo v={v} suffisso={v.unitaMisura ? ` / ${v.unitaMisura}` : ''} />{v.note ? ` · ${v.note}` : ''}
                                </div>
                              </div>
                              {q === 0 ? (
                                <button type="button" onClick={() => setQta(v.id, 1)} style={{ border: '1px solid #1e4d8c', background: '#fff', color: '#1e4d8c', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                  <Plus size={14} /> Aggiungi
                                </button>
                              ) : (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                  <button type="button" onClick={() => setQta(v.id, q - 1)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={13} /></button>
                                  <input type="number" min={1} max={999} value={q} onChange={e => setQta(v.id, Number(e.target.value) || 1)} style={{ width: '46px', textAlign: 'center', padding: '5px 2px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 700 }} />
                                  <button type="button" onClick={() => setQta(v.id, q + 1)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
                                </div>
                              )}
                              {isOraria(v) && q > 0 && (
                                <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '6px 9px' }}>
                                  <span><strong>{q}</strong> ore/giorno</span>
                                  <span>per</span>
                                  <input type="number" min={1} max={365} value={gg} onChange={e => setGiorniVoce(v.id, Number(e.target.value) || 1)} style={{ width: '48px', textAlign: 'center', padding: '3px 2px', border: '1px solid #93c5fd', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem', color: '#1e4d8c' }} />
                                  <span>giorni</span>
                                  <span style={{ marginLeft: 'auto', color: '#1e4d8c', fontWeight: 800 }}>= {q * gg} ore totali · {euro(v.prezzo * q * gg)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Riepilogo selezione (tutte le categorie) */}
                  {numSelezionate > 0 && (
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c4a6e', marginBottom: '6px' }}>
                        Prestazioni selezionate ({numSelezionate})
                        <InfoNote text="La quantità indica quanti accessi, ore/giorno o esami vuoi preventivare. Per i servizi a ore (OSS, infermieristica) indichi anche per quanti giorni: es. 4 ore/giorno per 5 giorni = 20 ore totali. Puoi combinare prestazioni di categorie diverse in un unico preventivo." />
                      </div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, padding: '6px 9px', borderRadius: '8px', marginBottom: '8px', background: numSelezionate >= 2 ? '#dcfce7' : '#fef9c3', color: numSelezionate >= 2 ? '#166534' : '#854d0e' }}>
                        {numSelezionate >= 2
                          ? `🎉 Sconto ${SCONTO_PERC}% "più servizi" applicato al preventivo`
                          : `💡 Aggiungi un altro servizio e ottieni il ${SCONTO_PERC}% di sconto sul totale`}
                      </div>
                      {tutteVoci.filter(v => selezione[v.id] > 0).map(v => {
                        const gg = isOraria(v) ? (giorniVoci[v.id] || 1) : 1;
                        return (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#334155', padding: '3px 0' }}>
                            <span style={{ flex: 1 }}>{v.nome}{' '}
                              {gg > 1
                                ? <strong>× {selezione[v.id]} ore/gg · {gg} giorni</strong>
                                : <strong>× {selezione[v.id]}</strong>}
                              {v.promo && <span style={{ color: '#b91c1c', fontWeight: 800, fontSize: '0.7rem' }}> PROMO</span>}
                            </span>
                            <span style={{ fontWeight: 600 }}>{euro(v.prezzo * selezione[v.id] * gg)}</span>
                            <button type="button" onClick={() => setQta(v.id, 0)} title="Rimuovi" style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}><Trash2 size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button type="button" onClick={genera} disabled={previewLoading || numSelezionate === 0}
                    style={{ marginTop: '4px', width: '100%', padding: '14px', border: 'none', borderRadius: '10px', background: previewLoading || numSelezionate === 0 ? '#93c5fd' : 'linear-gradient(135deg,#1e3a8a,#1e4d8c)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: previewLoading ? 'wait' : numSelezionate === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(30,77,140,.30)' }}>
                    <Calculator size={18} /> {previewLoading ? 'Calcolo in corso...' : prev ? 'Rigenera preventivo' : 'Genera preventivo'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Preventivo */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #dbeafe', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: '24px', position: 'sticky', top: '80px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', color: '#1e293b', margin: '0 0 14px' }}>
              <FileText size={20} color="#1e4d8c" /> Il tuo preventivo
            </h2>
            {previewLoading && <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>⏳ Calcolo in corso...</p>}
            {previewError && <p style={{ color: '#dc2626', fontSize: '0.88rem' }}>{previewError}</p>}
            {prev && !previewError && (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <tbody>
                    {prev.righe.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 6px 8px 0', color: '#475569' }}>
                          {r.descrizione}{r.unitaMisura ? <span style={{ color: '#94a3b8' }}> ({r.unitaMisura})</span> : ''}
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {r.quantita} × {r.promo ? <><span style={{ textDecoration: 'line-through' }}>{euro(r.prezzoListino)}</span> <span style={{ color: '#b91c1c', fontWeight: 800 }}>{euro(r.prezzoUnitario)} PROMO</span></> : euro(r.prezzoUnitario)}{r.note ? ` · ${r.note}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{euro(r.importo)}</td>
                      </tr>
                    ))}
                    {prev.scontoApplicato && (
                      <>
                        <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 6px 4px 0', color: '#64748b' }}>Subtotale</td>
                          <td style={{ padding: '8px 0 4px', textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap' }}>{euro(prev.subtotale)}</td>
                        </tr>
                        <tr style={{ background: '#f0fdf4' }}>
                          <td style={{ padding: '6px 6px 6px 4px', color: '#166534', fontWeight: 700 }}>
                            🎉 Sconto più servizi {prev.scontoPerc}%
                            <div style={{ fontSize: '0.7rem', fontWeight: 500, color: '#15803d' }}>{prev.righe.length} prestazioni in un unico preventivo</div>
                          </td>
                          <td style={{ padding: '6px 4px 6px 0', textAlign: 'right', color: '#166534', fontWeight: 800, whiteSpace: 'nowrap' }}>-{euro(prev.sconto)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
                <div style={{ background: 'linear-gradient(135deg,#1e3a8a,#1e4d8c)', borderRadius: '12px', padding: '16px 18px', marginTop: '14px', color: '#fff' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9 }}>TOTALE PREVENTIVO</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}>{euro(prev.totale)}</div>
                    {prev.scontoApplicato && <div style={{ fontSize: '0.95rem', textDecoration: 'line-through', opacity: 0.7 }}>{euro(prev.subtotale)}</div>}
                    {prev.scontoApplicato && <span style={{ background: '#16a34a', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>-{prev.scontoPerc}%</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                    {prev.righe.length} {prev.righe.length === 1 ? 'prestazione' : 'prestazioni'} · prestazioni sanitarie esenti IVA
                    {!prev.scontoApplicato && <> · <strong>aggiungi un altro servizio per il {SCONTO_PERC}% di sconto</strong></>}
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '9px 11px', marginTop: '12px', lineHeight: 1.5 }}>
                  ⚠️ <strong>Tariffe indicative.</strong> L'importo può subire variazioni in base alle condizioni domiciliari e assistenziali specifiche (distanza, orari, materiali, urgenza): la tariffa definitiva viene confermata dopo il contatto, senza impegno.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                  <a href={testoWhatsApp()} target="_blank" rel="noopener" style={btnWa}><MessageCircle size={17} /> Invia su WhatsApp</a>
                  <a href={`tel:${TELEFONO}`} style={btnTel}><Phone size={17} /> Telefona</a>
                </div>
                <button type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ marginTop: '8px', width: '100%', padding: '10px', border: '1px solid #1e4d8c', borderRadius: '10px', background: '#fff', color: '#1e4d8c', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}>
                  <Send size={15} /> Oppure compila il modulo
                </button>
              </>
            )}
            {!prev && !previewLoading && !previewError && (
              <div style={{ textAlign: 'center', padding: '26px 10px', color: '#94a3b8' }}>
                <Calculator size={34} color="#93c5fd" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: '0.88rem', margin: 0, lineHeight: 1.55 }}>
                  Nessun preventivo ancora.<br />
                  Aggiungi le prestazioni e premi <strong style={{ color: '#1e4d8c' }}>«Genera preventivo»</strong>:<br />
                  se modifichi qualcosa dovrai rigenerarlo.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modulo richiesta */}
        <div ref={formRef} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #dbeafe', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: '26px', marginTop: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#1e293b', margin: '0 0 6px' }}>
            <Send size={20} color="#1e4d8c" /> Richiedi appuntamento o maggiori informazioni
          </h2>
          <p style={{ color: '#475569', fontSize: '0.9rem', margin: '0 0 6px', lineHeight: 1.55 }}>
            <strong>Siamo a tua disposizione.</strong> Compila il modulo: verifichiamo la disponibilità del personale nella tua zona e ti confermiamo la tariffa calcolata — <strong>senza impegno</strong>.
          </p>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 18px' }}>
            Inviando il modulo registreremo il tuo preventivo e ti ricontatteremo noi. Preferisci parlare subito? <a href={`tel:${TELEFONO}`} style={{ color: '#1e4d8c', fontWeight: 700 }}>Chiama {TELEFONO_LABEL}</a> o <a href={testoWhatsApp()} target="_blank" rel="noopener" style={{ color: '#16a34a', fontWeight: 700 }}>scrivici su WhatsApp</a>.
          </p>
          <form onSubmit={inviaRichiesta}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '14px' }}>
              <div>
                <span style={label}>Nome e cognome *</span>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Mario Rossi" required style={input} />
              </div>
              <div>
                <span style={label}>Telefono *</span>
                <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="333 1234567" required style={input} />
              </div>
              <div>
                <span style={label}>Email</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mario@email.it" style={input} />
              </div>
            </div>
            <div style={{ marginTop: '14px' }}>
              <span style={label}>Messaggio</span>
              <textarea value={messaggio} onChange={e => setMessaggio(e.target.value)} rows={3} placeholder="Raccontaci le tue esigenze, zona, quando vuoi essere ricontattato..." style={{ ...input, resize: 'vertical' }} />
            </div>
            {sendError && <p style={{ color: '#dc2626', fontSize: '0.88rem', margin: '10px 0 0' }}>{sendError}</p>}
            <button type="submit" disabled={sending}
              style={{ marginTop: '18px', width: '100%', padding: '14px', border: 'none', borderRadius: '10px', background: sending ? '#93c5fd' : 'linear-gradient(135deg,#1e3a8a,#1e4d8c)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: sending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Send size={18} /> {sending ? 'Invio in corso...' : 'Invia richiesta con il tuo preventivo'}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
              <a href={testoWhatsApp()} target="_blank" rel="noopener" style={btnWa}><MessageCircle size={17} /> Invia su WhatsApp</a>
              <a href={`tel:${TELEFONO}`} style={btnTel}><Phone size={17} /> Telefona {TELEFONO_LABEL}</a>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '26px' }}>
          Abbraccio Cure Domiciliari S.R.L.S. · Via di S. Maria Ausiliatrice 4/B, Roma · {TELEFONO_LABEL} · Prestazioni sanitarie a domicilio a Roma e provincia
        </p>
      </main>
      <style>{`@media (max-width: 640px) { .landing-hide-mobile { display: none; } }`}</style>
    </div>
  );
}

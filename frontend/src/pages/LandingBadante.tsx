import { useEffect, useRef, useState, FormEvent } from 'react';
import axios from 'axios';
import { Calculator, CheckCircle, Send, Euro, FileText, Users, Info, Phone, MessageCircle } from 'lucide-react';
import { TornaAlSito } from '../components/TornaAlSito';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.abbracciocuredomiciliari.it/api';
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '';
const CAF_QUOTA = 50; // quota fissa CAF sanitario sulla landing pubblica (non modificabile)
const TELEFONO = '0601905242';
const TELEFONO_LABEL = '06 01905242';
const WHATSAPP = '393514175117';

const CONTRATTI: { value: string; label: string; livelli: string[]; ore: boolean }[] = [
  { value: 'non_convivente', label: 'Non convivente (a ore)', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'], ore: true },
  { value: 'convivente', label: 'Convivente full-time', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'], ore: false },
  { value: 'convivente_part_time', label: 'Convivente part-time (30 ore)', livelli: ['B', 'BS', 'C'], ore: false },
  { value: 'assistenza_notturna', label: 'Convivente — assistenza notturna', livelli: ['BS', 'CS', 'DS'], ore: false },
  { value: 'presenza_notturna', label: 'Convivente — presenza notturna', livelli: [], ore: false },
  { value: 'sostituzione', label: 'Sostituzione (giorni di riposo)', livelli: ['CS', 'DS'], ore: true },
];

// Livelli CCNL lavoro domestico: indicano le MANSIONI, non la convivenza
// (la convivenza la decide il tipo di contratto). Fonte: CCNL art. 16.
const LIVELLI_DESC: Record<string, string> = {
  A: 'Colf/pulizie e mansioni domestiche — senza assistenza alla persona',
  AS: 'Assistenza a persone autosufficienti — anche babysitter oltre 6 anni',
  B: 'Assistenza a persone autosufficienti e collaborazione in casa',
  BS: 'Assistenza a persone non autosufficienti — anche babysitter sotto 6 anni',
  C: 'Mansioni qualificate senza assistenza (custode, autista, cameriere)',
  CS: 'Assistenza a non autosufficienti con formazione — badante qualificata',
  D: 'Direttore di casa / amministratore — profilo direttivo, non badante',
  DS: 'Assistenza a non autosufficienti con diploma — badante specializzata',
};

// Legenda completa delle categorie CCNL per aiutare la scelta nel preventivo
const LEGENDA_LIVELLI: Record<string, { titolo: string; desc: string; colore: string }> = {
  A:  { titolo: 'Operatore generico', desc: 'Pulizie, stiro, compagnia e piccoli aiuti a persone autosufficienti. Nessuna assistenza alla persona.', colore: '#64748b' },
  AS: { titolo: 'Operatore generico qualificato', desc: 'Come il livello A ma con qualifica o maggiore esperienza; può anche seguire bambini sopra i 6 anni.', colore: '#64748b' },
  B:  { titolo: 'Assistente a persona autosufficiente', desc: 'Badante/colf per anziani autosufficienti: compagnia, preparazione pasti, gestione della casa. Tra i livelli più usati per la badante.', colore: '#0369a1' },
  BS: { titolo: 'Assistente a persona non autosufficiente', desc: 'Assistenza a persone non autosufficienti senza formazione specifica, babysitter di bambini sotto i 6 anni o cuoco di famiglia.', colore: '#0369a1' },
  C:  { titolo: 'Mansioni qualificate senza assistenza', desc: 'Custode con formazione, cameriere personale, autista, operaio qualificato: il livello C non copre l\'assistenza alla persona.', colore: '#c2410c' },
  CS: { titolo: 'Assistente non autosufficienti qualificato', desc: 'Assistenza a persone non autosufficienti con formazione specifica: demenze, patologie complesse, uso di ausili. La badante qualificata per casi impegnativi.', colore: '#c2410c' },
  D:  { titolo: 'Direttore di casa / amministratore', desc: 'Coordina il personale domestico e i beni di famiglia: profilo direttivo, non è un livello da badante.', colore: '#7c3aed' },
  DS: { titolo: 'Badante specializzata (diplomata)', desc: 'Assistenza a persone non autosufficienti con diploma o certificazione professionale: il livello più alto per i casi più complessi.', colore: '#7c3aed' },
};

interface Simulazione {
  contrattoLabel: string;
  livelloLabel: string;
  oreSettimanali: number;
  oreMensili: number;
  retribuzioneLordaMensile: number;
  retribuzioneNetta: number;
  contribInpsDatoreMensili: number;
  cassaColfDatoreMensili: number;
  tfr: number;
  tredicesima: number;
  totaleCostoMensile: number;
  ferieMensiliOre: number;
  cafMensile: number;
}

declare global {
  interface Window { fbq?: (...args: any[]) => void; }
}

function tracciaPixel(evento: string, dati?: Record<string, any>) {
  try {
    if (window.fbq) window.fbq('track', evento, dati);
  } catch { /* pixel non disponibile */ }
}

// Icona "i" accanto alle voci del calcolatore: al tocco mostra la spiegazione
// (funziona anche su mobile, dove il tooltip del title non si vede).
function InfoNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        title={text}
        aria-label="Cosa significa questa voce"
        style={{ border: 'none', background: 'none', padding: '0 0 0 6px', cursor: 'pointer', color: '#0284c7', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      >
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

export default function LandingBadante() {
  const [contrattoTipo, setContrattoTipo] = useState('non_convivente');
  const [livello, setLivello] = useState('B');
  const [oreSettimanali, setOreSettimanali] = useState('24');
  const [tempoDeterminato, setTempoDeterminato] = useState(false);
  const [piuAutosuff, setPiuAutosuff] = useState(false);
  const [certificazioneUni, setCertificazioneUni] = useState(false);
  const [babysitter, setBabysitter] = useState(false);
  const [escludiTfr, setEscludiTfr] = useState(false);
  const [showLegenda, setShowLegenda] = useState(false);

  const [sim, setSim] = useState<Simulazione | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');

  const utmRef = useRef<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement | null>(null);

  const contratto = CONTRATTI.find(c => c.value === contrattoTipo) || CONTRATTI[0];
  const livelliDisponibili = contratto.livelli;

  // Se il livello selezionato non e' valido per il nuovo contratto, correggilo
  useEffect(() => {
    if (livelliDisponibili.length > 0 && !livelliDisponibili.includes(livello)) {
      setLivello(livelliDisponibili[0]);
    }
  }, [contrattoTipo]);

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
        f.queue = [];
        f.loaded = true;
        f.version = '2.0';
        w.fbq = f;
        w._fbq = f;
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(s);
        window.fbq!('init', META_PIXEL_ID);
      } catch { /* ignorato */ }
    }
    tracciaPixel('PageView');
    // Link diretto al modulo contatti (?modulo=1): scroll alla sezione richiesta
    if (params.get('modulo')) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    }
  }, []);

  const simBody = () => ({
    contrattoTipo,
    livello: livelliDisponibili.length > 0 ? livello : undefined,
    oreSettimanali: contratto.ore ? Number(oreSettimanali) : undefined,
    tempoDeterminato,
    indennitaPiuAutosuff: piuAutosuff,
    certificazioneUni,
    indennitaBabysitter: babysitter,
    cafMensile: CAF_QUOTA,
    escludiTfrTredicesima: escludiTfr,
  });

  // ─── Calcolo preventivo — solo su richiesta con "Genera preventivo" ─────────
  // Qualunque modifica ai parametri azzera il risultato: il preventivo mostrato
  // corrisponde sempre esattamente ai parametri attuali.
  const invalida = () => setSim(null);

  async function genera() {
    try {
      setPreviewLoading(true);
      setPreviewError('');
      const res = await axios.post(`${API_BASE}/landing-badante/preview`, simBody());
      setSim(res.data);
      tracciaPixel('ViewContent', { content_name: 'Preventivo badante generato' });
    } catch (err: any) {
      setSim(null);
      setPreviewError(err?.response?.data?.message || 'Controlla i dati inseriti');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function inviaRichiesta(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !telefono.trim()) {
      setSendError('Inserisci nome e numero di telefono.');
      return;
    }
    if (!sim) {
      setSendError('Genera prima il preventivo con il pulsante "Genera preventivo".');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      setSending(true);
      setSendError('');
      await axios.post(`${API_BASE}/landing-badante/richiesta`, {
        nome: nome.trim(),
        telefono: telefono.trim(),
        email: email.trim() || undefined,
        messaggio: messaggio.trim() || undefined,
        ...simBody(),
        utm: utmRef.current,
      });
      setSent(true);
      tracciaPixel('Lead', { content_name: 'Preventivo badante' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setSendError(err?.response?.data?.message || 'Errore nell\'invio. Riprova.');
    } finally {
      setSending(false);
    }
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '11px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const label: React.CSSProperties = {
    display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '5px',
  };
  const euro = (n: number) => `€ ${Number(n || 0).toFixed(2)}`;
  const check: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569', fontWeight: 600 };
  const btnWa: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', background: '#25d366', color: '#fff', fontWeight: 800, textDecoration: 'none', fontSize: '0.95rem' };
  const btnTel: React.CSSProperties = { ...btnWa, background: '#1e4d8c' };

  // Testo del preventivo da condividere su WhatsApp (richiesta + eventuale messaggio)
  const totaleAttuale = sim ? sim.totaleCostoMensile + sim.cafMensile - (escludiTfr ? sim.tfr + sim.tredicesima : 0) : 0;
  const testoWhatsApp = () => {
    const intro = nome.trim() ? `Buongiorno, sono ${nome.trim()}.` : 'Buongiorno,';
    const corpo = sim
      ? `${intro} ho calcolato questo preventivo sul vostro sito:\n• ${sim.contrattoLabel} — livello ${sim.livelloLabel}, ${sim.oreSettimanali}h/sett\n• Costo mensile famiglia: ${euro(totaleAttuale)}/mese (${escludiTfr ? 'TFR e 13ª esclusi' : 'TFR e 13ª inclusi'}, CAF sanitario ${euro(sim.cafMensile)})\n• Netto lavoratore: ${euro(sim.retribuzioneNetta)}/mese\n\nVorrei sapere se avete disponibilità di una badante nella mia zona e confermare la tariffa, senza impegno.${messaggio.trim() ? `\n\nMessaggio: ${messaggio.trim()}` : ''}`
      : `${intro} vorrei informazioni sul servizio di intermediazione badanti e colf e un preventivo.${messaggio.trim() ? `\n\nMessaggio: ${messaggio.trim()}` : ''}`;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(corpo)}`;
  };

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fff7ed,#ffffff 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '44px 36px', maxWidth: '520px', textAlign: 'center', border: '1px solid #ffedd5' }}>
          <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 16px' }} />
          <h1 style={{ color: '#1e293b', fontSize: '1.5rem', margin: '0 0 10px' }}>Richiesta inviata!</h1>
          <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 14px' }}>
            Grazie <strong>{nome.split(' ')[0]}</strong>, ti ricontatteremo al più presto al numero <strong>{telefono}</strong>.
          </p>
          {sim && (
            <p style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px', color: '#9a3412', fontSize: '0.9rem' }}>
              Il tuo preventivo di <strong>{euro(sim.totaleCostoMensile + sim.cafMensile - (escludiTfr ? sim.tfr + sim.tredicesima : 0))}/mese</strong> è stato registrato.
            </p>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '18px' }}>
            <a href={testoWhatsApp()} target="_blank" rel="noopener" style={btnWa}><MessageCircle size={18} /> Scrivici su WhatsApp</a>
            <a href={`tel:${TELEFONO}`} style={btnTel}><Phone size={18} /> Chiama {TELEFONO_LABEL}</a>
          </div>
          <div style={{ marginTop: '16px' }}><TornaAlSito color="#c2410c" /></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fff7ed,#ffffff 55%)', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #ffedd5', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TornaAlSito color="#c2410c" />
          <div style={{ background: '#c2410c', borderRadius: '10px', padding: '8px', display: 'flex' }}>
            <Users size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', lineHeight: 1.1 }}>Abbraccio Cure Domiciliari</div>
            <div style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 600 }}>Badanti · Colf · Assistenti Familiari</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a href={`tel:${TELEFONO}`} style={{ ...btnTel, padding: '8px 12px', fontSize: '0.82rem' }}><Phone size={15} /> <span className="landing-hide-mobile">{TELEFONO_LABEL}</span></a>
            <a href={testoWhatsApp()} target="_blank" rel="noopener" style={{ ...btnWa, padding: '8px 12px', fontSize: '0.82rem' }}><MessageCircle size={15} /> <span className="landing-hide-mobile">WhatsApp</span></a>
            <div className="landing-hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f6f9ff', border: '1px solid #dfe9fb', borderRadius: '10px', padding: '6px 12px' }}>
              <span style={{ fontSize: '0.66rem', color: '#64748b', lineHeight: 1.25, textAlign: 'right' }}>
                in collaborazione con<br /><strong style={{ color: '#1e40af', fontSize: '0.7rem' }}>Salus Group</strong>
              </span>
              <img src="/images/logo-salus.png" alt="Salus Group" style={{ height: '34px', width: 'auto', display: 'block' }} />
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '28px 16px 48px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ background: '#ffedd5', color: '#9a3412', padding: '6px 14px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
            Preventivo online gratuito
          </span>
          <h1 style={{ color: '#1e293b', fontSize: 'clamp(1.5rem,4vw,2.2rem)', margin: '14px 0 8px', fontWeight: 800 }}>
            Calcola il costo mensile della tua badante o colf
          </h1>
          <p style={{ color: '#64748b', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
            Simulazione completa sui minimi CCNL 2026: retribuzione, contributi INPS, Cassa.Colf, TFR e tredicesima. In 2 minuti sai quanto costa davvero.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: '#fff', border: '1px solid #dfe9fb', borderRadius: '14px', padding: '10px 18px', marginTop: '18px', boxShadow: '0 2px 10px rgba(16,42,80,.06)' }}>
            <img src="/images/logo-salus.png" alt="Salus Group - Divisione Datoriale Casimpresa" style={{ height: '42px', width: 'auto', display: 'block' }} />
            <span style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45, textAlign: 'left' }}>
              <strong style={{ color: '#1e40af', display: 'block', fontSize: '0.85rem' }}>Servizio in partnership con Salus Group</strong>
              Divisione Datoriale Casimpresa — selezione di personale domestico qualificato e referenziato.
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '20px', alignItems: 'start' }}>
          {/* Calcolatore */}
          <div style={{ background: 'linear-gradient(165deg,#fff7ed 0%,#ffffff 55%)', borderRadius: '16px', border: '1px solid #fdba74', boxShadow: '0 8px 24px rgba(194,65,12,.10)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#c2410c,#ea580c)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calculator size={20} color="#fff" />
              <div>
                <h2 style={{ fontSize: '1.05rem', color: '#fff', margin: 0, fontWeight: 800 }}>Calcolatore CCNL</h2>
                <div style={{ fontSize: '0.72rem', color: '#ffedd5' }}>tariffe minime Contratto Collettivo Nazionale 2026</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '14px', padding: '22px 24px 24px' }}>
              <div>
                <span style={label}>Tipo di contratto <InfoNote text="La forma del rapporto di lavoro: a ore (non convivente), convivente full-time o part-time, assistenza o presenza notturna, oppure sostituzione nei giorni di riposo della badante principale." /></span>
                <select value={contrattoTipo} onChange={e => { setContrattoTipo(e.target.value); invalida(); }} style={input}>
                  {CONTRATTI.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {livelliDisponibili.length > 0 && (
                <div>
                  <span style={label}>Livello CCNL <InfoNote text="Il livello stabilisce le mansioni e la paga minima secondo il CCNL — la convivenza la decide il tipo di contratto, non il livello. Per la badante: B/BS per assistenza ad autosufficienti o non autosufficienti senza formazione, CS/DS per non autosufficienti con formazione o diploma." /></span>
                  <select value={livello} onChange={e => { setLivello(e.target.value); invalida(); }} style={input}>
                    {livelliDisponibili.map(l => <option key={l} value={l}>{l} — {LIVELLI_DESC[l]}</option>)}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{LIVELLI_DESC[livello]}</span>
                  <button type="button" onClick={() => setShowLegenda(o => !o)}
                    style={{ marginTop: '6px', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#c2410c', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Info size={14} /> {showLegenda ? 'Nascondi la legenda delle categorie' : 'Come scegliere? Legenda delle categorie CCNL'}
                  </button>
                  {showLegenda && (
                    <div style={{ marginTop: '8px', background: '#fff', border: '1px solid #fed7aa', borderRadius: '10px', overflow: 'hidden' }}>
                      {livelliDisponibili.map(l => {
                        const item = LEGENDA_LIVELLI[l];
                        const attivo = l === livello;
                        return (
                          <button key={l} type="button" onClick={() => { setLivello(l); invalida(); }}
                            style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #fff7ed', padding: '9px 12px', cursor: 'pointer', background: attivo ? '#ffedd5' : '#fff', fontFamily: 'inherit' }}>
                            <span style={{ flexShrink: 0, background: item.colore, color: '#fff', fontWeight: 800, fontSize: '0.72rem', borderRadius: '6px', padding: '3px 7px', minWidth: '28px', textAlign: 'center', marginTop: '1px' }}>{l}</span>
                            <span>
                              <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                                {item.titolo} {attivo && <span style={{ color: '#c2410c' }}>· selezionato</span>}
                              </span>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>{item.desc}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {contratto.ore && (
                <div>
                  <span style={label}>Ore settimanali <InfoNote text="Le ore di lavoro settimanali concordate: determinano la paga mensile, i contributi e gli accantonamenti." /></span>
                  <input type="number" min="1" max="40" value={oreSettimanali} onChange={e => { setOreSettimanali(e.target.value); invalida(); }} style={input} />
                </div>
              )}

              <div style={{ display: 'grid', gap: '8px', background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '12px 14px' }}>
                {contrattoTipo !== 'sostituzione' && (
                  <label style={check}>
                    <input type="checkbox" checked={tempoDeterminato} onChange={e => { setTempoDeterminato(e.target.checked); invalida(); }} style={{ width: '16px', height: '16px', accentColor: '#ea580c' }} />
                    Contratto a tempo determinato (+ contributi)
                    <InfoNote text="I contratti a tempo determinato prevedono un'aliquota contributiva INPS leggermente maggiorata." />
                  </label>
                )}
                {(livello === 'CS' || livello === 'DS') && contrattoTipo !== 'sostituzione' && (
                  <label style={check}>
                    <input type="checkbox" checked={piuAutosuff} onChange={e => { setPiuAutosuff(e.target.checked); invalida(); }} style={{ width: '16px', height: '16px', accentColor: '#ea580c' }} />
                    Più persone non autosufficienti (indennità)
                    <InfoNote text="Indennità prevista dal CCNL quando il lavoratore assiste più di una persona non autosufficiente nella stessa abitazione." />
                  </label>
                )}
                {['B', 'BS', 'CS'].includes(livello) && (
                  <label style={check}>
                    <input type="checkbox" checked={certificazioneUni} onChange={e => { setCertificazioneUni(e.target.checked); invalida(); }} style={{ width: '16px', height: '16px', accentColor: '#ea580c' }} />
                    Certificazione UNI 11766
                    <InfoNote text="Maggiorazione prevista per il personale in possesso della certificazione UNI 11766 sulla qualità delle prestazioni socio-assistenziali." />
                  </label>
                )}
                {livello === 'BS' && contrattoTipo !== 'sostituzione' && (
                  <label style={check}>
                    <input type="checkbox" checked={babysitter} onChange={e => { setBabysitter(e.target.checked); invalida(); }} style={{ width: '16px', height: '16px', accentColor: '#ea580c' }} />
                    Babysitter bambini &lt; 6 anni
                    <InfoNote text="Indennità aggiuntiva se la badante di livello BS accudisce anche bambini sotto i 6 anni." />
                  </label>
                )}
              </div>

              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0c4a6e' }}>
                  Gestione CAF sanitario inclusa
                  <InfoNote text="Quota mensile fissa: comprende pratiche di assunzione, comunicazioni obbligatorie, elaborazione delle buste paga e assistenza fiscale. Ci pensiamo noi." />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <span style={{ background: '#fff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '7px 12px', fontWeight: 700, color: '#0c4a6e' }}>€ {CAF_QUOTA.toFixed(2)}/mese</span>
                  <span style={{ fontSize: '0.78rem', color: '#0369a1' }}>pratiche amministrative e assistenza fiscale</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginTop: '10px' }}>
                  <input type="checkbox" checked={escludiTfr} onChange={e => { setEscludiTfr(e.target.checked); invalida(); }} style={{ width: '16px', height: '16px', accentColor: '#ea580c' }} />
                  Escludi TFR e tredicesima dal preventivo
                  <InfoNote text="Spunta per vedere il preventivo senza gli accantonamenti mensili di TFR e tredicesima. Restano comunque dovuti per legge e saranno stabiliti nel contratto." />
                </label>
              </div>

              <button type="button" onClick={genera} disabled={previewLoading}
                style={{ marginTop: '4px', width: '100%', padding: '14px', border: 'none', borderRadius: '10px', background: previewLoading ? '#fdba74' : 'linear-gradient(135deg,#c2410c,#ea580c)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: previewLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(234,88,12,.30)' }}>
                <Calculator size={18} /> {previewLoading ? 'Calcolo in corso...' : sim ? 'Rigenera preventivo' : 'Genera preventivo'}
              </button>
            </div>
          </div>

          {/* Preventivo */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #ffedd5', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: '24px', position: 'sticky', top: '80px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', color: '#1e293b', margin: '0 0 14px' }}>
              <FileText size={20} color="#c2410c" /> Il tuo preventivo
            </h2>
            {previewLoading && <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>⏳ Calcolo in corso...</p>}
            {previewError && <p style={{ color: '#dc2626', fontSize: '0.88rem' }}>{previewError}</p>}
            {sim && !previewError && (
              <>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px' }}>
                  {sim.contrattoLabel} · {sim.livelloLabel} · {sim.oreSettimanali}h/sett ({sim.oreMensili}h/mese)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <tbody>
                    {[
                      ['Retribuzione lorda mensile', sim.retribuzioneLordaMensile],
                      ['Contributi INPS (datore)', sim.contribInpsDatoreMensili],
                      ['Cassa.Colf (datore)', sim.cassaColfDatoreMensili],
                      ...(!escludiTfr ? [['Accantonamento TFR', sim.tfr], ['Accantonamento 13esima', sim.tredicesima]] : []),
                    ].map(([l, v], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 6px 8px 0', color: '#475569' }}>{l}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{euro(v as number)}</td>
                      </tr>
                    ))}
                    {sim.cafMensile > 0 && (
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 6px 8px 0', color: '#475569' }}>
                          Gestione CAF sanitario
                          <span style={{ display: 'inline-block', marginLeft: '6px', background: '#e0f2fe', color: '#0369a1', fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '999px' }}>CAF</span>
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{euro(sim.cafMensile)}</td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px 8px 0', color: '#16a34a', fontWeight: 600 }}>Netto in busta al lavoratore</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#16a34a', whiteSpace: 'nowrap' }}>{euro(sim.retribuzioneNetta)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ background: 'linear-gradient(135deg,#c2410c,#ea580c)', borderRadius: '12px', padding: '16px 18px', marginTop: '14px', color: '#fff' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9 }}>COSTO MENSILE TOTALE A CARICO FAMIGLIA</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}>
                    {euro(sim.totaleCostoMensile + sim.cafMensile - (escludiTfr ? sim.tfr + sim.tredicesima : 0))}<span style={{ fontSize: '0.9rem', fontWeight: 600 }}>/mese</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>{escludiTfr ? 'TFR e tredicesima saranno stabiliti nel contratto' : 'TFR e tredicesima inclusi come accantonamento mensile'} · ferie ≈ {(Math.round(sim.ferieMensiliOre * 10) / 10).toLocaleString('it-IT')}h/mese</div>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '9px 11px', marginTop: '12px', lineHeight: 1.5 }}>
                  ⚠️ <strong>Tariffe indicative.</strong> L'importo può subire variazioni in base alle condizioni domiciliari e assistenziali specifiche: la tariffa definitiva viene confermata dopo il colloquio conoscitivo, senza impegno.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                  <a href={testoWhatsApp()} target="_blank" rel="noopener" style={btnWa}><MessageCircle size={17} /> Invia su WhatsApp</a>
                  <a href={`tel:${TELEFONO}`} style={btnTel}><Phone size={17} /> Telefona</a>
                </div>
              </>
            )}
            {!sim && !previewLoading && !previewError && (
              <div style={{ textAlign: 'center', padding: '26px 10px', color: '#94a3b8' }}>
                <Calculator size={34} color="#fdba74" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: '0.88rem', margin: 0, lineHeight: 1.55 }}>
                  Nessun preventivo ancora.<br />
                  Imposta i parametri e premi <strong style={{ color: '#c2410c' }}>«Genera preventivo»</strong>:<br />
                  se modifichi qualcosa dovrai rigenerarlo.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modulo richiesta */}
        <div ref={formRef} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #ffedd5', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: '26px', marginTop: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#1e293b', margin: '0 0 6px' }}>
            <Send size={20} color="#c2410c" /> Richiedi appuntamento o maggiori informazioni
          </h2>
          <p style={{ color: '#475569', fontSize: '0.9rem', margin: '0 0 6px', lineHeight: 1.55 }}>
            <strong>Siamo a tua disposizione.</strong> Compila il modulo: verifichiamo la disponibilità di una lavoratrice o un lavoratore nella tua zona e ti confermiamo la tariffa calcolata — <strong>senza impegno</strong>.
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
              <textarea value={messaggio} onChange={e => setMessaggio(e.target.value)} rows={3} placeholder="Raccontaci le tue esigenze, quando vuoi essere ricontattato..." style={{ ...input, resize: 'vertical' }} />
            </div>
            {sendError && <p style={{ color: '#dc2626', fontSize: '0.88rem', margin: '10px 0 0' }}>{sendError}</p>}
            <button type="submit" disabled={sending}
              style={{
                marginTop: '18px', width: '100%', padding: '14px', border: 'none', borderRadius: '10px',
                background: sending ? '#fdba74' : 'linear-gradient(135deg,#c2410c,#ea580c)', color: '#fff',
                fontWeight: 800, fontSize: '1rem', cursor: sending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
              <Euro size={18} /> {sending ? 'Invio in corso...' : 'Invia richiesta con il tuo preventivo'}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
              <a href={testoWhatsApp()} target="_blank" rel="noopener" style={btnWa}><MessageCircle size={17} /> Invia su WhatsApp</a>
              <a href={`tel:${TELEFONO}`} style={btnTel}><Phone size={17} /> Telefona {TELEFONO_LABEL}</a>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '26px' }}>
          Abbraccio Cure Domiciliari · Via di S. Maria Ausiliatrice 4/B, Roma · 06 01905242 · In partnership con <strong>Salus Group</strong> — Divisione Datoriale Casimpresa
        </p>
      </main>
      <style>{`@media (max-width: 640px) { .landing-hide-mobile { display: none !important; } }`}</style>
    </div>
  );
}

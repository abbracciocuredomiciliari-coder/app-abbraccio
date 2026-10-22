import { useEffect, useRef, useState, FormEvent } from 'react';
import axios from 'axios';
import { Calculator, CheckCircle, Send, Euro, FileText, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.abbracciocuredomiciliari.it/api';
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '';
const CAF_DEFAULT = '50';

const CONTRATTI: { value: string; label: string; livelli: string[]; ore: boolean }[] = [
  { value: 'non_convivente', label: 'Non convivente (a ore)', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'], ore: true },
  { value: 'convivente', label: 'Convivente full-time', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'], ore: false },
  { value: 'convivente_part_time', label: 'Convivente part-time (30 ore)', livelli: ['B', 'BS', 'C'], ore: false },
  { value: 'assistenza_notturna', label: 'Convivente — assistenza notturna', livelli: ['BS', 'CS', 'DS'], ore: false },
  { value: 'presenza_notturna', label: 'Convivente — presenza notturna', livelli: [], ore: false },
  { value: 'sostituzione', label: 'Sostituzione (giorni di riposo)', livelli: ['CS', 'DS'], ore: true },
];

const LIVELLI_DESC: Record<string, string> = {
  A: 'Operatore base: assistenza minima e piccoli compiti domestici',
  AS: 'Operatore base super: base con qualifica/anzianità superiore',
  B: 'Badante/colf convivente: assistenza giornaliera in convivenza',
  BS: 'Badante convivente super: maggiore autonomia e qualifica',
  C: 'Badante non convivente: assistenza a non autosufficienti',
  CS: 'Badante non convivente super: profilo specializzato',
  D: 'Operatore specializzato: assistenza notturna, turni o profili complessi',
  DS: 'Operatore super specializzato: coordinamento o massima qualifica',
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

export default function LandingBadante() {
  const [contrattoTipo, setContrattoTipo] = useState('non_convivente');
  const [livello, setLivello] = useState('B');
  const [oreSettimanali, setOreSettimanali] = useState('24');
  const [tempoDeterminato, setTempoDeterminato] = useState(false);
  const [piuAutosuff, setPiuAutosuff] = useState(false);
  const [certificazioneUni, setCertificazioneUni] = useState(false);
  const [babysitter, setBabysitter] = useState(false);
  const [includiCaf, setIncludiCaf] = useState(true);
  const [cafImporto, setCafImporto] = useState(CAF_DEFAULT);

  const [sim, setSim] = useState<Simulazione | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');

  const utmRef = useRef<Record<string, string>>({});

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
  }, []);

  const simBody = () => ({
    contrattoTipo,
    livello: livelliDisponibili.length > 0 ? livello : undefined,
    oreSettimanali: contratto.ore ? Number(oreSettimanali) : undefined,
    tempoDeterminato,
    indennitaPiuAutosuff: piuAutosuff,
    certificazioneUni,
    indennitaBabysitter: babysitter,
    cafMensile: includiCaf ? (Number(cafImporto) >= 0 ? Number(cafImporto) : 50) : 0,
  });

  // ─── Calcolo preventivo live (debounce) — stesso motore del gestionale ──────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        setPreviewError('');
        const res = await axios.post(`${API_BASE}/landing-badante/preview`, simBody());
        setSim(res.data);
      } catch (err: any) {
        setSim(null);
        setPreviewError(err?.response?.data?.message || 'Controlla i dati inseriti');
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [contrattoTipo, livello, oreSettimanali, tempoDeterminato, piuAutosuff, certificazioneUni, babysitter, includiCaf, cafImporto]);

  async function inviaRichiesta(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !telefono.trim()) {
      setSendError('Inserisci nome e numero di telefono.');
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
              Il tuo preventivo di <strong>{euro(sim.totaleCostoMensile + sim.cafMensile)}/mese</strong> è stato registrato.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fff7ed,#ffffff 55%)', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #ffedd5', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: '#c2410c', borderRadius: '10px', padding: '8px', display: 'flex' }}>
            <Users size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', lineHeight: 1.1 }}>Abbraccio Cure Domiciliari</div>
            <div style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 600 }}>Badanti · Colf · Assistenti Familiari</div>
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
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '20px', alignItems: 'start' }}>
          {/* Calcolatore */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #ffedd5', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: '24px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', color: '#1e293b', margin: '0 0 18px' }}>
              <Calculator size={20} color="#c2410c" /> Calcolatore CCNL
            </h2>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <span style={label}>Tipo di contratto</span>
                <select value={contrattoTipo} onChange={e => setContrattoTipo(e.target.value)} style={input}>
                  {CONTRATTI.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {livelliDisponibili.length > 0 && (
                <div>
                  <span style={label}>Livello CCNL</span>
                  <select value={livello} onChange={e => setLivello(e.target.value)} style={input}>
                    {livelliDisponibili.map(l => <option key={l} value={l}>{l} — {LIVELLI_DESC[l]}</option>)}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{LIVELLI_DESC[livello]}</span>
                </div>
              )}

              {contratto.ore && (
                <div>
                  <span style={label}>Ore settimanali</span>
                  <input type="number" min="1" max="40" value={oreSettimanali} onChange={e => setOreSettimanali(e.target.value)} style={input} />
                </div>
              )}

              <div style={{ display: 'grid', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                {contrattoTipo !== 'sostituzione' && (
                  <label style={check}>
                    <input type="checkbox" checked={tempoDeterminato} onChange={e => setTempoDeterminato(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    Contratto a tempo determinato (+ contributi)
                  </label>
                )}
                {(livello === 'CS' || livello === 'DS') && contrattoTipo !== 'sostituzione' && (
                  <label style={check}>
                    <input type="checkbox" checked={piuAutosuff} onChange={e => setPiuAutosuff(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    Più persone non autosufficienti (indennità)
                  </label>
                )}
                {['B', 'BS', 'CS'].includes(livello) && (
                  <label style={check}>
                    <input type="checkbox" checked={certificazioneUni} onChange={e => setCertificazioneUni(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    Certificazione UNI 11766
                  </label>
                )}
                {livello === 'BS' && contrattoTipo !== 'sostituzione' && (
                  <label style={check}>
                    <input type="checkbox" checked={babysitter} onChange={e => setBabysitter(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    Babysitter bambini &lt; 6 anni
                  </label>
                )}
              </div>

              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px 14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#0c4a6e' }}>
                  <input type="checkbox" checked={includiCaf} onChange={e => setIncludiCaf(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                  Gestione CAF sanitario
                </label>
                {includiCaf && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <input type="number" min="0" value={cafImporto} onChange={e => setCafImporto(e.target.value)}
                      style={{ ...input, width: '100px', padding: '7px 10px' }} />
                    <span style={{ fontSize: '0.78rem', color: '#0369a1' }}>€/mese — pratiche amministrative e assistenza fiscale</span>
                  </div>
                )}
              </div>
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
                      ['Accantonamento TFR', sim.tfr],
                      ['Accantonamento 13esima', sim.tredicesima],
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
                    {euro(sim.totaleCostoMensile + sim.cafMensile)}<span style={{ fontSize: '0.9rem', fontWeight: 600 }}>/mese</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>TFR e tredicesima saranno stabiliti nel contratto · ferie ≈ {sim.ferieMensiliOre}h/mese</div>
                </div>
              </>
            )}
            {!sim && !previewLoading && !previewError && (
              <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Compila il calcolatore per vedere il preventivo.</p>
            )}
          </div>
        </div>

        {/* Modulo richiesta */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #ffedd5', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: '26px', marginTop: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#1e293b', margin: '0 0 6px' }}>
            <Send size={20} color="#c2410c" /> Richiedi appuntamento o maggiori informazioni
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 18px' }}>
            Inviando il modulo registreremo il tuo preventivo e ti ricontatteremo noi.
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
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '26px' }}>
          Abbraccio Cure Domiciliari · Via di S. Maria Ausiliatrice 4/B, Roma · 06 01905242
        </p>
      </main>
    </div>
  );
}

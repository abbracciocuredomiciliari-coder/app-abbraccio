import { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { Send, X, Mic } from 'lucide-react';

const API = 'https://api.abbracciocuredomiciliari.it/api';

function CuoricinoIcon({ size = 30 }: { size?: number }) {
  return <img src="/abbraccino.jpg" alt="Abbraccino" width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />;
}

interface Props {
  tipo: 'badante' | 'preventivo';
  contesto?: any;
  onSuggerimento?: (s: any) => void;
}

export default function Abbraccino({ tipo, contesto, onSuggerimento }: Props) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<{ who: 'io' | 'bot'; text: string }[]>([
    {
      who: 'bot',
      text: tipo === 'badante'
        ? 'Ciao! Sono Abbraccino 💛 Raccontami la tua situazione — es. "mamma anziana non autosufficiente, serve una badante che abita con lei" — e ti preparo il calcolo del costo!'
        : 'Ciao! Sono Abbraccino 💛 Dimmi cosa serve — es. "devo fare un esame del sangue e una visita medica a domicilio" — e ti aggiungo le prestazioni al preventivo!',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const contestoRef = useRef<any>(contesto);
  contestoRef.current = contesto;

  const SR = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  function toggleMic() {
    if (!SR) return;
    if (listening) { recRef.current?.stop(); return; }
    try {
      const r = new SR();
      r.lang = 'it-IT';
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (e: any) => {
        const t = e.results[0][0].transcript;
        setInput(s => (s ? s + ' ' + t : t));
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recRef.current = r;
      setListening(true);
      r.start();
    } catch { setListening(false); }
  }

  async function invia(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs(m => [...m, { who: 'io', text }]);
    setBusy(true);
    try {
      const res = await axios.post(`${API}/abbraccino/chat`, { messaggio: text, tipo, contesto: contestoRef.current || {} });
      const risposta = String(res.data?.risposta || '');
      setMsgs(m => [...m, { who: 'bot', text: risposta }]);
      if (res.data?.suggerimento && onSuggerimento) {
        onSuggerimento(res.data.suggerimento);
        setMsgs(m => [...m, { who: 'bot', text: '✅ Ho compilato il calcolatore per te: controlla e, se va bene, premi "Calcola" / guarda il totale!' }]);
      }
    } catch {
      setMsgs(m => [...m, { who: 'bot', text: 'Ops, ho qualche difficoltà tecnica. Puoi compilare il calcolatore qui sotto o chiamarci al 06 01905242.' }]);
    } finally { setBusy(false); }
  }

  const pillTop: React.CSSProperties = { background: '#fff', color: 'var(--brand-700)', border: '1.5px solid var(--brand-100)', borderRadius: 999, padding: '5px 12px', fontSize: '0.72rem', fontWeight: 800, boxShadow: '0 3px 10px rgba(0,0,0,.10)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
  const pillBtm: React.CSSProperties = { ...pillTop, background: 'linear-gradient(135deg,var(--nav-900),var(--brand-700))', color: '#fff', border: 'none', padding: '5px 14px' };

  return (
    <>
      <style>{`
        @keyframes abHeartBeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.18)} 28%{transform:scale(1)} 42%{transform:scale(1.18)} 70%{transform:scale(1)} }
        @keyframes abGlow { 0%,100%{box-shadow:0 4px 16px rgba(242,181,42,.3), 0 0 0 0 rgba(242,181,42,.45)} 50%{box-shadow:0 4px 20px rgba(242,181,42,.7), 0 0 0 10px rgba(242,181,42,0)} }
        .ab-fab { animation: abGlow 1.8s ease-in-out infinite; }
        .ab-heart { display:block; animation: abHeartBeat 1.8s ease-in-out infinite; transform-origin:center; }
        /* Su smartphone il lanciatore e' compatto: una sola pill + icona piccola */
        @media (max-width: 640px) {
          .ab-launcher { right: 10px !important; bottom: 8px !important; gap: 4px !important; }
          .ab-pill-top { display: none !important; }
          .ab-fab { width: 46px !important; height: 46px !important; }
          .ab-fab svg { width: 34px !important; height: 34px !important; }
          .ab-pill-btm { font-size: 0.66rem !important; padding: 4px 10px !important; }
        }
      `}</style>

      {/* colonna: etichetta sopra / icona / etichetta sotto — centrata */}
      {!open && (
        <div className="ab-launcher" style={{ position: 'fixed', right: 14, bottom: 6, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <button onClick={() => setOpen(true)} className="ab-pill-top" style={pillTop}>Sono Abbraccino 💛</button>
          <button onClick={() => setOpen(true)} aria-label="Chiedi ad Abbraccino" className="ab-fab"
            style={{ width: 62, height: 62, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5, boxSizing: 'border-box' }}>
            <span className="ab-heart"><CuoricinoIcon size={50} /></span>
          </button>
          <button onClick={() => setOpen(true)} className="ab-pill-btm" style={pillBtm}>Abbraccino Aiutino</button>
        </div>
      )}

      {/* pulsante chiudi */}
      {open && (
        <button onClick={() => setOpen(false)} aria-label="Chiudi"
          style={{ position: 'fixed', bottom: 18, right: 18, width: 62, height: 62, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,var(--nav-900),var(--brand-700))', color: '#fff', cursor: 'pointer', boxShadow: '0 6px 22px rgba(28,113,100,.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={26} />
        </button>
      )}

      {open && (
        <div style={{ position: 'fixed', bottom: 90, right: 14, width: 'min(360px, calc(100vw - 28px))', maxHeight: '70vh', background: '#fff', borderRadius: 18, boxShadow: '0 10px 40px rgba(0,0,0,.22)', zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--brand-100)', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
          <div style={{ background: 'linear-gradient(135deg,var(--nav-900),var(--brand-700))', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CuoricinoIcon size={26} /> Abbraccino — assistente
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, maxHeight: '48vh' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === 'io' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.who === 'io' ? 'var(--brand-700)' : '#f1f5f9', color: m.who === 'io' ? '#fff' : '#1e293b', borderRadius: 14, padding: '9px 12px', fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                {m.text}
              </div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: '0.8rem' }}>Abbraccino sta pensando…</div>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={invia} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e2e8f0' }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder={listening ? 'Ti ascolto…' : 'Scrivi o detta cosa ti serve…'}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 999, fontSize: '0.88rem', fontFamily: 'inherit' }} />
            {SR && (
              <button type="button" onClick={toggleMic} aria-label="Parla con Abbraccino"
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: listening ? '#dc2626' : '#e2e8f0', color: listening ? '#fff' : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: listening ? 'abHeartBeat 1.2s infinite' : 'none' }}>
                <Mic size={17} />
              </button>
            )}
            <button type="submit" disabled={busy || !input.trim()}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--brand-700)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

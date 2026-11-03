import { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { Send, X } from 'lucide-react';

const API = 'https://api.abbracciocuredomiciliari.it/api';

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
        ? 'Ciao! Sono Abbraccino 🤖 Raccontami la tua situazione — es. "mamma anziana non autosufficiente, serve una badante che abita con lei" — e ti preparo il calcolo del costo!'
        : 'Ciao! Sono Abbraccino 🤖 Dimmi cosa serve — es. "devo fare un esame del sangue e una visita medica a domicilio" — e ti aggiungo le prestazioni al preventivo!',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contestoRef = useRef<any>(contesto);
  contestoRef.current = contesto;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

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

  return (
    <>
      <button onClick={() => setOpen(o => !o)} aria-label="Chiedi ad Abbraccino"
        style={{ position: 'fixed', bottom: 18, right: 18, width: 62, height: 62, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#1e3a5f,#1e4d8c)', color: '#fff', fontSize: 28, cursor: 'pointer', boxShadow: '0 6px 22px rgba(30,77,140,.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {open ? <X size={26} /> : '🤖'}
      </button>
      {open && (
        <div style={{ position: 'fixed', bottom: 90, right: 14, width: 'min(360px, calc(100vw - 28px))', maxHeight: '70vh', background: '#fff', borderRadius: 18, boxShadow: '0 10px 40px rgba(0,0,0,.22)', zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #dbeafe', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
          <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#1e4d8c)', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: '0.95rem' }}>
            🤖 Abbraccino — assistente preventivi
            <div style={{ fontWeight: 400, fontSize: '0.72rem', opacity: 0.85 }}>Raccontami cosa ti serve, ci penso io a compilare</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, maxHeight: '48vh' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === 'io' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.who === 'io' ? '#1e4d8c' : '#f1f5f9', color: m.who === 'io' ? '#fff' : '#1e293b', borderRadius: 14, padding: '9px 12px', fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                {m.text}
              </div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: '0.8rem' }}>Abbraccino sta pensando…</div>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={invia} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e2e8f0' }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Scrivi cosa ti serve…"
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 999, fontSize: '0.88rem', fontFamily: 'inherit' }} />
            <button type="submit" disabled={busy || !input.trim()}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#1e4d8c', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

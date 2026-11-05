import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, X } from 'lucide-react';
import api from '../api/api';
import { useModalita } from '../context/ModalitaContext';

// ═══ Abbraccino interno — assistente del gestionale ═══
// Compare in basso a destra quando l'utente è loggato. Risponde alle domande
// sul gestionale e mostra bottoni-azione che aprono la schermata giusta
// (sezione, ricerca, dossier paziente).

interface Azione { label: string; url: string }
interface Msg { who: 'io' | 'bot'; text: string; azioni?: Azione[] }

function CuoricinoIcon({ size = 30 }: { size?: number }) {
  return <img src="/abbraccino.jpg" alt="Abbraccino" width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />;
}

export default function AbbraccinoInterno() {
  const navigate = useNavigate();
  const { modalita } = useModalita();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      who: 'bot',
      text: 'Ciao! Sono Abbraccino 💛 Ti aiuto nel gestionale: chiedimi dove trovare una funzione ("come faccio una fattura?") o chi ti serve ("paziente Rossi", "operatore Maria") e ti porto lì.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  async function invia(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs((m) => [...m, { who: 'io', text }]);
    setBusy(true);
    try {
      const res = await api.post('/abbraccino/interno', { messaggio: text, area: modalita });
      setMsgs((m) => [...m, {
        who: 'bot',
        text: String(res.data?.risposta || 'Ho qualche difficoltà a rispondere ora.'),
        azioni: Array.isArray(res.data?.azioni) ? res.data.azioni : undefined,
      }]);
    } catch {
      setMsgs((m) => [...m, { who: 'bot', text: 'Ops, sono un po’ impegnato. Intanto prova la Ricerca globale dal menu 🔎' }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <style>{`
        @keyframes abIntGlow { 0%,100%{box-shadow:0 4px 16px rgba(242,181,42,.3), 0 0 0 0 rgba(242,181,42,.45)} 50%{box-shadow:0 4px 20px rgba(242,181,42,.7), 0 0 0 10px rgba(242,181,42,0)} }
        .ab-int-fab { animation: abIntGlow 1.8s ease-in-out infinite; }
      `}</style>

      {!open && (
        <div style={{ position: 'fixed', right: 14, bottom: 6, zIndex: 9990, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <button onClick={() => setOpen(true)} style={{ background: '#fff', color: '#1e4d8c', border: '1.5px solid #dbeafe', borderRadius: 999, padding: '5px 12px', fontSize: '0.72rem', fontWeight: 800, boxShadow: '0 3px 10px rgba(0,0,0,.10)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Sono Abbraccino 💛
          </button>
          <button onClick={() => setOpen(true)} aria-label="Chiedi ad Abbraccino" className="ab-int-fab"
            style={{ width: 62, height: 62, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5, boxSizing: 'border-box' }}>
            <CuoricinoIcon size={50} />
          </button>
          <button onClick={() => setOpen(true)} style={{ background: 'linear-gradient(135deg,#1e3a5f,#1e4d8c)', color: '#fff', border: 'none', borderRadius: 999, padding: '5px 14px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Chiedimi un aiutino
          </button>
        </div>
      )}

      {open && (
        <button onClick={() => setOpen(false)} aria-label="Chiudi"
          style={{ position: 'fixed', bottom: 18, right: 18, width: 62, height: 62, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#1e3a5f,#1e4d8c)', color: '#fff', cursor: 'pointer', boxShadow: '0 6px 22px rgba(30,77,140,.4)', zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={26} />
        </button>
      )}

      {open && (
        <div style={{ position: 'fixed', bottom: 90, right: 14, width: 'min(370px, calc(100vw - 28px))', maxHeight: '72vh', background: '#fff', borderRadius: 18, boxShadow: '0 10px 40px rgba(0,0,0,.22)', zIndex: 9990, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #dbeafe', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
          <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#1e4d8c)', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CuoricinoIcon size={26} /> Abbraccino — guida del gestionale
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 220, maxHeight: '50vh' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === 'io' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{ background: m.who === 'io' ? '#1e4d8c' : '#f1f5f9', color: m.who === 'io' ? '#fff' : '#1e293b', borderRadius: 14, padding: '9px 12px', fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                  {m.text}
                </div>
                {m.azioni && m.azioni.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                    {m.azioni.map((a, j) => (
                      <button key={j} onClick={() => { setOpen(false); navigate(a.url); }}
                        style={{ textAlign: 'left', background: '#fff', border: '1.5px solid #1e4d8c', color: '#1e4d8c', borderRadius: 12, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(30,77,140,.12)' }}>
                        {a.label} →
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: '0.8rem' }}>Abbraccino sta cercando…</div>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={invia} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e2e8f0' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Es: dove faccio il contratto? · paziente Rossi"
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

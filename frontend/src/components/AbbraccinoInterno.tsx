import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, X, Mic, Trash2, Calculator } from 'lucide-react';
import api from '../api/api';
import { useModalita } from '../context/ModalitaContext';

// ═══ Abbraccino interno — assistente del gestionale ═══
// Compare in basso a destra quando l'utente è loggato. Risponde alle domande
// sul gestionale, calcola prezzi dal listino/CCNL reali e mostra
// bottoni-azione che aprono la schermata giusta.

interface Azione { label: string; url: string }
interface Calcolo {
  tipo: 'listino' | 'ccnl';
  titolo?: string;
  righe: { nome: string; quantita?: number; prezzo?: number; subtotale?: number; valore?: number }[];
  totale: number;
  netto?: number;
}
interface Msg { who: 'io' | 'bot'; text: string; azioni?: Azione[]; calcolo?: Calcolo }

function CuoricinoIcon({ size = 30 }: { size?: number }) {
  return <img src="/abbraccino.jpg" alt="Abbraccino" width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />;
}

const SALUTO: Msg = {
  who: 'bot',
  text: 'Ciao! Sono Abbraccino 💛 Ti aiuto nel gestionale: chiedimi dove trovare una funzione, chi ti serve ("paziente Rossi"), o quanto costa qualcosa ("quanto costano 3 flebo?", "costo badante convivente 54 ore?").',
};

const fmtEur = (n?: number) => (typeof n === 'number' ? `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');

export default function AbbraccinoInterno() {
  const navigate = useNavigate();
  const { modalita } = useModalita();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([SALUTO]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

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
        setInput((s) => (s ? s + ' ' + t : t));
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recRef.current = r;
      setListening(true);
      r.start();
    } catch { setListening(false); }
  }

  function pulisci() {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
    setMsgs([SALUTO]);
    setInput('');
  }

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
        calcolo: res.data?.calcolo && res.data.calcolo.totale ? res.data.calcolo : undefined,
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
        @keyframes abHeartBeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.18)} 28%{transform:scale(1)} 42%{transform:scale(1.18)} 70%{transform:scale(1)} }
        .ab-header-close { display: none; }
        /* Su smartphone la chat diventa a schermo intero: la tastiera non
           copre più il pannello e tutte le risposte scorrono intere */
        @media (max-width: 640px) {
          .ab-chat-panel {
            inset: 0 !important;
            top: 0 !important; bottom: 0 !important; left: 0 !important; right: 0 !important;
            width: 100% !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            border: none !important;
          }
          .ab-chat-msgs { max-height: none !important; }
          .ab-close-fab { display: none !important; }
          .ab-header-close { display: flex !important; }
          .ab-chat-input { padding-bottom: calc(10px + env(safe-area-inset-bottom)) !important; }
        }
        /* Su smartphone il lanciatore e' compatto: una sola pill + icona piccola */
        @media (max-width: 640px) {
          .ab-launcher { right: 10px !important; bottom: 8px !important; gap: 4px !important; }
          .ab-pill-top { display: none !important; }
          .ab-int-fab { width: 46px !important; height: 46px !important; }
          .ab-int-fab svg { width: 34px !important; height: 34px !important; }
          .ab-pill-btm { font-size: 0.78rem !important; padding: 6px 14px !important; }
        }
      `}</style>

      {!open && (
        <div className="ab-launcher" style={{ position: 'fixed', right: 14, bottom: 6, zIndex: 9990, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <button onClick={() => setOpen(true)} aria-label="Chiedi ad Abbraccino" className="ab-int-fab"
            style={{ width: 62, height: 62, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5, boxSizing: 'border-box' }}>
            <CuoricinoIcon size={50} />
          </button>
          <button onClick={() => setOpen(true)} className="ab-pill-btm" style={{ background: '#1c7164', color: '#fff', border: 'none', borderRadius: 999, padding: '7px 16px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(16,47,59,.35)' }}>
            Abbraccino Aiutino
          </button>
        </div>
      )}

      {open && (
        <button onClick={() => setOpen(false)} aria-label="Chiudi" className="ab-close-fab"
          style={{ position: 'fixed', bottom: 18, right: 18, width: 62, height: 62, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,var(--nav-900),var(--brand-700))', color: '#fff', cursor: 'pointer', boxShadow: '0 6px 22px rgba(28,113,100,.4)', zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={26} />
        </button>
      )}

      {open && (
        <div className="ab-chat-panel" style={{ position: 'fixed', bottom: 90, right: 14, width: 'min(370px, calc(100vw - 28px))', maxHeight: '72vh', background: '#fff', borderRadius: 18, boxShadow: '0 10px 40px rgba(0,0,0,.22)', zIndex: 9990, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--brand-100)', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
          <div style={{ background: 'linear-gradient(135deg,var(--nav-900),var(--brand-700))', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CuoricinoIcon size={26} /> Abbraccino — guida del gestionale
            <button onClick={pulisci} title="Pulisci la conversazione"
              style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: '0.72rem', fontWeight: 700 }}>
              <Trash2 size={14} /> Pulisci
            </button>
            <button onClick={() => setOpen(false)} aria-label="Chiudi" className="ab-header-close"
              style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', padding: '5px 8px' }}>
              <X size={18} />
            </button>
          </div>
          <div className="ab-chat-msgs" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 220, maxHeight: '50vh' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === 'io' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{ background: m.who === 'io' ? 'var(--brand-700)' : '#f1f5f9', color: m.who === 'io' ? '#fff' : '#1e293b', borderRadius: 14, padding: '9px 12px', fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                  {m.text}
                </div>
                {m.calcolo && (
                  <div style={{ marginTop: 6, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: '10px 12px', fontSize: '0.8rem', color: '#14532d' }}>
                    <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <Calculator size={14} /> {m.calcolo.titolo || 'Calcolo dal tariffario reale'}
                    </div>
                    {m.calcolo.righe.map((r, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', borderBottom: '1px dashed #bbf7d0' }}>
                        <span>{r.nome}{r.quantita && r.quantita > 1 ? ` ×${r.quantita}` : ''}</span>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtEur(r.subtotale ?? r.valore)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 6, fontWeight: 800, fontSize: '0.9rem' }}>
                      <span>Totale{m.calcolo.tipo === 'ccnl' ? ' costo mensile' : ''}</span>
                      <span>{fmtEur(m.calcolo.totale)}</span>
                    </div>
                    {m.calcolo.netto != null && (
                      <div style={{ fontSize: '0.72rem', color: '#166534', marginTop: 3 }}>Netto lavoratore: {fmtEur(m.calcolo.netto)}/mese</div>
                    )}
                  </div>
                )}
                {m.azioni && m.azioni.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                    {m.azioni.map((a, j) => (
                      <button key={j} onClick={() => { setOpen(false); navigate(a.url); }}
                        style={{ textAlign: 'left', background: '#fff', border: '1.5px solid var(--brand-700)', color: 'var(--brand-700)', borderRadius: 12, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(28,113,100,.12)' }}>
                        {a.label} →
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', color: '#64748b', fontSize: '0.85rem' }}>Abbraccino sta cercando…</div>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={invia} className="ab-chat-input" style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e2e8f0' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? 'Ti ascolto…' : 'Es: quanto costa una flebo? · paziente Rossi'}
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

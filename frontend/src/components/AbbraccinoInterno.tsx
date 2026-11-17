import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Mic, Trash2, Calculator, Volume2, VolumeX, X } from 'lucide-react';
import api from '../api/api';
import { useModalita } from '../context/ModalitaContext';
import { FaceIcon } from './Abbraccino';

// ═══ Abbraccino interno — assistente del gestionale ═══
// Stesso look del widget del sito: mascotte animata che si sposta sullo
// schermo, pill "Sono Abbraccino / Vuoi aiutino?", pannello bottom-sheet
// su mobile. Dentro resta la logica del gestionale: /abbraccino/interno,
// bottoni-azione e schede di calcolo.

interface Azione { label: string; url: string }
interface Calcolo {
  tipo: 'listino' | 'ccnl';
  titolo?: string;
  righe: { nome: string; quantita?: number; prezzo?: number; subtotale?: number; valore?: number }[];
  totale: number;
  netto?: number;
}
interface Msg { who: 'io' | 'bot'; text: string; azioni?: Azione[]; calcolo?: Calcolo }

const SALUTO: Msg = {
  who: 'bot',
  text: 'Ciao! Sono Abbraccino 💛 Ti aiuto nel gestionale: chiedimi dove trovare una funzione, chi ti serve ("paziente Rossi"), o quanto costa qualcosa ("quanto costano 3 flebo?", "costo badante convivente 54 ore?").',
};

const fmtEur = (n?: number) => (typeof n === 'number' ? `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');

/* ── mascotte che si sposta dolcemente (port da abbraccino.js del sito) ── */
function startWander(host: HTMLElement, isChatOpen: () => boolean, chatEl: HTMLElement) {
  const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) * (-2 * t + 2) / 2);
  const overlap = (a: any, b: any) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  function bounds(w: number, h: number) {
    const v = { width: innerWidth, height: window.visualViewport ? window.visualViewport.height : innerHeight };
    const headerEl = document.querySelector('.site-header,header,nav');
    const header = headerEl ? headerEl.getBoundingClientRect() : null;
    const headerEnd = header && header.bottom > 0 && header.bottom < v.height / 3 ? header.bottom : 0;
    let bottom = 0;
    document.querySelectorAll('.mobilebar,.mobile-nav,.bottom-nav,nav.fixed-bottom,[data-lux-avoid-bottom]').forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.height && r.bottom >= v.height - 10 && r.top >= v.height * 0.65) bottom = Math.max(bottom, v.height - r.top);
    });
    const left = 8, right = Math.max(left, v.width - w - 8), top = Math.max(8, Math.min(headerEnd + 8, v.height - h - 8)), foot = Math.max(top, v.height - h - bottom - 10);
    return { left, right, top, bottom: foot, w, h };
  }
  function route(b: any) {
    const span = b.bottom - b.top;
    return [
      { x: b.right, y: b.bottom }, { x: b.left, y: b.bottom },
      { x: b.right, y: b.top + span * 0.15 }, { x: b.left, y: b.top + span * 0.45 },
      { x: (b.left + b.right) / 2, y: b.bottom },
    ];
  }
  function safePoint(point: any, b: any, obs: any[]) {
    const cands = [point].concat(route(b)).map((p: any) => ({ x: clamp(p.x, b.left, b.right), y: clamp(p.y, b.top, b.bottom) }));
    let best = cands[0], bestScore = Infinity;
    cands.forEach((p: any) => {
      let s = 0;
      obs.forEach((o: any) => { s += overlap({ x: p.x, y: p.y, w: b.w, h: b.h }, o); });
      if (s < bestScore) { bestScore = s; best = p; }
    });
    return best;
  }
  function obstacles() {
    const out: any[] = [], v = { height: window.visualViewport ? window.visualViewport.height : innerHeight };
    document.querySelectorAll('a,button,input,textarea,select,[data-lux-avoid]').forEach((e) => {
      if (host.contains(e) || chatEl.contains(e)) return;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > v.height) return;
      out.push({ x: r.left - 7, y: r.top - 7, w: r.width + 14, h: r.height + 14 });
    });
    return out;
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  try { paused = localStorage.getItem('ab-wander-paused') === '1'; } catch { /* noop */ }
  let hover = false, focused = false, typing = false, scrollUntil = 0, last = performance.now(), wait = 1600, progress = 0;
  let trip: any = null, index = 0, wasDocked = false;
  let position: any = null, rafId = 0, stopped = false;
  let rect0 = host.getBoundingClientRect();
  const draw = () => { host.style.setProperty('--abx', Math.round(position.x) + 'px'); host.style.setProperty('--aby', Math.round(position.y) + 'px'); };
  const place = () => { const b = bounds(rect0.width, rect0.height); position = safePoint(position || { x: b.right, y: b.bottom }, b, obstacles()); draw(); };

  const motionToggle = chatEl.querySelector('.ab-motion') as HTMLButtonElement | null;
  const updateToggle = () => {
    if (motionToggle) {
      motionToggle.setAttribute('aria-pressed', String(paused));
      motionToggle.textContent = paused ? 'Riattiva gli spostamenti di Abbraccino' : 'Ferma gli spostamenti di Abbraccino';
    }
  };
  updateToggle();
  if (motionToggle) motionToggle.onclick = () => { paused = !paused; try { localStorage.setItem('ab-wander-paused', paused ? '1' : '0'); } catch { /* noop */ } updateToggle(); trip = null; wait = 4800; };

  const onEnter = (e: PointerEvent) => { if (e.pointerType === 'mouse') hover = true; };
  const onLeave = () => { hover = false; };
  const onFocusIn = () => { focused = true; };
  const onFocusOut = () => { focused = false; };
  const onDocFocusIn = (e: FocusEvent) => { typing = !!((e.target as Element | null)?.closest?.('input,textarea,select')); };
  const onDocFocusOut = () => { typing = false; };
  const onScroll = () => { scrollUntil = performance.now() + 1200; };
  const onResize = () => { trip = null; wait = 1800; if (position) { rect0 = host.getBoundingClientRect(); place(); } };
  host.addEventListener('pointerenter', onEnter as EventListener);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('focusin', onFocusIn);
  host.addEventListener('focusout', onFocusOut);
  document.addEventListener('focusin', onDocFocusIn);
  document.addEventListener('focusout', onDocFocusOut);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  const mobileMQ = matchMedia('(max-width:760px)');
  function frame(now: number) {
    if (stopped) return;
    rafId = requestAnimationFrame(frame);
    if (mobileMQ.matches) { last = now; return; }
    const dt = Math.min(1000, Math.max(0, now - last)); last = now;
    const docked = isChatOpen();
    if (!position) place();
    if (docked) {
      const r = chatEl.getBoundingClientRect(), cr = host.getBoundingClientRect();
      position = { x: Math.max(4, r.left + 4), y: Math.max(2, r.top - cr.height - 4) };
      draw(); trip = null; wait = 6000; wasDocked = true; return;
    }
    if (wasDocked) { wasDocked = false; trip = null; wait = 4500; place(); }
    if (document.hidden || paused || reduce.matches || hover || focused || typing || now < scrollUntil) return;
    if (!trip) {
      wait -= dt; if (wait > 0) return;
      const b = bounds(rect0.width, rect0.height), points = route(b);
      let target = position;
      for (let n = 0; n < points.length; n++) {
        index = (index + 1) % points.length;
        target = safePoint(points[index], b, obstacles());
        if (Math.hypot(target.x - position.x, target.y - position.y) > 35) break;
      }
      if (Math.hypot(target.x - position.x, target.y - position.y) < 20) { wait = 6000; return; }
      trip = { from: { x: position.x, y: position.y }, to: target, duration: Math.max(3000, Math.min(6500, Math.hypot(target.x - position.x, target.y - position.y) * 7)) };
      progress = 0;
    }
    progress += dt;
    const f = Math.min(1, progress / trip.duration), t = ease(f);
    position = { x: trip.from.x + (trip.to.x - trip.from.x) * t, y: trip.from.y + (trip.to.y - trip.from.y) * t };
    draw();
    if (f === 1) { trip = null; wait = 6500; }
  }
  place();
  rafId = requestAnimationFrame(frame);

  return function stop() {
    stopped = true;
    cancelAnimationFrame(rafId);
    host.removeEventListener('pointerenter', onEnter as EventListener);
    host.removeEventListener('pointerleave', onLeave);
    host.removeEventListener('focusin', onFocusIn);
    host.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('focusin', onDocFocusIn);
    document.removeEventListener('focusout', onDocFocusOut);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', onResize);
  };
}

export default function AbbraccinoInterno() {
  const navigate = useNavigate();
  const { modalita } = useModalita();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => { try { return !!sessionStorage.getItem('ab-nascosto'); } catch { return false; } });
  const [msgs, setMsgs] = useState<Msg[]>([SALUTO]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem('ab-voice') !== '0'; } catch { return true; }
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const recRef = useRef<any>(null);

  const SR = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  // mascotte che si sposta sullo schermo (come sul sito): si ferma su hover,
  // scrittura e scroll; quando la chat e' aperta si accoccola sopra il pannello
  useEffect(() => {
    if (hidden || !colRef.current || !panelRef.current) return;
    return startWander(colRef.current, () => openRef.current, panelRef.current);
  }, [hidden]);

  function stopSpeech() { if ('speechSynthesis' in window) speechSynthesis.cancel(); (window as any).AbbraccinoFace?.setTalking(false); }
  function speak(text: string) {
    if (!voiceOn || !('speechSynthesis' in window) || !text) return;
    stopSpeech();
    const u = new SpeechSynthesisUtterance(text.replace(/[💛✅⚠️🔎]/g, '').slice(0, 600));
    u.lang = 'it-IT';
    const it = speechSynthesis.getVoices().filter(v => v.lang.startsWith('it'));
    if (it.length) u.voice = it[0];
    u.rate = .97;
    u.onstart = () => (window as any).AbbraccinoFace?.setTalking(true);
    u.onend = u.onerror = () => (window as any).AbbraccinoFace?.setTalking(false);
    speechSynthesis.speak(u);
  }

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

  function nascondi() {
    try { sessionStorage.setItem('ab-nascosto', '1'); } catch { /* noop */ }
    setHidden(true);
    setOpen(false);
    stopSpeech();
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
      const risposta = String(res.data?.risposta || 'Ho qualche difficoltà a rispondere ora.');
      setMsgs((m) => [...m, {
        who: 'bot',
        text: risposta,
        azioni: Array.isArray(res.data?.azioni) ? res.data.azioni : undefined,
        calcolo: res.data?.calcolo && res.data.calcolo.totale ? res.data.calcolo : undefined,
      }]);
      speak(risposta);
    } catch {
      setMsgs((m) => [...m, { who: 'bot', text: 'Ops, sono un po’ impegnato. Intanto prova la Ricerca globale dal menu 🔎' }]);
    } finally { setBusy(false); }
  }

  if (hidden) return null;

  return (
    <>
      <style>{`
        @keyframes abHeartBeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.18)} 28%{transform:scale(1)} 42%{transform:scale(1.18)} 70%{transform:scale(1)} }
        @keyframes abGlow { 0%,100%{box-shadow:0 4px 16px rgba(242,181,42,.3),0 0 0 0 rgba(242,181,42,.45)} 50%{box-shadow:0 4px 20px rgba(242,181,42,.7),0 0 0 10px rgba(242,181,42,0)} }
        /* colonna mascotte: si sposta dolcemente (come sul sito).
           Larghezza fissa = la traslazione di partenza non puo' mai
           finire fuori dallo schermo prima che parta lo spostamento. */
        .ab-col { position:fixed; left:0; top:0; z-index:9990; width:150px; display:flex; flex-direction:column; align-items:center; gap:5px; will-change:transform; transform:translate3d(var(--abx, calc(100vw - 158px)), var(--aby, calc(100dvh - 205px)), 0); }
        .ab-x { position:absolute; top:-8px; right:-6px; z-index:2; width:22px; height:22px; border-radius:50%; border:none; background:#1e3a5f; color:#fff; font-size:12px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.3); }
        .ab-btn-face { width:62px; height:62px; border-radius:50%; border:none; background:#fff; cursor:pointer; padding:5px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; animation:abGlow 1.8s ease-in-out infinite; }
        .ab-btn-face > span { display:flex; align-items:center; justify-content:center; width:100%; height:100%; animation:abHeartBeat 1.8s ease-in-out infinite; transform-origin:center; }
        .ab-lbl { border-radius:999px; padding:5px 12px; font-size:12px; font-weight:800; box-shadow:0 3px 10px rgba(0,0,0,.12); cursor:pointer; border:none; font-family:inherit; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis; }
        .ab-lbl-top { background:#fff; color:#1e4d8c; border:1.5px solid #dbeafe; }
        .ab-lbl-btm { background:linear-gradient(135deg,#1e3a5f,#1e4d8c); color:#fff; }
        .ab-motion { border:none; border-top:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:11px; padding:8px; cursor:pointer; font-family:inherit; }
        .ab-motion:hover { background:#f1f5f9; }
        .ab-header-close { display:none; }
        /* Su smartphone: mascotte fissa in basso a destra, pannello bottom-sheet */
        @media (max-width:760px) {
          .ab-col { gap:4px; left:auto !important; top:auto !important; right:12px !important; bottom:calc(14px + env(safe-area-inset-bottom,0px)) !important; transform:none !important; will-change:auto; }
          .ab-motion { display:none !important; }
        }
        @media (max-width:640px) {
          .ab-lbl-top { display:none; }
          .ab-btn-face { width:46px; height:46px; }
          .ab-lbl-btm { font-size:11px; padding:4px 10px; }
          .ab-chat-panel { left:0 !important; right:0 !important; bottom:0 !important; top:auto !important; width:100% !important; max-height:88dvh !important; height:88dvh !important; border-radius:18px 18px 0 0 !important; }
          .ab-chat-msgs { max-height:none !important; }
          .ab-close-fab { display:none !important; }
          .ab-header-close { display:flex !important; }
          .ab-chat-input { padding-bottom:calc(10px + env(safe-area-inset-bottom)) !important; }
        }
      `}</style>

      {/* colonna mascotte: etichetta sopra / faccia / etichetta sotto */}
      <div ref={colRef} className="ab-col">
        <button onClick={() => { setOpen(true); (window as any).AbbraccinoFace?.setSmile(true); }} className="ab-lbl ab-lbl-top">Sono Abbraccino 💛</button>
        <div style={{ position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); nascondi(); }} className="ab-x" aria-label="Nascondi Abbraccino">✕</button>
          <button onClick={() => { setOpen(true); (window as any).AbbraccinoFace?.setSmile(true); }} className="ab-btn-face" aria-label="Chiedi ad Abbraccino">
            <span><FaceIcon size={52} /></span>
          </button>
        </div>
        <button onClick={() => { setOpen(true); (window as any).AbbraccinoFace?.setSmile(true); }} className="ab-lbl ab-lbl-btm">Vuoi aiutino?</button>
      </div>

      {open && (
        <button onClick={() => { setOpen(false); stopSpeech(); (window as any).AbbraccinoFace?.setSmile(false); }} aria-label="Chiudi" className="ab-close-fab"
          style={{ position: 'fixed', bottom: 18, right: 18, width: 62, height: 62, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,var(--nav-900),var(--brand-700))', color: '#fff', cursor: 'pointer', boxShadow: '0 6px 22px rgba(28,113,100,.4)', zIndex: 9991, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={26} />
        </button>
      )}

      <div ref={panelRef} className="ab-chat-panel"
        style={{ position: 'fixed', bottom: 90, right: 14, width: 'min(370px, calc(100vw - 28px))', maxHeight: '72vh', background: '#fff', borderRadius: 18, boxShadow: '0 10px 40px rgba(0,0,0,.22)', zIndex: 9990, display: open ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden', border: '1px solid #dbeafe', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#1e4d8c)', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaceIcon size={30} /> Abbraccino — guida del gestionale
          {'speechSynthesis' in window && (
            <button type="button" onClick={() => { const v = !voiceOn; setVoiceOn(v); try { localStorage.setItem('ab-voice', v ? '1' : '0'); } catch { /* noop */ } if (v) speak('Voce attiva.'); else stopSpeech(); }}
              aria-pressed={voiceOn} aria-label={voiceOn ? 'Sospendi risposte vocali' : 'Attiva risposte vocali'} title="Risposte vocali"
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: voiceOn ? '#fbbf24' : 'rgba(255,255,255,.75)', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
              {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          )}
          <button onClick={pulisci} title="Pulisci la conversazione"
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: '0.72rem', fontWeight: 700 }}>
            <Trash2 size={14} /> Pulisci
          </button>
          <button onClick={() => { setOpen(false); stopSpeech(); (window as any).AbbraccinoFace?.setSmile(false); }} aria-label="Chiudi" className="ab-header-close"
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', padding: '5px 8px' }}>
            <X size={18} />
          </button>
        </div>
        <div className="ab-chat-msgs" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 220, maxHeight: '50vh' }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: m.who === 'io' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
              <div style={{ background: m.who === 'io' ? '#1e4d8c' : '#f1f5f9', color: m.who === 'io' ? '#fff' : '#1e293b', borderRadius: 14, padding: '9px 12px', fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
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
                      style={{ textAlign: 'left', background: '#fff', border: '1.5px solid #1e4d8c', color: '#1e4d8c', borderRadius: 12, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(30,77,140,.12)' }}>
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
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#1e4d8c', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Send size={16} />
          </button>
        </form>
        <button type="button" className="ab-motion" aria-pressed="false">Ferma gli spostamenti</button>
      </div>
    </>
  );
}

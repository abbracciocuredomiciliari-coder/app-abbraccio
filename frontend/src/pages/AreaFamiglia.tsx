import { useEffect, useState } from 'react';
import { CheckCircle, Phone, MessageCircle, LogOut, FileText, CalendarClock, ClipboardList, KeyRound } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// AREA RISERVATA FAMIGLIE — accesso senza password: email + codice OTP a 6
// cifre. Dashboard in sola lettura con richieste, prenotazioni e preventivi
// intestati al contatto. Link pubblico /area-famiglia, nessun menu interno.
// ═════════════════════════════════════════════════════════════════════════════

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://api.abbracciocuredomiciliari.it/api';
const TELEFONO = '0601905242';
const TELEFONO_LABEL = '06 01905242';
const WHATSAPP = '393514175117';
const TOKEN_KEY = 'famiglia_token';

const input: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: '10px',
  fontSize: '1rem', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
};
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', marginBottom: '14px' };
const btnPrimary: React.CSSProperties = {
  width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: '#1e4d8c',
  color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
};

interface Richiesta {
  id: string; servizio: string; categoria?: string; stato: string;
  dataRichiesta?: string; dataPreferita?: string; orarioPreferito?: string;
  dataConfermata?: string; orarioConfermato?: string; risposta?: string;
}
interface Preventivo { id: string; tipo: string; totale?: number; canale: string; data?: string }
interface Registrazione { id: string; nome: string; stato: string; data?: string }
interface Dati { email: string; richieste: Richiesta[]; preventivi: Preventivo[]; registrazioni: Registrazione[] }

export default function AreaFamiglia() {
  const [step, setStep] = useState<'email' | 'codice' | 'dashboard'>('email');
  const [email, setEmail] = useState('');
  const [codice, setCodice] = useState('');
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [dati, setDati] = useState<Dati | null>(null);

  useEffect(() => { document.title = 'Area Riservata Famiglie — Abbraccio Cure Domiciliari'; }, []);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) carica(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carica = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/area-famiglia/dati`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { localStorage.removeItem(TOKEN_KEY); return; }
      const data = await res.json();
      setDati(data);
      setStep('dashboard');
    } catch { /* offline: resta su login */ }
  };

  const inviaCodice = async () => {
    if (!email.trim() || !email.includes('@')) { setErrore('Inserisci un indirizzo email valido.'); return; }
    setBusy(true); setErrore('');
    try {
      const res = await fetch(`${API_BASE}/area-famiglia/richiedi-codice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Errore nell\'invio');
      setOkMsg(data.message || '');
      setStep('codice');
    } catch (e: any) {
      setErrore(e.message || 'Errore nell\'invio del codice.');
    } finally { setBusy(false); }
  };

  const verifica = async () => {
    if (codice.trim().length < 6) { setErrore('Inserisci il codice a 6 cifre ricevuto via email.'); return; }
    setBusy(true); setErrore('');
    try {
      const res = await fetch(`${API_BASE}/area-famiglia/verifica-codice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), codice: codice.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Codice non valido');
      localStorage.setItem(TOKEN_KEY, data.token);
      await carica(data.token);
    } catch (e: any) {
      setErrore(e.message || 'Codice non valido. Riprova.');
    } finally { setBusy(false); }
  };

  const esci = () => {
    localStorage.removeItem(TOKEN_KEY);
    setDati(null); setStep('email'); setCodice(''); setOkMsg('');
  };

  const Header = (
    <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src="/logo.png" alt="Abbraccio" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
        <div>
          <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', lineHeight: 1.1 }}>Abbraccio Cure Domiciliari</div>
          <div style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 600 }}>Area Riservata Famiglie</div>
        </div>
        {step === 'dashboard' && (
          <button onClick={esci} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '7px 12px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
            <LogOut size={14} /> Esci
          </button>
        )}
      </div>
    </header>
  );

  const Contatti = (
    <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginTop: '18px' }}>
      Serve aiuto? <a href={`tel:${TELEFONO}`} style={{ color: '#1e4d8c', fontWeight: 700 }}><Phone size={12} style={{ verticalAlign: '-2px' }} /> {TELEFONO_LABEL}</a>
      {' · '}<a href={`https://wa.me/${WHATSAPP}`} style={{ color: '#16a34a', fontWeight: 700 }}><MessageCircle size={12} style={{ verticalAlign: '-2px' }} /> WhatsApp</a>
    </p>
  );

  if (step === 'dashboard' && dati) {
    const vuota = !dati.richieste.length && !dati.preventivi.length && !dati.registrazioni.length;
    return (
      <div style={{ minHeight: '100vh', background: '#f0f6ff', fontFamily: 'system-ui, sans-serif' }}>
        {Header}
        <main style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 14px 60px' }}>
          <h1 style={{ color: '#1e293b', fontSize: '1.35rem', margin: '6px 0 4px', fontWeight: 800 }}>Ciao, questa è la tua area</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 18px' }}>Dati collegati a <strong>{dati.email}</strong></p>

          {vuota && (
            <div style={{ ...card, textAlign: 'center', padding: '30px' }}>
              <p style={{ color: '#475569' }}>Non troviamo ancora richieste o preventivi collegati a questa email.</p>
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Se hai usato un altro indirizzo o solo il telefono nelle richieste passate, chiamaci: colleghiamo la tua email.</p>
            </div>
          )}

          {!!dati.richieste.length && (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a5f', margin: '18px 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardList size={17} /> Le tue richieste e prenotazioni</h2>
              {dati.richieste.map(r => (
                <div key={r.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#1e293b' }}>{r.servizio || 'Richiesta di servizio'}</strong>
                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 700 }}>{r.stato}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#57534e', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {r.dataRichiesta && <span>📨 Inviata il {r.dataRichiesta}</span>}
                    {r.dataPreferita && <span>🗓️ Preferita: {r.dataPreferita}{r.orarioPreferito ? ` ${r.orarioPreferito}` : ''}</span>}
                    {r.dataConfermata && <span style={{ color: '#15803d', fontWeight: 700 }}>✅ Confermata: {r.dataConfermata}{r.orarioConfermato ? ` ${r.orarioConfermato}` : ''}</span>}
                  </div>
                  {r.risposta && <div style={{ marginTop: '8px', fontSize: '0.82rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px 10px', color: '#075985' }}>{r.risposta}</div>}
                </div>
              ))}
            </>
          )}

          {!!dati.preventivi.length && (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a5f', margin: '18px 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={17} /> I tuoi preventivi</h2>
              {dati.preventivi.map(p => (
                <div key={p.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#1e293b' }}>{p.tipo}</strong>
                    {p.totale != null && <span style={{ marginLeft: 'auto', fontWeight: 800, color: '#0f766e' }}>€ {Number(p.totale).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#57534e', marginTop: '4px' }}>
                    {p.data && <span>Inviato il {p.data} via {p.canale}</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>Per ricevere di nuovo il PDF scrivici su WhatsApp o chiamaci.</div>
                </div>
              ))}
            </>
          )}

          {!!dati.registrazioni.length && (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a5f', margin: '18px 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarClock size={17} /> Registrazioni</h2>
              {dati.registrazioni.map(r => (
                <div key={r.id} style={card}>
                  <strong>{r.nome || 'Registrazione'}</strong>
                  <span style={{ marginLeft: '8px', fontSize: '0.82rem', fontWeight: 700 }}>{r.stato}</span>
                  {r.data && <div style={{ fontSize: '0.8rem', color: '#57534e', marginTop: '4px' }}>del {r.data}</div>}
                </div>
              ))}
            </>
          )}
          {Contatti}
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f6ff', fontFamily: 'system-ui, sans-serif' }}>
      {Header}
      <main style={{ maxWidth: '440px', margin: '0 auto', padding: '30px 14px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ color: '#1e293b', fontSize: 'clamp(1.3rem,4vw,1.6rem)', margin: '6px 0', fontWeight: 800 }}>
            La tua area famiglie
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Segui le tue richieste, prenotazioni e preventivi. Niente password: entri con la tua email e un codice.
          </p>
        </div>

        {errore && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontWeight: 600, fontSize: '0.9rem' }}>⚠️ {errore}</div>}
        {okMsg && step === 'codice' && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontSize: '0.88rem' }}><CheckCircle size={14} style={{ verticalAlign: '-2px' }} /> {okMsg}</div>}

        <div style={card}>
          {step === 'email' ? (
            <>
              <h2 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 800, color: '#1e3a5f' }}><KeyRound size={16} style={{ verticalAlign: '-2px' }} /> Accedi con la tua email</h2>
              <p style={{ fontSize: '0.83rem', color: '#64748b', margin: '0 0 10px' }}>Usa la stessa email che hai lasciato nelle richieste o nei preventivi.</p>
              <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@email.it"
                onKeyDown={e => e.key === 'Enter' && inviaCodice()} />
              <button style={{ ...btnPrimary, marginTop: '12px', opacity: busy ? 0.7 : 1 }} onClick={inviaCodice} disabled={busy}>
                {busy ? 'Invio in corso…' : 'Inviami il codice di accesso'}
              </button>
            </>
          ) : (
            <>
              <h2 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 800, color: '#1e3a5f' }}>Inserisci il codice</h2>
              <p style={{ fontSize: '0.83rem', color: '#64748b', margin: '0 0 10px' }}>Abbiamo inviato un codice a 6 cifre a <strong>{email}</strong> (controlla anche spam).</p>
              <input style={{ ...input, textAlign: 'center', fontSize: '1.6rem', letterSpacing: '10px', fontWeight: 800 }}
                inputMode="numeric" maxLength={6} value={codice} onChange={e => setCodice(e.target.value.replace(/\D/g, ''))} placeholder="••••••"
                onKeyDown={e => e.key === 'Enter' && verifica()} />
              <button style={{ ...btnPrimary, marginTop: '12px', opacity: busy ? 0.7 : 1 }} onClick={verifica} disabled={busy}>
                {busy ? 'Verifica…' : 'Entra'}
              </button>
              <button onClick={() => { setStep('email'); setErrore(''); setCodice(''); }}
                style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'none', border: 'none', color: '#1e4d8c', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                ← Cambia email o rimanda il codice
              </button>
            </>
          )}
        </div>
        {Contatti}
      </main>
    </div>
  );
}

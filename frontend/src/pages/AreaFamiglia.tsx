import { useEffect, useState } from 'react';
import axios from 'axios';
import { Mail, KeyRound, FileText, ClipboardList, UserCheck, LogOut, Phone } from 'lucide-react';

const API = 'https://api.abbracciocuredomiciliari.it/api';
const TEL = '06 01905242';
const TEL_HREF = '0601905242';
const LS_KEY = 'famiglia_token';

export default function AreaFamiglia() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_KEY));
  const [email, setEmail] = useState('');
  const [codice, setCodice] = useState('');
  const [fase, setFase] = useState<'email' | 'codice'>('email');
  const [dati, setDati] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/area-famiglia/dati`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setDati(r.data))
      .catch(() => { localStorage.removeItem(LS_KEY); setToken(null); });
  }, [token]);

  async function richiediCodice(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      await axios.post(`${API}/area-famiglia/richiedi-codice`, { email });
      setFase('codice');
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore. Riprova.'); }
    finally { setLoading(false); }
  }

  async function verificaCodice(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const r = await axios.post(`${API}/area-famiglia/verifica-codice`, { email, codice });
      localStorage.setItem(LS_KEY, r.data.token);
      setToken(r.data.token);
    } catch (e: any) { setErr(e?.response?.data?.message || 'Codice non valido.'); }
    finally { setLoading(false); }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '1rem', boxSizing: 'border-box', fontFamily: 'inherit', textAlign: 'center' };
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #dbeafe', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: 20, marginBottom: 14 };

  // ── Login OTP ──────────────────────────────────────────────────────────────
  if (!token) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eff6ff,#ffffff 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ ...card, maxWidth: 440, width: '100%', textAlign: 'center', padding: '36px 28px' }}>
        <img src="/logo.png" alt="Abbraccio" style={{ height: 48, marginBottom: 10 }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
        <h1 style={{ color: '#1e293b', fontSize: '1.4rem', margin: '0 0 6px' }}>Area Riservata Famiglie</h1>
        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 20px' }}>
          {fase === 'email'
            ? 'Inserisci l\'email usata per la richiesta: ti inviamo un codice di accesso.'
            : <>Abbiamo inviato un codice a 6 cifre a <strong>{email}</strong> (se l'indirizzo è registrato).</>}
        </p>
        <form onSubmit={fase === 'email' ? richiediCodice : verificaCodice}>
          {fase === 'email' ? (
            <input style={inp} type="email" required placeholder="La tua email" value={email} onChange={e => setEmail(e.target.value)} />
          ) : (
            <input style={{ ...inp, letterSpacing: 8, fontWeight: 800, fontSize: '1.3rem' }} inputMode="numeric" maxLength={6} required placeholder="••••••" value={codice} onChange={e => setCodice(e.target.value.replace(/\D/g, ''))} />
          )}
          {err && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{err}</p>}
          <button type="submit" disabled={loading}
            style={{ marginTop: 14, width: '100%', padding: 13, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#1e3a8a,#1e4d8c)', color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {fase === 'email' ? <><Mail size={17} /> {loading ? 'Invio...' : 'Inviami il codice'}</> : <><KeyRound size={17} /> {loading ? 'Verifica...' : 'Accedi'}</>}
          </button>
          {fase === 'codice' && (
            <button type="button" onClick={() => { setFase('email'); setCodice(''); setErr(''); }}
              style={{ marginTop: 10, background: 'none', border: 'none', color: '#1e4d8c', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>← Cambia email</button>
          )}
        </form>
        <p style={{ marginTop: 18, fontSize: '0.78rem', color: '#94a3b8' }}>Problemi di accesso? <a href={`tel:${TEL_HREF}`} style={{ color: '#1e4d8c' }}>{TEL}</a></p>
      </div>
    </div>
  );

  // ── Area autenticata ───────────────────────────────────────────────────────
  const sez = (t: string, n: number) => (
    <h2 style={{ fontSize: '1rem', color: '#1e4d8c', margin: '20px 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>{t} <span style={{ background: '#dbeafe', borderRadius: 999, padding: '1px 10px', fontSize: '0.75rem' }}>{n}</span></h2>
  );
  const fmtData = (d: any) => d ? new Date(d).toLocaleDateString('it-IT') : '—';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eff6ff,#ffffff 55%)', fontFamily: "'Segoe UI',system-ui,sans-serif", padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <img src="/logo.png" alt="" style={{ height: 40 }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#1e293b' }}>Area Riservata Famiglie</strong>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{dati?.email || email}</div>
          </div>
          <button onClick={() => { localStorage.removeItem(LS_KEY); setToken(null); }}
            style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
            <LogOut size={14} /> Esci
          </button>
        </div>

        {!dati && <p style={{ color: '#94a3b8' }}>⏳ Caricamento...</p>}

        {dati && (<>
          {sez('📋 Le tue richieste', dati.richieste?.length || 0)}
          {(dati.richieste || []).map((r: any, i: number) => (
            <div key={i} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={17} color="#1e4d8c" />
                <strong style={{ color: '#1e293b', fontSize: '0.9rem' }}>{r.tipoSpecifico || r.tipoServizio || 'Richiesta'}</strong>
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', background: r.stato === 'in_attesa' ? '#fef3c7' : '#dcfce7', color: r.stato === 'in_attesa' ? '#92400e' : '#166534', padding: '2px 10px', borderRadius: 999, fontWeight: 700 }}>{r.stato || '—'}</span>
              </div>
              {r.dataPreferita && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>Data preferita: {fmtData(r.dataPreferita)}</div>}
              {r.noteAdmin && <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 6, background: '#f8fafc', padding: '8px 10px', borderRadius: 8 }}>{r.noteAdmin}</div>}
            </div>
          ))}
          {(!dati.richieste || dati.richieste.length === 0) && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nessuna richiesta registrata.</p>}

          {sez('📄 I tuoi preventivi', dati.preventivi?.length || 0)}
          {(dati.preventivi || []).map((p: any, i: number) => (
            <div key={i} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={17} color="#1e4d8c" />
                <strong style={{ color: '#1e293b', fontSize: '0.9rem' }}>{p.numero || 'Preventivo'}</strong>
                {p.totale != null && <strong style={{ marginLeft: 'auto', color: '#166534' }}>€ {Number(p.totale).toFixed(2)}</strong>}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>{fmtData(p.inviatoIl || p.createdAt)}{p.tipo ? ` · ${p.tipo}` : ''}</div>
            </div>
          ))}
          {(!dati.preventivi || dati.preventivi.length === 0) && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nessun preventivo registrato.</p>}

          {sez('👤 Registrazioni', dati.registrazioni?.length || 0)}
          {(dati.registrazioni || []).map((r: any, i: number) => (
            <div key={i} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={17} color="#1e4d8c" />
                <strong style={{ color: '#1e293b', fontSize: '0.9rem' }}>{r.pazienteNome || `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Registrazione'}</strong>
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', background: '#eff6ff', color: '#1e4d8c', padding: '2px 10px', borderRadius: 999, fontWeight: 700 }}>{r.stato || '—'}</span>
              </div>
            </div>
          ))}

          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', marginTop: 20 }}>
            Abbraccio Cure Domiciliari · <a href={`tel:${TEL_HREF}`} style={{ color: '#1e4d8c' }}><Phone size={11} style={{ verticalAlign: -1 }} /> {TEL}</a>
          </p>
        </>)}
      </div>
    </div>
  );
}

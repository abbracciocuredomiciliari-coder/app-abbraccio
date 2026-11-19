import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Send } from 'lucide-react';
import { TornaAlSito } from '../components/TornaAlSito';

// ═════════════════════════════════════════════════════════════════════════════
// COMPLETA CANDIDATURA — pagina pubblica dal link in "Richiedi dati".
// Il candidato compila SOLO i dati mancanti richiesti dalla gestione e i
// valori entrano diretti nella scheda CandidatoIntermediazione: nessuna
// email da ricopiare a mano.
// ═════════════════════════════════════════════════════════════════════════════

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://api.abbracciocuredomiciliari.it/api';

const input: React.CSSProperties = {
  width: '100%', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: '10px',
  fontSize: '1rem', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
};
const label: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', marginBottom: '14px' };
const cardTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: '1rem', fontWeight: 800, color: 'var(--nav-900)' };

const PERMESSI: [string, string][] = [
  ['valido', '✅ Permesso di soggiorno valido'],
  ['in_scadenza', '⏳ In scadenza / in rinnovo'],
  ['documenti_validi', '📄 Documenti validi (es. cittadinanza UE)'],
  ['assente', '⚠️ Nessun documento valido al momento'],
];
const DISPONIBILITA: [string, string][] = [
  ['diurno', '☀️ Diurno'],
  ['notturno', '🌙 Solo notturno'],
  ['h24', '🕐 Disponibile h24'],
];

// Etichette richieste in Gestione Utenti → quali campi mostrare
const CAMPO_TELEFONO = 'Telefono';
const CAMPO_EMAIL = 'Email';
const CAMPO_NASCITA = 'Data di nascita';
const CAMPO_CF = 'Codice fiscale';
const CAMPO_ZONA = 'Zona di lavoro (città/regione)';
const CAMPO_DISP = 'Disponibilità oraria';
const CAMPO_DOC = 'Documento allegato (identità/CV)';
const CAMPO_PERMESSO = 'Permesso di soggiorno';

export default function CompletaCandidatura() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<{ nome: string; ruolo: string; campi: string[] } | null>(null);
  const [errore, setErrore] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/candidati-intermediazione/completa/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Link non valido');
        return r.json();
      })
      .then(setInfo)
      .catch((e) => setErrore(e.message || 'Link non valido'));
  }, [token]);

  const set = (k: string) => (e: any) => setV((p) => ({ ...p, [k]: e.target.value }));
  const richiesto = (c: string) => !!info?.campi?.includes(c);

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrore(''); setOk('');
    try {
      const fd = new FormData();
      ['telefono', 'email', 'dataNascita', 'codiceFiscale', 'cittaInteresse', 'regioneInteresse', 'disponibilita', 'permessoSoggiorno']
        .forEach((k) => { if (v[k]) fd.append(k, v[k]); });
      if (file) fd.append('documento', file);
      const res = await fetch(`${API_BASE}/candidati-intermediazione/completa/${token}`, { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Invio non riuscito');
      setOk(body.message || 'Dati ricevuti. Grazie!');
    } catch (err: any) {
      setErrore(err.message || 'Invio non riuscito. Riprova.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0c2d3d 0%,#155a75 55%,#1e7f8c 100%)', padding: '20px 14px 50px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', margin: '14px 0 24px' }}>
          <img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ height: '52px', borderRadius: '10px', background: '#fff', padding: '6px' }} />
        </div>

        {errore && !info && (
          <div style={card}>
            <h2 style={cardTitle}>Link non valido</h2>
            <p style={{ color: '#64748b', margin: 0 }}>{errore} — se hai ricevuto il link via email o WhatsApp controlla di averlo aperto tutto, oppure contatta il centro Abbraccio.</p>
            <TornaAlSito />
          </div>
        )}

        {ok && (
          <div style={{ ...card, borderColor: '#86efac', background: '#f0fdf4', textAlign: 'center' }}>
            <CheckCircle size={42} color="#16a34a" style={{ margin: '0 auto 10px' }} />
            <h2 style={{ ...cardTitle, color: '#166534' }}>Fatto!</h2>
            <p style={{ color: '#166534', margin: '0 0 14px' }}>{ok}</p>
            <TornaAlSito />
          </div>
        )}

        {info && !ok && (
          <>
            <div style={{ ...card, background: 'rgba(255,255,255,.96)' }}>
              <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 800, color: 'var(--nav-900)' }}>Ciao {info.nome} 👋</h1>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Per completare la tua iscrizione come <strong>{info.ruolo}</strong> mancano solo questi dati.
                Compilali qui sotto: arrivano <strong>direttamente nella tua scheda</strong> al centro Abbraccio.
              </p>
            </div>

            <form onSubmit={invia}>
              <div style={card}>
                <h2 style={cardTitle}>Dati richiesti</h2>
                <div style={{ display: 'grid', gap: '13px' }}>
                  {richiesto(CAMPO_TELEFONO) && <div><label style={label}>Telefono *</label><input required type="tel" style={input} value={v.telefono || ''} onChange={set('telefono')} placeholder="Es. 333 1234567" /></div>}
                  {richiesto(CAMPO_EMAIL) && <div><label style={label}>Email *</label><input required type="email" style={input} value={v.email || ''} onChange={set('email')} placeholder="nome@email.it" /></div>}
                  {richiesto(CAMPO_NASCITA) && <div><label style={label}>Data di nascita *</label><input required type="date" style={input} value={v.dataNascita || ''} onChange={set('dataNascita')} /></div>}
                  {richiesto(CAMPO_CF) && <div><label style={label}>Codice fiscale *</label><input required style={input} maxLength={16} value={v.codiceFiscale || ''} onChange={set('codiceFiscale')} placeholder="RSSMRA…" /></div>}
                  {richiesto(CAMPO_ZONA) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div><label style={label}>Città dove vuoi lavorare *</label><input required style={input} value={v.cittaInteresse || ''} onChange={set('cittaInteresse')} placeholder="Es. Roma" /></div>
                      <div><label style={label}>Regione</label><input style={input} value={v.regioneInteresse || ''} onChange={set('regioneInteresse')} placeholder="Es. Lazio" /></div>
                    </div>
                  )}
                  {richiesto(CAMPO_DISP) && (
                    <div><label style={label}>Disponibilità oraria *</label>
                      <select required style={input} value={v.disponibilita || ''} onChange={set('disponibilita')}>
                        <option value="">Scegli…</option>
                        {DISPONIBILITA.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                      </select>
                    </div>
                  )}
                  {richiesto(CAMPO_PERMESSO) && (
                    <div><label style={label}>Permesso di soggiorno *</label>
                      <select required style={input} value={v.permessoSoggiorno || ''} onChange={set('permessoSoggiorno')}>
                        <option value="">Scegli…</option>
                        {PERMESSI.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                      </select>
                    </div>
                  )}
                  {richiesto(CAMPO_DOC) && (
                    <div><label style={label}>Documento d'identità o CV (foto o PDF) *</label>
                      <input required type="file" accept="image/*,application/pdf" style={input} onChange={(e: any) => setFile(e.target.files?.[0] || null)} />
                    </div>
                  )}
                </div>
              </div>

              {errore && <p role="alert" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', margin: '0 0 12px', fontSize: '0.92rem' }}>{errore}</p>}

              <button type="submit" disabled={busy} style={{ width: '100%', padding: '15px', border: 'none', borderRadius: '12px', background: busy ? '#94a3b8' : '#1e4d8c', color: '#fff', fontSize: '1.05rem', fontWeight: 800, cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Send size={17} /> {busy ? 'Invio in corso…' : 'Invia i dati'}
              </button>
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.75)', fontSize: '0.8rem', marginTop: '14px' }}>
                I dati vengono trasmessi in modo sicuro e usati solo per la valutazione della candidatura.
              </p>
            </form>
          </>
        )}

        {!info && !errore && <p style={{ textAlign: 'center', color: '#fff' }}>Caricamento…</p>}
      </div>
    </div>
  );
}

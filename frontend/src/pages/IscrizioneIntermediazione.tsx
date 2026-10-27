import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Camera, Paperclip, CheckCircle, Phone, MessageCircle } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// ISCRIZIONE INTERMEDIAZIONE — modulo pubblico semplificato per badanti, colf
// e assistenti familiari. Link esterno senza login né menu. Tutti i campi
// opzionali tranne nome, cognome e ruolo. Branding Abbraccio + Salus Group.
// ═════════════════════════════════════════════════════════════════════════════

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://api.abbracciocuredomiciliari.it/api';
const TELEFONO = '0601905242';
const TELEFONO_LABEL = '06 01905242';
const WHATSAPP = '393514175117';

const REGIONI = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia',
  'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna',
  'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto',
];

const input: React.CSSProperties = {
  width: '100%', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: '10px',
  fontSize: '1rem', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
};
const label: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', marginBottom: '14px' };
const cardTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: '1rem', fontWeight: 800, color: '#1e3a5f' };

function Dettatura({ onTesto }: { onTesto: (t: string) => void }) {
  const [ascolto, setAscolto] = useState(false);
  const recRef = useRef<any>(null);
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const toggle = () => {
    if (ascolto && recRef.current) { recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      let aggiunto = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) aggiunto += e.results[i][0].transcript;
      }
      if (aggiunto.trim()) onTesto(aggiunto.trim());
    };
    rec.onend = () => setAscolto(false);
    rec.onerror = () => setAscolto(false);
    recRef.current = rec;
    rec.start();
    setAscolto(true);
  };
  return (
    <button type="button" onClick={toggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px', border: `1px solid ${ascolto ? '#dc2626' : '#a78bfa'}`, background: ascolto ? '#fee2e2' : '#f5f3ff', color: ascolto ? '#b91c1c' : '#6d28d9', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
      {ascolto ? <><Square size={13} /> Ferma dettatura</> : <><Mic size={13} /> 🎤 Detta</>}
    </button>
  );
}

export default function IscrizioneIntermediazione() {
  const [inviato, setInviato] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState('');

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [ruolo, setRuolo] = useState('badante');
  const [nazionalita, setNazionalita] = useState('');
  const [dataNascita, setDataNascita] = useState('');
  const [extraUe, setExtraUe] = useState(false);
  const [permessoSoggiorno, setPermessoSoggiorno] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [regioneResidenza, setRegioneResidenza] = useState('');
  const [cittaResidenza, setCittaResidenza] = useState('');
  const [regioneInteresse, setRegioneInteresse] = useState('');
  const [cittaInteresse, setCittaInteresse] = useState('');
  const [disponibilita, setDisponibilita] = useState('');
  const [residenzaFamiglia, setResidenzaFamiglia] = useState(false);
  const [certificato, setCertificato] = useState(false);
  const [esperienze, setEsperienze] = useState('');
  const [note, setNote] = useState('');
  const [documento, setDocumento] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = 'Iscriviti come badante o colf — Abbraccio Cure Domiciliari'; }, []);

  const appendi = (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (t: string) => setter(prev => (prev.trim() ? `${prev.trim()} ${t}` : t));

  const invia = async () => {
    if (!nome.trim() || !cognome.trim()) {
      setErrore('Inserisci almeno nome e cognome.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    setErrore('');
    try {
      const fd = new FormData();
      fd.append('nome', nome.trim());
      fd.append('cognome', cognome.trim());
      fd.append('ruolo', ruolo);
      if (nazionalita.trim()) fd.append('nazionalita', nazionalita.trim());
      if (dataNascita) fd.append('dataNascita', dataNascita);
      fd.append('extraUe', String(extraUe));
      if (permessoSoggiorno) fd.append('permessoSoggiorno', permessoSoggiorno);
      if (codiceFiscale.trim()) fd.append('codiceFiscale', codiceFiscale.trim().toUpperCase());
      if (telefono.trim()) fd.append('telefono', telefono.trim());
      if (email.trim()) fd.append('email', email.trim());
      if (regioneResidenza) fd.append('regioneResidenza', regioneResidenza);
      if (cittaResidenza.trim()) fd.append('cittaResidenza', cittaResidenza.trim());
      if (regioneInteresse) fd.append('regioneInteresse', regioneInteresse);
      if (cittaInteresse.trim()) fd.append('cittaInteresse', cittaInteresse.trim());
      if (disponibilita) fd.append('disponibilita', disponibilita);
      fd.append('residenzaPressoFamiglia', String(residenzaFamiglia));
      fd.append('certificato', String(certificato));
      if (esperienze.trim()) fd.append('esperienze', esperienze.trim());
      if (note.trim()) fd.append('note', note.trim());
      if (documento) fd.append('documento', documento);

      const res = await fetch(`${API_BASE}/candidati-intermediazione/pubblica`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Errore nell\'invio');
      setInviato(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setErrore(e.message || 'Errore nell\'invio della candidatura. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  if (inviato) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f6ff', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ ...card, maxWidth: '480px', textAlign: 'center', padding: '36px 24px' }}>
          <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 12px' }} />
          <h1 style={{ color: '#1e3a5f', fontSize: '1.4rem', margin: '0 0 8px' }}>Iscrizione inviata!</h1>
          <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 18px' }}>
            Grazie <strong>{nome}</strong>. La tua candidatura come <strong>{ruolo === 'badante' ? 'badante' : ruolo === 'colf' ? 'colf' : 'assistente familiare'}</strong> è in attesa di valutazione.
            Ti ricontatteremo al più presto{telefono ? ` al numero ${telefono}` : ''}.
          </p>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Per informazioni: <a href={`tel:${TELEFONO}`} style={{ color: '#1e4d8c', fontWeight: 700 }}>{TELEFONO_LABEL}</a> · WhatsApp <a href={`https://wa.me/${WHATSAPP}`} style={{ color: '#16a34a', fontWeight: 700 }}>351 4175117</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f6ff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header Abbraccio + Salus */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Abbraccio" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', lineHeight: 1.1 }}>Abbraccio Cure Domiciliari</div>
            <div style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 600 }}>Badanti · Colf · Assistenti Familiari</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: '#f6f9ff', border: '1px solid #dfe9fb', borderRadius: '10px', padding: '5px 10px' }}>
            <span style={{ fontSize: '0.62rem', color: '#64748b', lineHeight: 1.25, textAlign: 'right' }}>
              in collaborazione con<br /><strong style={{ color: '#1e40af', fontSize: '0.68rem' }}>Salus Group</strong>
            </span>
            <img src="/images/logo-salus.png" alt="Salus Group" style={{ height: '30px', width: 'auto', display: 'block' }} />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 14px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ color: '#1e293b', fontSize: 'clamp(1.3rem,4vw,1.7rem)', margin: '6px 0', fontWeight: 800 }}>
            Iscriviti come badante, colf o assistente familiare
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Modulo veloce: compila quello che puoi, niente di complicato. Ti ricontattiamo noi.
          </p>
        </div>

        {errore && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontWeight: 600, fontSize: '0.9rem' }}>
            ⚠️ {errore}
          </div>
        )}

        {/* Identità */}
        <div style={card}>
          <h2 style={cardTitle}>👤 Chi sei</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><span style={label}>Nome</span><input style={input} value={nome} onChange={e => setNome(e.target.value)} placeholder="Mario" /></div>
            <div><span style={label}>Cognome</span><input style={input} value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Rossi" /></div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <span style={label}>Cosa vuoi fare</span>
            <select style={input} value={ruolo} onChange={e => setRuolo(e.target.value)}>
              <option value="badante">🧓 Badante</option>
              <option value="colf">🧹 Colf</option>
              <option value="assistente_familiare">👨‍👩‍👧 Assistente familiare</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><span style={label}>Telefono</span><input style={input} type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="333 1234567" /></div>
            <div><span style={label}>Email</span><input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@email.it" /></div>
          </div>
        </div>

        {/* Origine e documenti */}
        <div style={card}>
          <h2 style={cardTitle}>🌍 Origine e documenti</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><span style={label}>Nazionalità</span><input style={input} value={nazionalita} onChange={e => setNazionalita(e.target.value)} placeholder="Es. Ucraina" /></div>
            <div><span style={label}>Data di nascita</span><input style={input} type="date" value={dataNascita} onChange={e => setDataNascita(e.target.value)} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#334155', marginBottom: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={extraUe} onChange={e => setExtraUe(e.target.checked)} />
            Non sono cittadino italiano né europeo
          </label>
          {extraUe && (
            <div style={{ marginBottom: '10px' }}>
              <span style={label}>Permesso di soggiorno / documenti</span>
              <select style={input} value={permessoSoggiorno} onChange={e => setPermessoSoggiorno(e.target.value)}>
                <option value="">— Seleziona —</option>
                <option value="valido">Permesso di soggiorno valido</option>
                <option value="in_scadenza">Permesso in scadenza / rinnovo</option>
                <option value="documenti_validi">Documenti validi per l'Italia (altro)</option>
                <option value="assente">Nessun documento valido</option>
              </select>
            </div>
          )}
          <div>
            <span style={label}>Codice fiscale <span style={{ fontWeight: 400, color: '#94a3b8' }}>(se ce l'hai)</span></span>
            <input style={input} value={codiceFiscale} onChange={e => setCodiceFiscale(e.target.value.toUpperCase())} placeholder="RSSMRA80A01H501U" maxLength={16} />
          </div>
        </div>

        {/* Zona e disponibilità */}
        <div style={card}>
          <h2 style={cardTitle}>📍 Dove vivi e dove vorresti lavorare</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <span style={label}>Regione dove abiti</span>
              <select style={input} value={regioneResidenza} onChange={e => setRegioneResidenza(e.target.value)}>
                <option value="">— Seleziona —</option>
                {REGIONI.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><span style={label}>Città</span><input style={input} value={cittaResidenza} onChange={e => setCittaResidenza(e.target.value)} placeholder="Es. Roma" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <span style={label}>Regione dove ti interessa lavorare</span>
              <select style={input} value={regioneInteresse} onChange={e => setRegioneInteresse(e.target.value)}>
                <option value="">— Seleziona —</option>
                {REGIONI.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><span style={label}>Città / zona di lavoro</span><input style={input} value={cittaInteresse} onChange={e => setCittaInteresse(e.target.value)} placeholder="Es. Roma Eur" /></div>
          </div>
          <div>
            <span style={label}>Disponibilità oraria</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[['diurno', '☀️ Diurno'], ['notturno', '🌙 Solo notturno'], ['h24', '🕐 Disponibile h24']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setDisponibilita(disponibilita === v ? '' : v)}
                  style={{ flex: 1, minWidth: '110px', padding: '10px', borderRadius: '10px', border: `2px solid ${disponibilita === v ? '#1e4d8c' : '#e2e8f0'}`, background: disponibilita === v ? '#eff6ff' : '#fff', color: disponibilita === v ? '#1e4d8c' : '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {disponibilita === 'h24' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#334155', marginTop: '10px', cursor: 'pointer', background: '#f0f9ff', padding: '10px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
              <input type="checkbox" checked={residenzaFamiglia} onChange={e => setResidenzaFamiglia(e.target.checked)} />
              Sono disponibile ad abitare presso la famiglia (convivenza)
            </label>
          )}
        </div>

        {/* Esperienza */}
        <div style={card}>
          <h2 style={cardTitle}>💼 Esperienza</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#334155', marginBottom: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={certificato} onChange={e => setCertificato(e.target.checked)} />
            Ho una certificazione / attestato (es. corso OSS, assistente familiare)
          </label>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={label}>Esperienze precedenti</span>
              <Dettatura onTesto={appendi(setEsperienze)} />
            </div>
            <textarea style={{ ...input, minHeight: '70px', resize: 'vertical' }} value={esperienze} onChange={e => setEsperienze(e.target.value)}
              placeholder="Es. 3 anni come badante a Roma, assistenza signora anziana…" />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={label}>Note libere</span>
              <Dettatura onTesto={appendi(setNote)} />
            </div>
            <textarea style={{ ...input, minHeight: '60px', resize: 'vertical' }} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Qualsiasi altra cosa vuoi dirci (puoi anche dettarla col microfono)…" />
          </div>
        </div>

        {/* Documento allegato */}
        <div style={card}>
          <h2 style={cardTitle}>📎 Documento o permesso di soggiorno <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.8rem' }}>(facoltativo)</span></h2>
          <input ref={fotoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => setDocumento(e.target.files?.[0] || null)} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
            onChange={e => setDocumento(e.target.files?.[0] || null)} />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => fotoRef.current?.click()}
              style={{ flex: 1, minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', border: '2px dashed #93c5fd', background: '#eff6ff', color: '#1e4d8c', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
              <Camera size={18} /> Scatta foto
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ flex: 1, minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', border: '2px dashed #c4b5fd', background: '#f5f3ff', color: '#6d28d9', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
              <Paperclip size={18} /> Allega file / PDF
            </button>
          </div>
          {documento && (
            <p style={{ margin: '10px 0 0', fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>
              ✅ {documento.name} ({Math.round(documento.size / 1024)} KB)
            </p>
          )}
        </div>

        <button type="button" onClick={invia} disabled={busy}
          style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: busy ? '#94a3b8' : '#1e4d8c', color: '#fff', fontWeight: 800, fontSize: '1.1rem', cursor: busy ? 'default' : 'pointer' }}>
          {busy ? 'Invio in corso…' : '📨 Invia la mia iscrizione'}
        </button>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', marginTop: '18px', lineHeight: 1.6 }}>
          Abbraccio Cure Domiciliari · Via di S. Maria Ausiliatrice 4/B, Roma ·
          <a href={`tel:${TELEFONO}`} style={{ color: '#64748b' }}> <Phone size={11} style={{ verticalAlign: '-1px' }} /> {TELEFONO_LABEL}</a> ·
          <a href={`https://wa.me/${WHATSAPP}`} style={{ color: '#16a34a' }}> <MessageCircle size={11} style={{ verticalAlign: '-1px' }} /> WhatsApp</a>
          <br />In partnership con <strong>Salus Group</strong> — Divisione Datoriale Casimpresa
        </p>
      </main>
    </div>
  );
}

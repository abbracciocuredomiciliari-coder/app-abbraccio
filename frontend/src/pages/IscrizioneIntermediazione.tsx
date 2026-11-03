import { useState } from 'react';
import axios from 'axios';
import { Phone, Send, CheckCircle, MessageCircle, Paperclip } from 'lucide-react';

const API = 'https://api.abbracciocuredomiciliari.it/api';
const TEL = '06 01905242';
const TEL_HREF = '0601905242';
const WA = '393514175117';

const RUOLI: [string, string][] = [
  ['badante', '🧓 Badante'],
  ['colf', '🧹 Colf'],
  ['assistente_familiare', '👨‍👩‍👧 Assistente familiare'],
  ['oss', '🩺 OSS (Operatore Socio-Sanitario)'],
  ['infermiere', '💉 Infermiere'],
  ['medico', '👨‍⚕️ Medico'],
  ['fisioterapista', '🦴 Fisioterapista'],
];
const RUOLI_SANITARI = ['oss', 'infermiere', 'medico', 'fisioterapista'];
const RUOLO_LABEL: Record<string, string> = {
  badante: 'badante', colf: 'colf', assistente_familiare: 'assistente familiare',
  oss: 'OSS', infermiere: 'infermiere', medico: 'medico', fisioterapista: 'fisioterapista',
};

const REGIONI = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia',
  'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna',
  'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto',
];

export default function IscrizioneIntermediazione() {
  const [ruolo, setRuolo] = useState('badante');
  const [f, setF] = useState<Record<string, any>>({});
  const [doc, setDoc] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);

  const set = (k: string, v: any) => setF(s => ({ ...s, [k]: v }));

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome?.trim() || !f.cognome?.trim()) { setErr('Inserisci almeno nome e cognome.'); return; }
    try {
      setSending(true); setErr('');
      const fd = new FormData();
      fd.append('nome', f.nome.trim()); fd.append('cognome', f.cognome.trim()); fd.append('ruolo', ruolo);
      ['albo', 'nazionalita', 'dataNascita', 'permessoSoggiorno', 'codiceFiscale', 'telefono', 'email',
        'regioneResidenza', 'cittaResidenza', 'regioneInteresse', 'cittaInteresse', 'disponibilita',
        'esperienze', 'note'].forEach(k => { if (f[k]) fd.append(k, String(f[k])); });
      fd.append('extraUe', String(!!f.extraUe));
      fd.append('residenzaPressoFamiglia', String(!!f.residenzaPressoFamiglia));
      fd.append('certificato', String(!!f.certificato));
      if (doc) fd.append('documento', doc);
      await axios.post(`${API}/candidati-intermediazione/pubblica`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setOk(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Errore nell'invio della candidatura. Riprova.");
    } finally { setSending(false); }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '11px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.92rem', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4 };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569' };
  const sez: React.CSSProperties = { fontSize: '0.95rem', fontWeight: 800, color: '#1e4d8c', margin: '18px 0 10px' };
  const waText = encodeURIComponent(`Buongiorno, ho appena inviato la mia iscrizione come ${RUOLO_LABEL[ruolo]} dal vostro sito.`);

  if (ok) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f0f6ff,#ffffff 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '44px 36px', maxWidth: 540, textAlign: 'center', border: '1px solid #dbeafe' }}>
        <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 16px' }} />
        <h1 style={{ color: '#1e293b', fontSize: '1.5rem', margin: '0 0 10px' }}>Iscrizione inviata!</h1>
        <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 14px' }}>
          Grazie <strong>{f.nome}</strong>, la tua candidatura come <strong>{RUOLO_LABEL[ruolo]}</strong> è registrata.
          Ti ricontatteremo per un colloquio conoscitivo.
        </p>
        <a href={`https://wa.me/${WA}?text=${waText}`} target="_blank" rel="noopener"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25d366', color: '#fff', padding: '12px 22px', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>
          <MessageCircle size={18} /> Scrivici su WhatsApp
        </a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f0f6ff,#ffffff 55%)', fontFamily: "'Segoe UI',system-ui,sans-serif", padding: '28px 16px 48px' }}>
      <style>{`@media (max-width: 640px) { .landing-hide-mobile { display: none; } }`}</style>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ height: 52 }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
          <h1 style={{ margin: '10px 0 4px', color: '#1e293b', fontSize: 'clamp(1.4rem,4vw,1.9rem)', fontWeight: 800 }}>Registrati come operatore Abbraccio</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.92rem' }}>Badanti · Colf · Assistenti familiari · Operatori sanitari — entra nel team Abbraccio</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>In partnership con <strong>Salus Group</strong></p>
        </div>

        <form onSubmit={invia} style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '24px 22px', border: '1px solid #dbeafe' }}>

          <div style={sez}>Cosa vuoi fare</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
            {RUOLI.map(([v, l]) => (
              <button key={v} type="button" onClick={() => setRuolo(v)}
                style={{ padding: '12px 8px', borderRadius: 10, border: `1.5px solid ${ruolo === v ? '#1e4d8c' : '#e2e8f0'}`, background: ruolo === v ? '#eff6ff' : '#fff', color: ruolo === v ? '#1e4d8c' : '#334155', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', textAlign: 'center' }}>
                {l}
              </button>
            ))}
          </div>

          <div style={sez}>👤 Chi sei</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            <label style={lbl}>Nome *<input style={inp} placeholder="Mario" value={f.nome || ''} onChange={e => set('nome', e.target.value)} /></label>
            <label style={lbl}>Cognome *<input style={inp} placeholder="Rossi" value={f.cognome || ''} onChange={e => set('cognome', e.target.value)} /></label>
            <label style={lbl}>Telefono<input style={inp} type="tel" placeholder="333 1234567" value={f.telefono || ''} onChange={e => set('telefono', e.target.value)} /></label>
            <label style={lbl}>Email<input style={inp} type="email" placeholder="nome@email.it" value={f.email || ''} onChange={e => set('email', e.target.value)} /></label>
            <label style={lbl}>Data di nascita<input style={inp} type="date" value={f.dataNascita || ''} onChange={e => set('dataNascita', e.target.value)} /></label>
            <label style={lbl}>Nazionalità<input style={inp} placeholder="Es. Ucraina" value={f.nazionalita || ''} onChange={e => set('nazionalita', e.target.value)} /></label>
            {RUOLI_SANITARI.includes(ruolo) && (
              <label style={lbl}>Ordine / Albo <span style={{ fontWeight: 400 }}>(se ce l'hai)</span>
                <input style={inp} placeholder="Es. FNOPI n. 123456" value={f.albo || ''} onChange={e => set('albo', e.target.value)} />
              </label>
            )}
          </div>

          <div style={sez}>🌍 Origine e documenti</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!f.extraUe} onChange={e => set('extraUe', e.target.checked)} /> Non sono cittadino italiano né europeo
            </label>
            {f.extraUe && (
              <label style={lbl}>Permesso di soggiorno
                <select style={inp} value={f.permessoSoggiorno || ''} onChange={e => set('permessoSoggiorno', e.target.value)}>
                  <option value="">— Seleziona —</option>
                  <option value="valido">Permesso di soggiorno valido</option>
                  <option value="altro">Documenti validi per l'Italia (altro)</option>
                  <option value="nessuno">Nessun documento valido</option>
                </select>
              </label>
            )}
            <label style={lbl}>Codice fiscale <span style={{ fontWeight: 400 }}>(facoltativo)</span>
              <input style={inp} placeholder="RSSMRA80A01H501U" value={f.codiceFiscale || ''} onChange={e => set('codiceFiscale', e.target.value)} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px dashed #cbd5e1', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569' }}>
              <Paperclip size={16} color="#1e4d8c" />
              {doc ? <strong style={{ color: '#1e4d8c' }}>{doc.name}</strong> : '📎 Documento o permesso di soggiorno (foto o PDF)'}
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => setDoc(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div style={sez}>📍 Dove vivi e dove vorresti lavorare</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            <label style={lbl}>Regione dove abiti
              <select style={inp} value={f.regioneResidenza || ''} onChange={e => set('regioneResidenza', e.target.value)}>
                <option value="">— Seleziona —</option>
                {REGIONI.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label style={lbl}>Città<input style={inp} placeholder="Es. Roma" value={f.cittaResidenza || ''} onChange={e => set('cittaResidenza', e.target.value)} /></label>
            <label style={lbl}>Regione dove ti interessa lavorare
              <select style={inp} value={f.regioneInteresse || ''} onChange={e => set('regioneInteresse', e.target.value)}>
                <option value="">— Seleziona —</option>
                {REGIONI.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label style={lbl}>Città<input style={inp} placeholder="Es. Roma Eur" value={f.cittaInteresse || ''} onChange={e => set('cittaInteresse', e.target.value)} /></label>
          </div>

          <div style={sez}>💼 Esperienza</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={lbl}>Disponibilità oraria
              <select style={inp} value={f.disponibilita || ''} onChange={e => set('disponibilita', e.target.value)}>
                <option value="">— Seleziona —</option>
                <option value="diurno">Diurno</option>
                <option value="notturno">Notturno</option>
                <option value="h24">Convivente / H24</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!f.residenzaPressoFamiglia} onChange={e => set('residenzaPressoFamiglia', e.target.checked)} /> Sono disponibile ad abitare presso la famiglia (convivenza)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!f.certificato} onChange={e => set('certificato', e.target.checked)} /> Ho attestati o certificazioni del settore
            </label>
            <label style={lbl}>Esperienze precedenti
              <textarea style={{ ...inp, resize: 'vertical' }} rows={3} placeholder="Es. 3 anni come badante a Roma, assistenza signora anziana…" value={f.esperienze || ''} onChange={e => set('esperienze', e.target.value)} />
            </label>
            <label style={lbl}>Note libere
              <textarea style={{ ...inp, resize: 'vertical' }} rows={2} placeholder="Qualsiasi altra cosa vuoi dirci (puoi anche dettarla col microfono)…" value={f.note || ''} onChange={e => set('note', e.target.value)} />
            </label>
          </div>

          {err && <p style={{ color: '#dc2626', fontSize: '0.88rem', background: '#fee2e2', padding: '8px 12px', borderRadius: 8 }}>{err}</p>}

          <button type="submit" disabled={sending}
            style={{ marginTop: 18, width: '100%', padding: 15, border: 'none', borderRadius: 12, background: sending ? '#94a3b8' : 'linear-gradient(135deg,#1e3a5f,#1e4d8c)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Send size={18} /> {sending ? 'Invio in corso…' : '📨 Invia la mia iscrizione'}
          </button>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href={`tel:${TEL_HREF}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1e4d8c', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}><Phone size={15} /> {TEL}</a>
            <span style={{ color: '#cbd5e1' }}>·</span>
            <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}><MessageCircle size={15} /> WhatsApp 351 4175117</a>
          </div>
        </form>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: 18 }}>
          Abbraccio Cure Domiciliari S.R.L.S. · Per informazioni: {TEL} · I tuoi dati sono trattati secondo GDPR
        </p>
      </div>
    </div>
  );
}

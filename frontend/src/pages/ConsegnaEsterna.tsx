import { useState } from 'react';
import axios from 'axios';
import { Send, CheckCircle, AlertTriangle } from 'lucide-react';

const API = 'https://api.abbracciocuredomiciliari.it/api';
const TEL = '06 01905242';
const TEL_HREF = '0601905242';

export default function ConsegnaEsterna() {
  const [f, setF] = useState({ autoreNome: '', titolo: '', testo: '', tipo: 'generale', priorita: 'normale', riferimento: '', dataGiornata: '' });
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);

  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }));

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!f.autoreNome.trim() || !f.titolo.trim() || !f.testo.trim()) {
      setErr('Compila nome, titolo e testo della consegna.'); return;
    }
    try {
      setSending(true); setErr('');
      await axios.post(`${API}/consegne-amministrative/pubblica`, {
        autoreNome: f.autoreNome.trim(), titolo: f.titolo.trim(), testo: f.testo.trim(),
        tipo: f.tipo, priorita: f.priorita,
        riferimento: f.riferimento.trim() || undefined,
        dataGiornata: f.dataGiornata || undefined,
      });
      setOk(true);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Errore nell\'invio. Riprova.');
    } finally { setSending(false); }
  }

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f0fdfa,#ffffff 55%)', fontFamily: "'Segoe UI',system-ui,sans-serif", padding: '28px 16px 48px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>{children}</div>
    </div>
  );

  if (ok) return wrap(
    <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '40px 30px', textAlign: 'center', border: '1px solid #ccfbf1' }}>
      <CheckCircle size={54} color="#0d9488" style={{ margin: '0 auto 14px' }} />
      <h1 style={{ color: '#1e293b', fontSize: '1.35rem', margin: '0 0 8px' }}>Consegna registrata!</h1>
      <p style={{ color: '#64748b' }}>La tua consegna è stata inviata all'amministrazione. Grazie!</p>
      <button onClick={() => { setOk(false); setF({ autoreNome: f.autoreNome, titolo: '', testo: '', tipo: 'generale', priorita: 'normale', riferimento: '', dataGiornata: '' }); }}
        style={{ marginTop: 14, padding: '10px 22px', borderRadius: 10, border: '1px solid #0d9488', background: '#fff', color: '#0d9488', fontWeight: 700, cursor: 'pointer' }}>Scrivi un'altra consegna</button>
    </div>
  );

  const inp: React.CSSProperties = { width: '100%', padding: '11px 12px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.92rem', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4 };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569' };

  return wrap(<>
    <div style={{ textAlign: 'center', marginBottom: 18 }}>
      <img src="/logo.png" alt="Abbraccio" style={{ height: 48 }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
      <h1 style={{ margin: '8px 0 4px', color: '#0f766e', fontSize: '1.5rem', fontWeight: 800 }}>Scrivi una consegna</h1>
      <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Segnalazioni e consegne per l'amministrazione — personale Abbraccio</p>
    </div>
    <form onSubmit={invia} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '22px 20px', border: '1px solid #ccfbf1', display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <label style={lbl}>Il tuo nome *<input style={inp} placeholder="Nome e cognome" value={f.autoreNome} onChange={e => set('autoreNome', e.target.value)} /></label>
        <label style={lbl}>Tipo
          <select style={inp} value={f.tipo} onChange={e => set('tipo', e.target.value)}>
            <option value="generale">Generale</option>
            <option value="giornata">Consegna di giornata</option>
            <option value="pratica">Pratica amministrativa</option>
          </select>
        </label>
      </div>
      {f.tipo === 'giornata' && (
        <label style={lbl}>Data della giornata<input style={inp} type="date" value={f.dataGiornata} onChange={e => set('dataGiornata', e.target.value)} /></label>
      )}
      <label style={lbl}>Titolo *<input style={inp} placeholder="Oggetto della consegna" value={f.titolo} onChange={e => set('titolo', e.target.value)} /></label>
      <label style={lbl}>Testo della consegna *
        <textarea style={{ ...inp, resize: 'vertical' }} rows={5} placeholder="Descrivi cosa è successo, cosa serve fare, eventuali urgenze..." value={f.testo} onChange={e => set('testo', e.target.value)} />
      </label>
      <label style={lbl}>Riferimento <span style={{ fontWeight: 400 }}>(facoltativo)</span>
        <input style={inp} placeholder="Es. paziente, pratica, fattura n. ..." value={f.riferimento} onChange={e => set('riferimento', e.target.value)} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={f.priorita === 'urgente'} onChange={e => set('priorita', e.target.checked ? 'urgente' : 'normale')} />
        <AlertTriangle size={15} color="#d97706" /> Consegna urgente
      </label>
      {err && <p style={{ color: '#dc2626', fontSize: '0.88rem', margin: 0 }}>{err}</p>}
      <button type="submit" disabled={sending}
        style={{ width: '100%', padding: 14, border: 'none', borderRadius: 11, background: sending ? '#94a3b8' : 'linear-gradient(135deg,#0f766e,#0d9488)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Send size={17} /> {sending ? 'Invio in corso...' : 'Invia la consegna'}
      </button>
    </form>
    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: 16 }}>Abbraccio Cure Domiciliari · {TEL}</p>
  </>);
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, CalendarDays, Video, Phone, MapPin } from 'lucide-react';

const API = 'https://api.abbracciocuredomiciliari.it/api';

export default function ColloquioPubblico() {
  const [params] = useSearchParams();
  const token = params.get('token') || params.get('t') || '';
  const [coll, setColl] = useState<any>(null);
  const [err, setErr] = useState('');
  const [nota, setNota] = useState('');
  const [sending, setSending] = useState(false);
  const [esito, setEsito] = useState<'accettato' | 'rifiutato' | null>(null);

  useEffect(() => {
    if (!token) { setErr('Link non valido: manca il codice del colloquio.'); return; }
    axios.get(`${API}/colloqui-intermediazione/pubblico/${token}`)
      .then(r => setColl(r.data))
      .catch(e => setErr(e?.response?.data?.message || 'Colloquio non trovato o link scaduto.'));
  }, [token]);

  async function rispondi(accetta: boolean) {
    try {
      setSending(true); setErr('');
      await axios.post(`${API}/colloqui-intermediazione/pubblico/${token}/rispondi`, { accetta, nota: nota.trim() || undefined });
      setEsito(accetta ? 'accettato' : 'rifiutato');
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Errore nell\'invio della risposta.');
    } finally { setSending(false); }
  }

  const box: React.CSSProperties = { background: '#fff', borderRadius: 18, boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '32px 26px', maxWidth: 540, width: '100%', border: '1px solid #dbeafe' };
  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f0f6ff,#ffffff 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ ...box, textAlign: 'center' }}>{children}</div>
    </div>
  );

  if (esito) return wrap(<>
    <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 14px' }} />
    <h1 style={{ color: '#1e293b', fontSize: '1.4rem', margin: '0 0 8px' }}>
      {esito === 'accettato' ? 'Colloquio confermato!' : 'Risposta registrata'}
    </h1>
    <p style={{ color: '#64748b', lineHeight: 1.6 }}>
      {esito === 'accettato'
        ? 'Ti aspettiamo al colloquio: riceverai i dettagli via email/telefono.'
        : 'Grazie per averci avvisato: ti ricontatteremo per riprogrammare.'}
    </p>
  </>);

  if (err && !coll) return wrap(<>
    <XCircle size={52} color="#dc2626" style={{ margin: '0 auto 14px' }} />
    <h1 style={{ color: '#1e293b', fontSize: '1.3rem', margin: '0 0 8px' }}>Link non valido</h1>
    <p style={{ color: '#64748b' }}>{err}</p>
  </>);

  if (!coll) return wrap(<p style={{ color: '#94a3b8' }}>⏳ Caricamento colloquio...</p>);

  const data = coll.dataRiunione ? new Date(coll.dataRiunione) : null;
  return wrap(<>
    <img src="/logo.png" alt="Abbraccio" style={{ height: 46, marginBottom: 10 }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
    <h1 style={{ color: '#1e4d8c', fontSize: '1.35rem', margin: '0 0 4px' }}>Invito a colloquio</h1>
    <p style={{ color: '#64748b', margin: '0 0 16px', fontSize: '0.9rem' }}>{coll.titolo || `Colloquio conoscitivo — ${coll.ruolo || 'operatore'}`}</p>

    <div style={{ textAlign: 'left', background: '#f0f6ff', border: '1px solid #dbeafe', borderRadius: 12, padding: '14px 16px', fontSize: '0.9rem', color: '#334155' }}>
      {coll.nome && <div style={{ marginBottom: 6 }}>👤 <strong>{coll.nome}</strong></div>}
      {data && <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}><CalendarDays size={16} color="#1e4d8c" /> <strong>{data.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> ore {data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {coll.modalita === 'video' ? <Video size={16} color="#1e4d8c" /> : coll.modalita === 'telefono' ? <Phone size={16} color="#1e4d8c" /> : <MapPin size={16} color="#1e4d8c" />}
        {coll.modalita === 'video' ? 'Videochiamata' : coll.modalita === 'telefono' ? 'Telefonata' : 'Di persona'}
        {coll.linkCollegamento && <a href={coll.linkCollegamento} target="_blank" rel="noopener" style={{ color: '#1e4d8c', fontWeight: 700 }}>— apri il link</a>}
      </div>
    </div>

    {coll.risposta ? (
      <p style={{ marginTop: 16, color: '#166534', fontWeight: 700 }}>Hai già risposto: {coll.risposta === 'accettato' ? '✅ accettato' : '❌ non disponibile'}</p>
    ) : (<>
      <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Nota (facoltativa): es. orari alternativi..."
        style={{ width: '100%', marginTop: 16, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={() => rispondi(true)} disabled={sending}
          style={{ flex: 1, padding: 13, border: 'none', borderRadius: 10, background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}>
          ✅ Confermo
        </button>
        <button onClick={() => rispondi(false)} disabled={sending}
          style={{ flex: 1, padding: 13, border: '1px solid #fecaca', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}>
          Non disponibile
        </button>
      </div>
      {err && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: 10 }}>{err}</p>}
    </>)}
    <p style={{ marginTop: 18, fontSize: '0.75rem', color: '#94a3b8' }}>Abbraccio Cure Domiciliari · 06 01905242</p>
  </>);
}

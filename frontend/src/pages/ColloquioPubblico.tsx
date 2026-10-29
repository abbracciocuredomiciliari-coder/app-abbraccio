import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';

// ═══════════════════════════════════════════════════════════════════════════
// PAGINA PUBBLICA INVITO COLLOQUIO — nessun login richiesto.
// Il link arriva via email (es. .../colloquio?token=abc123): il partecipante
// vede data, motivo e modalità del colloquio e risponde ACCETTA / NON POSSO.
// ═══════════════════════════════════════════════════════════════════════════

type Invito = {
  titolo: string; dataRiunione: string; ordineDelGiorno: string;
  modalita: 'video' | 'presenza' | 'telefono'; stato: string;
  linkCollegamento?: string;
  partecipanti: { nome: string; ruolo: string }[];
  io: { nome: string; ruolo: string; risposta: 'attesa' | 'accettato' | 'rifiutato'; rispostoIl?: string };
};

const modalitaLabel: Record<string, { icona: string; testo: string }> = {
  video: { icona: '🎥', testo: 'Videochiamata — riceverai il link per collegarti' },
  presenza: { icona: '🏢', testo: 'Colloquio in presenza' },
  telefono: { icona: '📞', testo: 'Colloquio telefonico — ti chiameremo noi' },
};

export default function ColloquioPubblico() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [invito, setInvito] = useState<Invito | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState('');
  const [esito, setEsito] = useState('');

  useEffect(() => {
    if (!token) { setError('Link invito non valido.'); setLoading(false); return; }
    api.get(`/colloqui-intermediazione/pubblico/${token}`)
      .then(r => setInvito(r.data))
      .catch(e => setError(e.response?.data?.message || 'Link invito non valido o scaduto.'))
      .finally(() => setLoading(false));
  }, [token]);

  const rispondi = async (accetta: boolean) => {
    setBusy(true); setError('');
    try {
      const res = await api.post(`/colloqui-intermediazione/pubblico/${token}/rispondi`, { accetta, nota: nota.trim() || undefined });
      setEsito(res.data.message);
      setInvito(prev => prev ? { ...prev, io: { ...prev.io, risposta: res.data.risposta, rispostoIl: new Date().toISOString() } } : prev);
    } catch (e: any) { setError(e.response?.data?.message || 'Impossibile registrare la risposta.'); }
    finally { setBusy(false); }
  };

  const box: React.CSSProperties = { fontFamily: 'Arial,sans-serif', maxWidth: 560, margin: '0 auto', padding: '20px' };

  if (loading) return <div style={{ ...box, textAlign: 'center', paddingTop: 80 }}>⏳ Caricamento invito...</div>;
  if (error && !invito) return (
    <div style={box}>
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <h2 style={{ color: '#1e4d8c' }}>Abbraccio Cure Domiciliari</h2>
        <p style={{ background: '#fee2e2', color: '#b91c1c', padding: 14, borderRadius: 8 }}>{error}</p>
        <p style={{ color: '#64748b', fontSize: 14 }}>Se il link non funziona chiama lo <strong>06 01905242</strong>.</p>
      </div>
    </div>
  );

  const giaRisposto = invito!.io.risposta !== 'attesa';
  const chiuso = invito!.stato !== 'programmato';
  const data = new Date(invito!.dataRiunione);
  const dataStr = data.toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const m = modalitaLabel[invito!.modalita] || modalitaLabel.video;

  return (
    <div style={box}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1e4d8c', paddingBottom: 14, marginBottom: 18 }}>
        <h2 style={{ color: '#1e4d8c', margin: 0 }}>Abbraccio Cure Domiciliari</h2>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Intermediazioni — invito a colloquio</p>
      </div>

      <h3 style={{ marginTop: 0 }}>{invito!.titolo}</h3>
      <p>Ciao <strong>{invito!.io.nome}</strong>, sei invitato/a a questo colloquio:</p>

      <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 16, margin: '14px 0', lineHeight: 1.9 }}>
        <div>📅 <strong>{dataStr}</strong></div>
        <div>{m.icona} {m.testo}</div>
        <div>📋 <strong>Motivo:</strong> {invito!.ordineDelGiorno}</div>
        <div>👥 Partecipanti: {invito!.partecipanti.map(p => p.nome).join(', ')}</div>
      </div>

      {error && <p style={{ background: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 8 }}>{error}</p>}
      {esito && <p style={{ background: '#dcfce7', color: '#15803d', padding: 12, borderRadius: 8 }}>✅ {esito}</p>}
      {chiuso && !esito && <p style={{ background: '#fef3c7', color: '#92400e', padding: 12, borderRadius: 8 }}>Questo colloquio è stato {invito!.stato === 'annullato' ? 'annullato' : 'già svolto'} — per informazioni chiama lo <strong>06 01905242</strong>.</p>}

      {giaRisposto && !esito && (
        <p style={{ background: invito!.io.risposta === 'accettato' ? '#dcfce7' : '#fee2e2', color: invito!.io.risposta === 'accettato' ? '#15803d' : '#b91c1c', padding: 12, borderRadius: 8 }}>
          {invito!.io.risposta === 'accettato' ? '✅ Hai già confermato la tua partecipazione.' : '❌ Hai risposto che non puoi partecipare.'}
          {invito!.io.rispostoIl ? ` (${new Date(invito!.io.rispostoIl).toLocaleString('it-IT')})` : ''}
        </p>
      )}

      {!chiuso && (
        <>
          {(!giaRisposto || invito!.io.risposta === 'rifiutato') && (
            <>
              <textarea
                placeholder="Nota facoltativa (es. posso solo dopo le 18, preferisco il telefono…)"
                value={nota} onChange={e => setNota(e.target.value)} rows={2}
                style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => rispondi(true)} disabled={busy} style={{ flex: 1, minWidth: 200, padding: '16px 20px', border: 0, borderRadius: 10, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                  ✅ ACCETTA IL COLLOQUIO
                </button>
                {!giaRisposto && (
                  <button onClick={() => rispondi(false)} disabled={busy} style={{ padding: '16px 20px', border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' }}>
                    ❌ Non posso partecipare
                  </button>
                )}
              </div>
            </>
          )}

          {invito!.io.risposta === 'accettato' && invito!.linkCollegamento && invito!.modalita === 'video' && (
            <div style={{ marginTop: 16, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 14 }}>
              🎥 <strong>Link per collegarti</strong> (il giorno del colloquio riceverai anche il promemoria via email):<br />
              <a href={invito!.linkCollegamento} style={{ color: '#15803d', wordBreak: 'break-all' }}>{invito!.linkCollegamento}</a>
            </div>
          )}
        </>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
        Abbraccio Cure Domiciliari · Tel. 06 01905242 · info@abbracciocuredomiciliari.it
      </p>
    </div>
  );
}

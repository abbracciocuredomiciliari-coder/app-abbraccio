import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import FirmaCanvas from '../components/FirmaCanvas';

type VerbaleEsterno = {
  titolo: string;
  dataRiunione: string;
  ordineDelGiorno: string;
  verbale?: string;
  allegato?: { nome: string };
  partecipante: { nome: string; firma?: string };
};

export default function FirmaVerbaleEsterno() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [verbale, setVerbale] = useState<VerbaleEsterno | null>(null);
  const [firma, setFirma] = useState('');
  const [stato, setStato] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [messaggio, setMessaggio] = useState('');

  useEffect(() => {
    document.title = 'Firma digitale verbale';
    if (!token) { setStato('error'); setMessaggio('Link di firma non valido.'); return; }
    api.get(`/verbali-equipe/firma-esterna/${token}`)
      .then(response => { setVerbale(response.data); setStato('ready'); })
      .catch(error => { setStato('error'); setMessaggio(error.response?.data?.message || 'Impossibile aprire il verbale.'); });
  }, [token]);

  const firmaVerbale = async () => {
    if (!firma) return;
    try {
      await api.post(`/verbali-equipe/firma-esterna/${token}`, { firma });
      setStato('success');
    } catch (error: any) { setMessaggio(error.response?.data?.message || 'Firma non riuscita.'); }
  };

  const card: React.CSSProperties = { maxWidth: 760, margin: '32px auto', padding: 28, borderRadius: 14, background: '#fff', boxShadow: '0 8px 28px rgba(15, 118, 110, .12)' };
  if (stato === 'loading') return <main style={card}>Caricamento del verbale...</main>;
  if (stato === 'error') return <main style={card}><h1 style={{ color: '#b91c1c' }}>Link non disponibile</h1><p>{messaggio}</p></main>;
  if (stato === 'success') return <main style={card}><h1 style={{ color: '#047857' }}>Verbale firmato</h1><p>Grazie. La firma è stata acquisita correttamente.</p></main>;
  if (!verbale) return null;

  return <main style={card}>
    <p style={{ margin: 0, color: '#0f766e', fontWeight: 700 }}>PORTALE FIRMA DIGITALE</p>
    <h1 style={{ color: '#134e4a' }}>Firma verbale riunione</h1>
    <p>Ciao <strong>{verbale.partecipante.nome}</strong>, leggi il verbale e firma nello spazio sottostante.</p>
    <section style={{ padding: 16, background: '#f0fdfa', borderRadius: 9, margin: '20px 0' }}>
      <strong>{verbale.titolo}</strong><br />
      <small>{new Date(verbale.dataRiunione).toLocaleString('it-IT')} · {verbale.ordineDelGiorno}</small>
    </section>
    {verbale.allegato && <p><a href={`${api.defaults.baseURL}/verbali-equipe/firma-esterna/${token}/allegato`} target="_blank" rel="noreferrer">📎 Apri allegato: {verbale.allegato.nome}</a></p>}
    <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #d1d5db', borderRadius: 9, padding: 16, maxHeight: 360, overflowY: 'auto', background: '#fff' }}>{verbale.verbale || 'Il contenuto è disponibile nell’allegato.'}</div>
    {verbale.partecipante.firma ? <p style={{ color: '#047857', fontWeight: 700 }}>Questo verbale risulta già firmato.</p> : <section style={{ marginTop: 22 }}><FirmaCanvas label="La tua firma" sublabel="Firma con dito o penna" onFirmaCompleta={setFirma} onCancella={() => setFirma('')} altezza={140} /><button onClick={firmaVerbale} disabled={!firma} style={{ padding: '11px 18px', border: 0, borderRadius: 7, background: firma ? '#0f766e' : '#94a3b8', color: '#fff', fontWeight: 700, cursor: firma ? 'pointer' : 'not-allowed' }}>✍️ Firma il verbale</button>{messaggio && <p style={{ color: '#b91c1c' }}>{messaggio}</p>}</section>}
  </main>;
}

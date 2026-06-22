import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import FirmaCanvas from '../components/FirmaCanvas';

export default function FirmaContratto() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [stato, setStato] = useState<'caricamento' | 'pronto' | 'firmato' | 'errore'>('caricamento');
  const [nomeUtente, setNomeUtente] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [firma, setFirma] = useState<string | null>(null);
  const [dataFirma] = useState(new Date().toISOString().split('T')[0]);
  const [luogoFirma, setLuogoFirma] = useState('Roma');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrMsg('Link non valido. Richiedi un nuovo link all\'amministratore.');
      setStato('errore');
      return;
    }
    const apiUrl = (import.meta.env.VITE_API_BASE_URL || 'https://api.abbracciocuredomiciliari.it/api').replace(/\/api$/, '');
    fetch(`${apiUrl}/api/contratto/verifica-token?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.message) {
          setErrMsg(data.message);
          setStato('errore');
        } else if (data.giàFirmato) {
          setNomeUtente(data.nome);
          setStato('firmato');
        } else {
          setNomeUtente(data.nome);
          setStato('pronto');
        }
      })
      .catch(() => {
        setErrMsg('Errore di connessione. Riprova più tardi.');
        setStato('errore');
      });
  }, [token]);

  const handleInviaFirma = async () => {
    if (!firma) return;
    setLoading(true);
    try {
      await api.post('/contratto/firma-da-token', { token, firmaContratto: firma, dataFirma, luogoFirma });
      setStato('firmato');
    } catch (err: any) {
      setErrMsg(err?.response?.data?.message || 'Errore nel salvataggio della firma. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '36px 32px', maxWidth: '560px', width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '4px' }}>🏥</div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', color: '#1e4d8c', fontWeight: 700 }}>Abbraccio Cure Domiciliari</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>Firma digitale contratto</p>
        </div>

        {stato === 'caricamento' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
            <p>Verifica link in corso...</p>
          </div>
        )}

        {stato === 'errore' && (
          <div style={{ textAlign: 'center', padding: '20px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>❌</div>
            <h3 style={{ color: '#dc2626', margin: '0 0 8px' }}>Link non valido</h3>
            <p style={{ color: '#7f1d1d', margin: 0, fontSize: '0.9rem' }}>{errMsg}</p>
          </div>
        )}

        {stato === 'firmato' && (
          <div style={{ textAlign: 'center', padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #86efac' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✅</div>
            <h3 style={{ color: '#059669', margin: '0 0 8px' }}>Contratto già firmato</h3>
            <p style={{ color: '#065f46', margin: 0, fontSize: '0.9rem' }}>
              {nomeUtente}, hai già firmato il contratto digitalmente. Puoi chiudere questa pagina.
            </p>
          </div>
        )}

        {stato === 'pronto' && (
          <div>
            <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', border: '1px solid #bfdbfe' }}>
              <p style={{ margin: 0, color: '#1e40af', fontSize: '0.9rem' }}>
                Ciao <strong>{nomeUtente}</strong>, firma il contratto di collaborazione con Abbraccio Cure Domiciliari qui sotto.
              </p>
            </div>

            {/* Estratto contratto */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', maxHeight: '220px', overflowY: 'auto', fontSize: '0.78rem', color: '#374151', lineHeight: 1.5, marginBottom: '20px' }}>
              <strong style={{ display: 'block', textAlign: 'center', marginBottom: '8px', fontSize: '0.85rem', color: '#1e4d8c' }}>CONTRATTO DI PRESTAZIONE D'OPERA</strong>
              <p><strong>TRA:</strong> ABBRACCIO CURE DOMICILIARI S.r.l. (P.IVA 18316251000) — Via S. Maria Ausiliatrice 4B, 00181 Roma</p>
              <p><strong>E:</strong> {nomeUtente}</p>
              <p><strong>Oggetto:</strong> Prestazioni professionali in ambito socio-sanitario e assistenza domiciliare.</p>
              <p><strong>Durata:</strong> 1 anno dalla data di firma, con rinnovo tacito.</p>
              <p><strong>Corrispettivo:</strong> Da concordare nel piano lavoro, pagamento 30gg fine mese.</p>
              <p><strong>Privacy:</strong> Impegno riservatezza dati pazienti (GDPR art.28).</p>
              <p><strong>Recesso:</strong> 30 giorni di preavviso.</p>
            </div>

            {/* Data e luogo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Data firma</label>
                <input
                  type="text"
                  value={new Date(dataFirma).toLocaleDateString('it-IT')}
                  readOnly
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f9fafb', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Luogo firma *</label>
                <input
                  type="text"
                  value={luogoFirma}
                  onChange={e => setLuogoFirma(e.target.value)}
                  placeholder="Es. Roma"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Firma canvas */}
            <div style={{ border: '2px dashed #1e4d8c', borderRadius: '10px', padding: '10px', marginBottom: '16px' }}>
              <FirmaCanvas
                label="Firma digitale"
                sublabel={`${nomeUtente} — ${new Date().toLocaleDateString('it-IT')}`}
                onFirmaCompleta={setFirma}
                onCancella={() => setFirma(null)}
                altezza={130}
              />
            </div>

            {errMsg && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: '#dc2626', fontSize: '0.85rem' }}>
                {errMsg}
              </div>
            )}

            <button
              onClick={handleInviaFirma}
              disabled={!firma || loading}
              style={{
                width: '100%', padding: '14px', background: firma && !loading ? '#1e4d8c' : '#93c5fd',
                color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem',
                fontWeight: 700, cursor: firma && !loading ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s'
              }}
            >
              {loading ? '⏳ Salvataggio...' : '✅ Firma e invia contratto'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', marginTop: '12px' }}>
              La firma digitale ha valore legale. Firmando accetti i termini del contratto di collaborazione.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

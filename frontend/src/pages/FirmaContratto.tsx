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
  const [testoContratto, setTestoContratto] = useState('');

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
        } else {
          setNomeUtente(data.nome || '');
          setTestoContratto(data.contratto || '');
          setStato(data.giàFirmato ? 'firmato' : 'pronto');
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
    <div className="tw-min-h-screen tw-bg-slate-50 tw-flex tw-items-center tw-justify-center tw-p-5">
      <div className="tw-bg-white tw-rounded-2xl tw-p-9 tw-px-8 tw-max-w-[560px] tw-w-full" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        {/* Header */}
        <div className="tw-text-center tw-mb-6">
          <h1 className="tw-m-0 tw-text-[1.3rem] tw-text-teal-700 tw-font-bold">Portale Firma Digitale</h1>
          <p className="tw-mt-1 tw-mb-0 tw-text-slate-500 tw-text-[0.9rem]">Firma digitale contratto</p>
        </div>

        {stato === 'caricamento' && (
          <div className="tw-text-center tw-py-10 tw-text-slate-500">
            <div className="tw-text-[2rem] tw-mb-3">⏳</div>
            <p>Verifica link in corso...</p>
          </div>
        )}

        {stato === 'errore' && (
          <div className="tw-text-center tw-p-5 tw-bg-red-50 tw-rounded-xl tw-border tw-border-red-200">
            <div className="tw-text-[2.5rem] tw-mb-3">❌</div>
            <h3 className="tw-text-red-600 tw-mt-0 tw-mb-2">Link non valido</h3>
            <p className="tw-text-red-900 tw-m-0 tw-text-[0.9rem]">{errMsg}</p>
          </div>
        )}

        {stato === 'firmato' && (
          <div className="tw-text-center tw-p-5 tw-bg-green-50 tw-rounded-xl tw-border tw-border-green-300">
            <div className="tw-text-[2.5rem] tw-mb-3">✅</div>
            <h3 className="tw-text-green-600 tw-mt-0 tw-mb-2">Contratto già firmato</h3>
            <p className="tw-text-green-800 tw-m-0 tw-text-[0.9rem]">
              {nomeUtente}, hai già firmato il contratto digitalmente. Puoi chiudere questa pagina.
            </p>
          </div>
        )}

        {stato === 'pronto' && (
          <div>
            <div className="tw-bg-blue-50 tw-rounded-lg tw-py-3.5 tw-px-4 tw-mb-5 tw-border tw-border-blue-200">
              <p className="tw-m-0 tw-text-blue-800 tw-text-[0.9rem]">
                Ciao <strong>{nomeUtente}</strong>, firma il contratto di collaborazione qui sotto.
              </p>
            </div>

            <div className="tw-bg-slate-50 tw-border tw-border-slate-200 tw-rounded-lg tw-p-3.5 tw-max-h-[420px] tw-overflow-y-auto tw-text-[0.78rem] tw-text-slate-700 tw-leading-normal tw-mb-5 tw-whitespace-pre-wrap">
              <strong className="tw-block tw-text-center tw-mb-2 tw-text-[0.85rem] tw-text-brand">TESTO INTEGRALE DEL CONTRATTO</strong>
              {testoContratto || 'Caricamento del contratto completo...'}
            </div>

            {/* Data e luogo */}
            <div className="tw-grid tw-grid-cols-2 tw-gap-2.5 tw-mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label className="tw-text-[0.82rem] tw-text-slate-500 tw-block tw-mb-1">Data firma</label>
                <input
                  type="text"
                  value={new Date(dataFirma).toLocaleDateString('it-IT')}
                  readOnly
                  className="tw-w-full tw-py-2 tw-px-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-slate-50 tw-text-[0.9rem]"
                />
              </div>
              <div>
                <label className="tw-text-[0.82rem] tw-text-slate-500 tw-block tw-mb-1">Luogo firma *</label>
                <input
                  type="text"
                  value={luogoFirma}
                  onChange={e => setLuogoFirma(e.target.value)}
                  placeholder="Es. Roma"
                  className="tw-w-full tw-py-2 tw-px-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem]"
                />
              </div>
            </div>

            {/* Firma canvas */}
            <div className="tw-border-2 tw-border-dashed tw-border-brand tw-rounded-lg tw-p-2.5 tw-mb-4">
              <FirmaCanvas
                label="Firma digitale"
                sublabel={`${nomeUtente} — ${new Date().toLocaleDateString('it-IT')}`}
                onFirmaCompleta={setFirma}
                onCancella={() => setFirma(null)}
                altezza={130}
              />
            </div>

            {errMsg && (
              <div className="tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-lg tw-py-2.5 tw-px-3.5 tw-mb-3.5 tw-text-red-600 tw-text-[0.85rem]">
                {errMsg}
              </div>
            )}

            <button
              onClick={handleInviaFirma}
              disabled={!firma || loading}
              className="tw-w-full tw-p-3.5 tw-border-0 tw-rounded-lg tw-text-white tw-text-base tw-font-bold disabled:tw-cursor-not-allowed tw-transition-colors"
              style={{ backgroundColor: firma && !loading ? '#1e4d8c' : '#93c5fd' }}
            >
              {loading ? '⏳ Salvataggio...' : '✅ Firma e invia contratto'}
            </button>

            <p className="tw-text-center tw-text-[0.75rem] tw-text-slate-400 tw-mt-3">
              La firma digitale ha valore legale. Firmando accetti i termini del contratto di collaborazione.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

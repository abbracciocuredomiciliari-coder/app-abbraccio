import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import FirmaCanvas from '../components/FirmaCanvas';

interface ContrattoData {
  patient: {
    firstName: string;
    lastName: string;
    birthDate: string;
    codiceFiscale?: string;
    address?: string;
    contactPhone?: string;
    email?: string;
  };
  profilo: 'OSS' | 'Infermiere';
  importo: number;
  nome?: string;
}

export default function FirmaContrattoPaziente() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [stato, setStato] = useState<'caricamento' | 'pronto' | 'firmato' | 'errore'>('caricamento');
  const [errMsg, setErrMsg] = useState('');
  const [firma, setFirma] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [luogoFirma, setLuogoFirma] = useState('Roma');
  const [loading, setLoading] = useState(false);
  const [contratto, setContratto] = useState<ContrattoData | null>(null);

  useEffect(() => {
    if (!token) {
      setErrMsg('Link non valido. Richiedi un nuovo link all\'amministratore.');
      setStato('errore');
      return;
    }
    api.get(`/contratti-pazienti/firma/${token}`)
      .then(res => {
        if (res.data.giaFirmato) {
          setContratto(res.data);
          setStato('firmato');
        } else {
          setContratto(res.data);
          setNome(res.data.nome || `${res.data.patient?.firstName || ''} ${res.data.patient?.lastName || ''}`.trim());
          setStato('pronto');
        }
      })
      .catch(err => {
        setErrMsg(err?.response?.data?.message || 'Errore di connessione. Riprova più tardi.');
        setStato('errore');
      });
  }, [token]);

  const handleInviaFirma = async () => {
    if (!firma) return;
    setLoading(true);
    try {
      await api.post(`/contratti-pazienti/firma/${token}`, { firmaImg: firma, nome, luogoFirma });
      setStato('firmato');
    } catch (err: any) {
      setErrMsg(err?.response?.data?.message || 'Errore nel salvataggio della firma. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tw-min-h-screen tw-bg-slate-50 tw-flex tw-items-center tw-justify-center tw-p-5">
      <div className="tw-bg-white tw-rounded-2xl tw-p-8 tw-px-6 tw-max-w-[560px] tw-w-full" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div className="tw-text-center tw-mb-6">
          <h1 className="tw-m-0 tw-text-[1.3rem] tw-text-brand tw-font-bold">Portale Firma Contratto</h1>
          <p className="tw-mt-1 tw-mb-0 tw-text-slate-500 tw-text-[0.9rem]">Firma digitale contratto d'incarico</p>
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
            <h3 className="tw-text-green-600 tw-mt-0 tw-mb-2">Contratto firmato</h3>
            <p className="tw-text-green-800 tw-m-0 tw-text-[0.9rem]">
              Il contratto è stato firmato e archiviato. Puoi chiudere questa pagina.
            </p>
          </div>
        )}

        {stato === 'pronto' && contratto && (
          <div>
            <div className="tw-bg-blue-50 tw-rounded-lg tw-py-3.5 tw-px-4 tw-mb-5 tw-border tw-border-blue-200">
              <p className="tw-m-0 tw-text-blue-800 tw-text-[0.9rem]">
                Ciao <strong>{contratto.patient?.firstName} {contratto.patient?.lastName}</strong>, firma qui sotto il contratto d'incarico per il reclutamento di un <strong>{contratto.profilo === 'OSS' ? 'O.S.S.' : 'Infermiere Professionale'}</strong>.
              </p>
            </div>

            <div className="tw-mb-4">
              <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-2">Nome e cognome del firmatario</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm"
                placeholder="es. Mario Rossi"
              />
            </div>

            <div className="tw-mb-4">
              <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-2">Luogo firma</label>
              <input
                type="text"
                value={luogoFirma}
                onChange={(e) => setLuogoFirma(e.target.value)}
                className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm"
              />
            </div>

            <FirmaCanvas
              label="Firma con dito o penna"
              sublabel="Firma per accettazione del contratto d'incarico"
              onFirmaCompleta={setFirma}
            />

            <button
              onClick={handleInviaFirma}
              disabled={!firma || loading}
              className="tw-w-full tw-mt-5 tw-py-3 tw-rounded-lg tw-bg-emerald-600 hover:tw-bg-emerald-700 disabled:tw-bg-slate-300 tw-text-white tw-font-bold tw-border-0 tw-cursor-pointer tw-transition-colors"
            >
              {loading ? 'Salvataggio...' : 'Conferma e firma contratto'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
  profilo: 'OSS' | 'Infermiere' | 'Assistente familiare' | 'Operatore generale';
  importo: number;
  nome?: string;
  hasPreventivo?: boolean;
  hasAllegato?: boolean;
  allegatoFileName?: string;
}

export default function FirmaContrattoPaziente() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [stato, setStato] = useState<'caricamento' | 'pronto' | 'firmato' | 'errore'>('caricamento');
  const [errMsg, setErrMsg] = useState('');
  const [firma, setFirma] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [luogoFirma, setLuogoFirma] = useState('Roma');
  const [gdprAccettato, setGdprAccettato] = useState(false);
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
    if (!firma || !gdprAccettato) return;
    setLoading(true);
    try {
      await api.post(`/contratti-pazienti/firma/${token}`, { firmaImg: firma, nome, luogoFirma, gdprAccettato });
      setErrMsg('');
      setStato('firmato');
    } catch (err: any) {
      setErrMsg(err?.response?.data?.message || 'Errore nel salvataggio della firma. Riprova.');
      setStato('errore');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tw-min-h-screen tw-bg-slate-50 tw-flex tw-items-center tw-justify-center tw-p-5">
      <div className="tw-bg-white tw-rounded-2xl tw-p-8 tw-px-6 tw-max-w-[560px] tw-w-full" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div className="tw-text-center tw-mb-6">
          <h1 className="tw-m-0 tw-text-[1.3rem] tw-text-brand tw-font-bold">Portale Firma Contratto e Consenso</h1>
          <p className="tw-mt-1 tw-mb-0 tw-text-slate-500 tw-text-[0.9rem]">Firma digitale contratto d'incarico e informativa GDPR</p>
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

        {stato === 'pronto' && contratto && (() => {
          const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');
          const anteprimaUrl = `${apiBase}/contratti-pazienti/anteprima/${token}`;
          const gdprUrl = `${apiBase}/contratti-pazienti/gdpr/${token}`;
          const contrattoPdfUrl = `${apiBase}/contratti-pazienti/contratto-pdf/${token}`;
          const gdprPdfUrl = `${apiBase}/contratti-pazienti/gdpr-pdf/${token}`;
          const preventivoUrl = `${apiBase}/contratti-pazienti/preventivo/${token}`;
          const allegatoUrl = `${apiBase}/contratti-pazienti/allegato/${token}`;
          return (
            <div>
              <div className="tw-bg-blue-50 tw-rounded-lg tw-py-3.5 tw-px-4 tw-mb-5 tw-border tw-border-blue-200">
                <p className="tw-m-0 tw-text-blue-800 tw-text-[0.9rem]">
                  Ciao <strong>{contratto.patient?.firstName} {contratto.patient?.lastName}</strong>, per proseguire <strong>leggi i documenti</strong> sottostanti, acconsenti al trattamento dei dati e firma con dito, penna o mouse.
                </p>
              </div>

              <div className="tw-flex tw-gap-3 tw-mb-2">
                <a href={anteprimaUrl} target="_blank" rel="noreferrer" className="tw-flex-1 tw-text-center tw-py-2 tw-px-3 tw-rounded-lg tw-bg-blue-100 tw-text-blue-800 tw-text-sm tw-font-semibold hover:tw-bg-blue-200 tw-transition-colors">
                  📄 Leggi contratto
                </a>
                <a href={gdprUrl} target="_blank" rel="noreferrer" className="tw-flex-1 tw-text-center tw-py-2 tw-px-3 tw-rounded-lg tw-bg-blue-100 tw-text-blue-800 tw-text-sm tw-font-semibold hover:tw-bg-blue-200 tw-transition-colors">
                  📋 Leggi informativa GDPR
                </a>
              </div>

              <div className="tw-flex tw-gap-3 tw-mb-5">
                <a href={contrattoPdfUrl} target="_blank" rel="noreferrer" className="tw-flex-1 tw-text-center tw-py-2 tw-px-3 tw-rounded-lg tw-bg-emerald-100 tw-text-emerald-800 tw-text-sm tw-font-semibold hover:tw-bg-emerald-200 tw-transition-colors">
                  ⬇️ Scarica contratto (PDF)
                </a>
                <a href={gdprPdfUrl} target="_blank" rel="noreferrer" className="tw-flex-1 tw-text-center tw-py-2 tw-px-3 tw-rounded-lg tw-bg-emerald-100 tw-text-emerald-800 tw-text-sm tw-font-semibold hover:tw-bg-emerald-200 tw-transition-colors">
                  ⬇️ Scarica GDPR (PDF)
                </a>
              </div>

              {(contratto.hasPreventivo || contratto.hasAllegato) && (
                <div className="tw-flex tw-gap-3 tw-mb-5 tw-flex-wrap">
                  {contratto.hasPreventivo && (
                    <a href={preventivoUrl} target="_blank" rel="noreferrer" className="tw-flex-1 tw-text-center tw-py-2 tw-px-3 tw-rounded-lg tw-bg-amber-100 tw-text-amber-800 tw-text-sm tw-font-semibold hover:tw-bg-amber-200 tw-transition-colors">
                      💶 Scarica preventivo (PDF)
                    </a>
                  )}
                  {contratto.hasAllegato && (
                    <a href={allegatoUrl} target="_blank" rel="noreferrer" className="tw-flex-1 tw-text-center tw-py-2 tw-px-3 tw-rounded-lg tw-bg-amber-100 tw-text-amber-800 tw-text-sm tw-font-semibold hover:tw-bg-amber-200 tw-transition-colors">
                      📎 Scarica allegato{contratto.allegatoFileName ? ` (${contratto.allegatoFileName})` : ''}
                    </a>
                  )}
                </div>
              )}

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

              <label className="tw-flex tw-items-start tw-gap-3 tw-mb-5 tw-cursor-pointer tw-bg-amber-50 tw-p-3 tw-rounded-lg tw-border tw-border-amber-200">
                <input
                  type="checkbox"
                  checked={gdprAccettato}
                  onChange={(e) => setGdprAccettato(e.target.checked)}
                  className="tw-mt-1"
                />
                <span className="tw-text-sm tw-text-slate-700">
                  Ho letto il contratto d'incarico e l'informativa GDPR, comprendo il trattamento dei miei dati personali e <strong>dichiaro di accettare entrambi</strong>.
                </span>
              </label>

              <FirmaCanvas
                label="Firma con dito, penna o mouse"
                sublabel="La firma vale per il contratto d'incarico e per il consenso GDPR"
                onFirmaCompleta={setFirma}
              />

              <button
                onClick={handleInviaFirma}
                disabled={!firma || !gdprAccettato || loading}
                className="tw-w-full tw-mt-5 tw-py-3 tw-rounded-lg tw-bg-emerald-600 hover:tw-bg-emerald-700 disabled:tw-bg-slate-300 tw-text-white tw-font-bold tw-border-0 tw-cursor-pointer tw-transition-colors"
              >
                {loading ? 'Salvataggio...' : 'Conferma e firma contratto e consenso GDPR'}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
